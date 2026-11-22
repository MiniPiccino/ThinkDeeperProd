begin;

create or replace function public.reserve_paddle_checkout(
    p_user_id uuid,
    p_price_id text,
    p_correlation_id uuid,
    p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_existing public.billing_checkout_correlations%rowtype;
    v_subscription_id text;
begin
    if p_user_id is null or nullif(p_price_id, '') is null
       or p_correlation_id is null or p_expires_at <= now() then
        raise exception 'invalid_checkout_reservation';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    select paddle_subscription_id into v_subscription_id
      from public.user_plan
     where user_id = p_user_id
       and plan = 'premium'
       and coalesce(status, 'legacy') in ('active', 'trialing', 'past_due', 'legacy')
       and (expires_at is null or expires_at > now())
     limit 1;

    if found then
        return jsonb_build_object(
            'status', 'active_subscription',
            'subscription_id', v_subscription_id
        );
    end if;

    select subscription_id into v_subscription_id
      from public.paddle_subscriptions
     where user_id = p_user_id
       and status in ('active', 'trialing', 'past_due')
       and not access_revoked
       and access_until > now()
     order by access_until desc
     limit 1;

    if found then
        return jsonb_build_object(
            'status', 'active_subscription',
            'subscription_id', v_subscription_id
        );
    end if;

    update public.billing_checkout_correlations
       set status = 'expired', updated_at = now()
     where user_id = p_user_id
       and status in ('pending', 'linked')
       and expires_at <= now();

    select * into v_existing
      from public.billing_checkout_correlations
     where user_id = p_user_id
       and status in ('pending', 'linked')
       and expires_at > now()
     order by created_at desc
     limit 1
     for update;

    if found then
        return jsonb_build_object(
            'status', 'existing',
            'correlation_id', v_existing.correlation_id,
            'price_id', v_existing.price_id,
            'paddle_transaction_id', v_existing.paddle_transaction_id,
            'checkout_status', v_existing.status,
            'expires_at', v_existing.expires_at
        );
    end if;

    insert into public.billing_checkout_correlations (
        correlation_id, user_id, price_id, status, expires_at
    ) values (
        p_correlation_id, p_user_id, p_price_id, 'pending', p_expires_at
    ) returning * into v_existing;

    return jsonb_build_object(
        'status', 'created',
        'correlation_id', v_existing.correlation_id,
        'price_id', v_existing.price_id,
        'paddle_transaction_id', v_existing.paddle_transaction_id,
        'checkout_status', v_existing.status,
        'expires_at', v_existing.expires_at
    );
end;
$$;

revoke all on function public.reserve_paddle_checkout(uuid, text, uuid, timestamptz)
    from public, anon, authenticated;
grant execute on function public.reserve_paddle_checkout(uuid, text, uuid, timestamptz)
    to service_role;

commit;
