begin;

alter table public.answers
    add column if not exists question_instance_id text,
    add column if not exists catalog_question_id text,
    add column if not exists question_date date,
    add column if not exists question_text text,
    add column if not exists question_theme text,
    add column if not exists difficulty_label text,
    add column if not exists difficulty_score integer,
    add column if not exists difficulty_multiplier numeric,
    add column if not exists catalog_version text,
    add column if not exists week_instance_id text;

alter table public.user_progress
    add column if not exists last_answered_date date;

alter table public.badges
    add column if not exists week_instance_id text;

create unique index if not exists answers_user_question_instance_unique
    on public.answers(user_id, question_instance_id)
    where question_instance_id is not null;
create unique index if not exists answers_user_question_date_unique
    on public.answers(user_id, question_date)
    where question_date is not null;
create index if not exists answers_user_week_instance_idx
    on public.answers(user_id, week_instance_id, question_date)
    where week_instance_id is not null;

create or replace view public.legacy_answer_calendar_review as
select
    user_id,
    question_id as legacy_question_id,
    created_at,
    case
      when question_id ~ '^week-[0-9]+-day-[1-7]$' then 'ambiguous_legacy_catalog_id'
      else 'unknown_question_id'
    end as migration_status
from public.answers
where question_instance_id is null;

revoke all on public.legacy_answer_calendar_review from anon, authenticated;

create or replace function public.finalize_answer_submission(p_answer jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
    v_user_id uuid := (p_answer->>'user_id')::uuid;
    v_question_id text := p_answer->>'question_id';
    v_instance_id text := p_answer->>'question_instance_id';
    v_question_date date := (p_answer->>'question_date')::date;
    v_xp integer := least(greatest((p_answer->>'xp_awarded')::integer, 0), 100);
    v_created_at timestamptz := (p_answer->>'created_at')::timestamptz;
    v_progress public.user_progress%rowtype;
    v_previous_date date;
    v_streak integer;
begin
    if v_instance_id is null or v_instance_id <> v_question_id
       or length(coalesce(p_answer->>'answer', '')) not between 1 and 4000
       or length(coalesce(p_answer->>'question_text', '')) = 0
       or nullif(p_answer->>'catalog_version', '') is null then
        raise exception 'invalid_dated_answer';
    end if;

    perform 1 from public.answer_submission_reservations
     where user_id = v_user_id and question_id = v_instance_id and status = 'pending'
     for update;
    if not found then raise exception 'submission_not_reserved'; end if;

    if exists (
        select 1 from public.answers
         where user_id = v_user_id and question_instance_id = v_instance_id
    ) then raise exception 'question_instance_already_answered'; end if;

    select * into v_progress from public.user_progress where user_id = v_user_id for update;
    if found then
        v_previous_date := coalesce(
            v_progress.last_answered_date,
            v_progress.last_answered_on::timestamptz::date
        );
        v_streak := case
          when v_previous_date = v_question_date then greatest(coalesce(v_progress.streak, 0), 1)
          when v_previous_date = v_question_date - 1 then greatest(coalesce(v_progress.streak, 0), 1) + 1
          else 1 end;
        update public.user_progress
           set xp_total = coalesce(v_progress.xp_total, 0) + v_xp,
               streak = v_streak,
               last_answered_on = v_created_at,
               last_answered_date = v_question_date
         where user_id = v_user_id returning * into v_progress;
    else
        insert into public.user_progress(
            user_id, xp_total, streak, last_answered_on, last_answered_date
        ) values (
            v_user_id, v_xp, 1, v_created_at, v_question_date
        ) returning * into v_progress;
    end if;

    insert into public.answers(
        user_id, question_id, question_instance_id, catalog_question_id,
        question_date, question_text, question_theme, difficulty_label,
        difficulty_score, difficulty_multiplier, catalog_version, week_instance_id,
        answer, feedback, xp_awarded, xp_total, streak, created_at,
        duration_seconds, week_index
    ) values (
        v_user_id, v_instance_id, v_instance_id, p_answer->>'catalog_question_id',
        v_question_date, p_answer->>'question_text', p_answer->>'question_theme',
        p_answer->>'difficulty_label', (p_answer->>'difficulty_score')::integer,
        (p_answer->>'difficulty_multiplier')::numeric, p_answer->>'catalog_version',
        p_answer->>'week_instance_id', p_answer->>'answer', p_answer->>'feedback',
        v_xp, v_progress.xp_total, v_progress.streak, v_created_at,
        (p_answer->>'duration_seconds')::integer, (p_answer->>'week_index')::integer
    );

    update public.answer_submission_reservations
       set status = 'finalized', finalized_at = now()
     where user_id = v_user_id and question_id = v_instance_id;
    return jsonb_build_object('xp_total', v_progress.xp_total, 'streak', v_progress.streak);
end;
$$;

revoke all on function public.finalize_answer_submission(jsonb) from public, anon, authenticated;
grant execute on function public.finalize_answer_submission(jsonb) to service_role;

commit;
