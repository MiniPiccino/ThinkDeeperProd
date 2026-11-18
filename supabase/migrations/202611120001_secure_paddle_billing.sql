begin;

alter table public.user_plan
    add column if not exists status text,
    add column if not exists expires_at timestamptz,
    add column if not exists source text,
    add column if not exists paddle_subscription_id text,
    add column if not exists verified_at timestamptz;

create unique index if not exists user_plan_user_id_unique
    on public.user_plan (user_id);

create table if not exists public.billing_checkout_correlations (
    correlation_id uuid primary key,
    user_id uuid not null references auth.users(id) on delete restrict,
    price_id text not null,
    paddle_transaction_id text unique,
    status text not null check (status in ('pending', 'linked', 'confirmed', 'failed', 'expired')),
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists billing_checkout_correlations_user_idx
    on public.billing_checkout_correlations (user_id, created_at desc);

create table if not exists public.paddle_subscriptions (
    subscription_id text primary key,
    user_id uuid not null references auth.users(id) on delete restrict,
    customer_id text not null,
    status text not null check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled')),
    price_id text,
    current_period_start timestamptz,
    current_period_end timestamptz,
    access_until timestamptz,
    scheduled_change_action text,
    scheduled_change_at timestamptz,
    last_transaction_id text,
    last_event_id text not null,
    last_event_at timestamptz not null,
    access_revoked boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists paddle_subscriptions_user_idx
    on public.paddle_subscriptions (user_id, status);
create index if not exists paddle_subscriptions_customer_idx
    on public.paddle_subscriptions (customer_id);

create table if not exists public.paddle_webhook_events (
    event_id text primary key,
    notification_id text not null,
    event_type text not null,
    occurred_at timestamptz not null,
    payload_sha256 text not null,
    processing_status text not null check (processing_status in ('processing', 'processed', 'ignored', 'failed')),
    attempts integer not null default 1,
    reason text,
    user_id uuid references auth.users(id) on delete restrict,
    subscription_id text,
    transaction_id text,
    received_at timestamptz not null default now(),
    processed_at timestamptz
);

create index if not exists paddle_webhook_events_retry_idx
    on public.paddle_webhook_events (processing_status, received_at)
    where processing_status = 'failed';

alter table public.billing_checkout_correlations enable row level security;
alter table public.paddle_subscriptions enable row level security;
alter table public.paddle_webhook_events enable row level security;

revoke all on public.billing_checkout_correlations from anon, authenticated;
revoke all on public.paddle_subscriptions from anon, authenticated;
revoke all on public.paddle_webhook_events from anon, authenticated;

create or replace function public.process_paddle_billing_event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_event_id text := p_event->>'event_id';
    v_notification_id text := p_event->>'notification_id';
    v_event_type text := p_event->>'event_type';
    v_occurred_at timestamptz := (p_event->>'occurred_at')::timestamptz;
    v_payload_hash text := p_event->>'payload_sha256';
    v_subscription_id text := nullif(p_event->>'subscription_id', '');
    v_transaction_id text := nullif(p_event->>'transaction_id', '');
    v_customer_id text := nullif(p_event->>'customer_id', '');
    v_correlation_id uuid;
    v_subscription_status text := nullif(p_event->>'subscription_status', '');
    v_price_id text := nullif(p_event->>'price_id', '');
    v_period_start timestamptz;
    v_period_end timestamptz;
    v_scheduled_action text := nullif(p_event->>'scheduled_change_action', '');
    v_scheduled_at timestamptz;
    v_adjustment_action text := nullif(p_event->>'adjustment_action', '');
    v_adjustment_type text := nullif(p_event->>'adjustment_type', '');
    v_adjustment_status text := nullif(p_event->>'adjustment_status', '');
    v_grace_days integer := greatest(coalesce((p_event->>'past_due_grace_days')::integer, 7), 0);
    v_existing_event public.paddle_webhook_events%rowtype;
    v_existing_subscription public.paddle_subscriptions%rowtype;
    v_user_id uuid;
    v_correlation_user uuid;
    v_access_until timestamptz;
    v_entitlement_expiry timestamptz;
    v_entitlement_status text;
begin
    if v_event_id is null or v_notification_id is null or v_event_type is null
       or v_occurred_at is null or v_payload_hash is null then
        raise exception 'invalid_paddle_event';
    end if;

    if nullif(p_event->>'correlation_id', '') is not null then
        begin
            v_correlation_id := (p_event->>'correlation_id')::uuid;
        exception when invalid_text_representation then
            v_correlation_id := null;
        end;
    end if;
    if nullif(p_event->>'current_period_start', '') is not null then
        v_period_start := (p_event->>'current_period_start')::timestamptz;
    end if;
    if nullif(p_event->>'current_period_end', '') is not null then
        v_period_end := (p_event->>'current_period_end')::timestamptz;
    end if;
    if nullif(p_event->>'scheduled_change_at', '') is not null then
        v_scheduled_at := (p_event->>'scheduled_change_at')::timestamptz;
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_event_id, 0));
    select * into v_existing_event
      from public.paddle_webhook_events
     where event_id = v_event_id
     for update;

    if found then
        if v_existing_event.payload_sha256 <> v_payload_hash then
            update public.paddle_webhook_events
               set processing_status = 'failed', reason = 'payload_hash_conflict', attempts = attempts + 1
             where event_id = v_event_id;
            return jsonb_build_object('status', 'failed', 'reason', 'payload_hash_conflict');
        end if;
        if v_existing_event.processing_status in ('processed', 'ignored') then
            return jsonb_build_object('status', 'duplicate', 'user_id', v_existing_event.user_id);
        end if;
        update public.paddle_webhook_events
           set processing_status = 'processing', reason = null, attempts = attempts + 1,
               notification_id = v_notification_id
         where event_id = v_event_id;
    else
        insert into public.paddle_webhook_events (
            event_id, notification_id, event_type, occurred_at, payload_sha256, processing_status,
            subscription_id, transaction_id
        ) values (
            v_event_id, v_notification_id, v_event_type, v_occurred_at, v_payload_hash, 'processing',
            v_subscription_id, v_transaction_id
        );
    end if;

    if v_correlation_id is not null or v_transaction_id is not null then
        select user_id into v_correlation_user
          from public.billing_checkout_correlations
         where (v_correlation_id is not null and correlation_id = v_correlation_id)
            or (v_transaction_id is not null and paddle_transaction_id = v_transaction_id)
         order by created_at desc
         limit 1
         for update;
    end if;

    if v_subscription_id is not null then
        select * into v_existing_subscription
          from public.paddle_subscriptions
         where subscription_id = v_subscription_id
         for update;
        if found then
            v_user_id := v_existing_subscription.user_id;
        end if;
    end if;

    if v_user_id is not null and v_correlation_user is not null and v_user_id <> v_correlation_user then
        update public.paddle_webhook_events
           set processing_status = 'failed', reason = 'ownership_conflict', processed_at = now()
         where event_id = v_event_id;
        return jsonb_build_object('status', 'failed', 'reason', 'ownership_conflict');
    end if;
    v_user_id := coalesce(v_user_id, v_correlation_user);

    if v_event_type = 'transaction.completed' then
        if v_user_id is null then
            update public.paddle_webhook_events
               set processing_status = 'failed', reason = 'ownership_unmapped', processed_at = now()
             where event_id = v_event_id;
            return jsonb_build_object('status', 'failed', 'reason', 'ownership_unmapped');
        end if;
        update public.billing_checkout_correlations
           set status = 'confirmed', updated_at = now()
         where user_id = v_user_id
           and (correlation_id = v_correlation_id or paddle_transaction_id = v_transaction_id);
        update public.paddle_webhook_events
           set processing_status = 'processed', user_id = v_user_id, processed_at = now()
         where event_id = v_event_id;
        return jsonb_build_object('status', 'processed', 'user_id', v_user_id);
    end if;

    if v_event_type like 'subscription.%' then
        if v_subscription_id is null or v_customer_id is null
           or v_subscription_status not in ('trialing', 'active', 'past_due', 'paused', 'canceled') then
            update public.paddle_webhook_events
               set processing_status = 'failed', reason = 'invalid_subscription_snapshot', processed_at = now()
             where event_id = v_event_id;
            return jsonb_build_object('status', 'failed', 'reason', 'invalid_subscription_snapshot');
        end if;
        if v_user_id is null then
            update public.paddle_webhook_events
               set processing_status = 'failed', reason = 'ownership_unmapped', processed_at = now()
             where event_id = v_event_id;
            return jsonb_build_object('status', 'failed', 'reason', 'ownership_unmapped');
        end if;
        if v_existing_subscription.subscription_id is not null
           and (v_existing_subscription.last_event_at > v_occurred_at
                or (v_existing_subscription.last_event_at = v_occurred_at
                    and v_existing_subscription.last_event_id >= v_event_id)) then
            update public.paddle_webhook_events
               set processing_status = 'ignored', reason = 'out_of_order', user_id = v_user_id, processed_at = now()
             where event_id = v_event_id;
            return jsonb_build_object('status', 'ignored', 'reason', 'out_of_order', 'user_id', v_user_id);
        end if;

        v_access_until := case
            when v_subscription_status in ('trialing', 'active') then v_period_end
            when v_subscription_status = 'past_due' then greatest(
                coalesce(v_period_end, v_occurred_at),
                v_occurred_at + make_interval(days => v_grace_days)
            )
            else v_occurred_at
        end;

        insert into public.paddle_subscriptions (
            subscription_id, user_id, customer_id, status, price_id,
            current_period_start, current_period_end, access_until,
            scheduled_change_action, scheduled_change_at, last_transaction_id,
            last_event_id, last_event_at
        ) values (
            v_subscription_id, v_user_id, v_customer_id, v_subscription_status, v_price_id,
            v_period_start, v_period_end, v_access_until,
            v_scheduled_action, v_scheduled_at, v_transaction_id,
            v_event_id, v_occurred_at
        )
        on conflict (subscription_id) do update set
            customer_id = excluded.customer_id,
            status = excluded.status,
            price_id = coalesce(excluded.price_id, paddle_subscriptions.price_id),
            current_period_start = excluded.current_period_start,
            current_period_end = excluded.current_period_end,
            access_until = excluded.access_until,
            scheduled_change_action = excluded.scheduled_change_action,
            scheduled_change_at = excluded.scheduled_change_at,
            last_transaction_id = coalesce(excluded.last_transaction_id, paddle_subscriptions.last_transaction_id),
            last_event_id = excluded.last_event_id,
            last_event_at = excluded.last_event_at,
            updated_at = now();
    elsif v_event_type in ('adjustment.created', 'adjustment.updated') then
        if v_subscription_id is null or v_user_id is null then
            update public.paddle_webhook_events
               set processing_status = 'failed', reason = 'adjustment_unmapped', processed_at = now()
             where event_id = v_event_id;
            return jsonb_build_object('status', 'failed', 'reason', 'adjustment_unmapped');
        end if;
        if v_adjustment_status = 'approved' and v_adjustment_type = 'full'
           and v_adjustment_action in ('refund', 'chargeback') then
            update public.paddle_subscriptions set access_revoked = true, updated_at = now()
             where subscription_id = v_subscription_id;
        elsif v_adjustment_action in ('chargeback_reverse', 'credit_reverse')
              and v_adjustment_status in ('approved', 'reversed') then
            update public.paddle_subscriptions set access_revoked = false, updated_at = now()
             where subscription_id = v_subscription_id;
        end if;
    else
        update public.paddle_webhook_events
           set processing_status = 'ignored', reason = 'unsupported_event', processed_at = now()
         where event_id = v_event_id;
        return jsonb_build_object('status', 'ignored', 'reason', 'unsupported_event');
    end if;

    select max(access_until),
           case
             when bool_or(status = 'trialing' and not access_revoked and access_until > now()) then 'trialing'
             when bool_or(status = 'active' and not access_revoked and access_until > now()) then 'active'
             when bool_or(status = 'past_due' and not access_revoked and access_until > now()) then 'past_due'
             else 'inactive'
           end
      into v_entitlement_expiry, v_entitlement_status
      from public.paddle_subscriptions
     where user_id = v_user_id
       and status in ('trialing', 'active', 'past_due')
       and not access_revoked
       and access_until > now();

    if v_entitlement_status in ('trialing', 'active', 'past_due') then
        insert into public.user_plan (
            user_id, plan, status, expires_at, source, paddle_subscription_id, verified_at
        ) values (
            v_user_id, 'premium', v_entitlement_status, v_entitlement_expiry, 'paddle',
            v_subscription_id, now()
        )
        on conflict (user_id) do update set
            plan = excluded.plan,
            status = excluded.status,
            expires_at = excluded.expires_at,
            source = excluded.source,
            paddle_subscription_id = excluded.paddle_subscription_id,
            verified_at = excluded.verified_at;
    else
        update public.user_plan
           set plan = 'free', status = 'inactive', expires_at = null,
               paddle_subscription_id = null, verified_at = now()
         where user_id = v_user_id and source = 'paddle';
    end if;

    update public.paddle_webhook_events
       set processing_status = 'processed', reason = null, user_id = v_user_id, processed_at = now()
     where event_id = v_event_id;
    return jsonb_build_object('status', 'processed', 'user_id', v_user_id);
exception when others then
    raise;
end;
$$;

revoke all on function public.process_paddle_billing_event(jsonb) from public, anon, authenticated;
grant execute on function public.process_paddle_billing_event(jsonb) to service_role;

commit;
