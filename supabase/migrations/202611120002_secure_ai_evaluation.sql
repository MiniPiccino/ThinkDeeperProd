begin;

create table if not exists public.answer_submission_reservations (
    user_id uuid not null references auth.users(id) on delete restrict,
    question_id text not null,
    status text not null check (status in ('pending', 'finalized', 'failed')),
    reserved_at timestamptz not null default now(),
    finalized_at timestamptz,
    primary key (user_id, question_id)
);

alter table public.answer_submission_reservations enable row level security;
revoke all on public.answer_submission_reservations from anon, authenticated;

create or replace function public.reserve_answer_submission(p_user_id uuid, p_question_id text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_claimed boolean;
begin
    if p_question_id is null or length(p_question_id) > 100 then return false; end if;
    insert into public.answer_submission_reservations(user_id, question_id, status)
    values (p_user_id, p_question_id, 'pending')
    on conflict (user_id, question_id) do update
      set status = 'pending', reserved_at = now()
      where answer_submission_reservations.status = 'failed'
         or (answer_submission_reservations.status = 'pending'
             and answer_submission_reservations.reserved_at < now() - interval '2 minutes')
    returning true into v_claimed;
    return coalesce(v_claimed, false);
end;
$$;

create or replace function public.release_answer_submission(p_user_id uuid, p_question_id text)
returns void
language sql security definer set search_path = public, pg_temp
as $$
    update public.answer_submission_reservations
       set status = 'failed'
     where user_id = p_user_id and question_id = p_question_id and status = 'pending';
$$;

create or replace function public.finalize_answer_submission(p_answer jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
    v_user_id uuid := (p_answer->>'user_id')::uuid;
    v_question_id text := p_answer->>'question_id';
    v_xp integer := least(greatest((p_answer->>'xp_awarded')::integer, 0), 100);
    v_created_at timestamptz := (p_answer->>'created_at')::timestamptz;
    v_progress public.user_progress%rowtype;
    v_previous_date date;
    v_streak integer;
begin
    if length(coalesce(p_answer->>'answer', '')) not between 1 and 4000 then
        raise exception 'invalid_answer_length';
    end if;
    perform 1 from public.answer_submission_reservations
     where user_id = v_user_id and question_id = v_question_id and status = 'pending'
     for update;
    if not found then raise exception 'submission_not_reserved'; end if;

    select * into v_progress from public.user_progress where user_id = v_user_id for update;
    if found then
        v_previous_date := v_progress.last_answered_on::timestamptz::date;
        v_streak := case
          when v_previous_date = v_created_at::date then greatest(coalesce(v_progress.streak, 0), 1)
          when v_previous_date = v_created_at::date - 1 then greatest(coalesce(v_progress.streak, 0), 1) + 1
          else 1 end;
        update public.user_progress
           set xp_total = coalesce(v_progress.xp_total, 0) + v_xp, streak = v_streak,
               last_answered_on = v_created_at
         where user_id = v_user_id returning * into v_progress;
    else
        insert into public.user_progress(user_id, xp_total, streak, last_answered_on)
        values (v_user_id, v_xp, 1, v_created_at) returning * into v_progress;
    end if;

    insert into public.answers(
        user_id, question_id, answer, feedback, xp_awarded, xp_total, streak,
        created_at, duration_seconds, week_index
    ) values (
        v_user_id, v_question_id, p_answer->>'answer', p_answer->>'feedback', v_xp,
        v_progress.xp_total, v_progress.streak, v_created_at,
        (p_answer->>'duration_seconds')::integer, (p_answer->>'week_index')::integer
    );

    update public.answer_submission_reservations
       set status = 'finalized', finalized_at = now()
     where user_id = v_user_id and question_id = v_question_id;
    return jsonb_build_object('xp_total', v_progress.xp_total, 'streak', v_progress.streak);
end;
$$;

revoke all on function public.reserve_answer_submission(uuid, text) from public, anon, authenticated;
revoke all on function public.release_answer_submission(uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_answer_submission(jsonb) from public, anon, authenticated;
grant execute on function public.reserve_answer_submission(uuid, text) to service_role;
grant execute on function public.release_answer_submission(uuid, text) to service_role;
grant execute on function public.finalize_answer_submission(jsonb) to service_role;

commit;
