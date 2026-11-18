# AI evaluation security and quality

## Request architecture

`POST /v1/answers` validates the Supabase JWT, bounds the JSON fields and body, verifies the server's current daily question, and claims `(user_id, question_id)` before OpenAI is called. A unique PostgreSQL reservation prevents concurrent workers from evaluating the same reflection twice. Structured feedback is then generated once and `finalize_answer_submission` inserts the answer and mutates XP/streak in one transaction.

Local JSON mode uses an in-process user lock and reservation and is development-only. Configured Supabase answer reads/writes fail closed; they no longer silently divert private reflections to JSON files.

Client `durationSeconds` is bounded and retained only as approximate telemetry. It is not sent to the model and does not influence XP, streak, eligibility, or feedback.

## Evaluation rubric

The model returns a strict JSON schema with four independently anchored 0–3 dimensions:

| Dimension | Meaning |
| --- | --- |
| Reasoning depth | Reasons, causal links, implications, or meaningful examination |
| Clarity | The view and its connection to the prompt can be understood |
| Alternatives | Trade-offs, uncertainty, counterpoints, or another plausible view where relevant |
| Evidence/justification | A reason, example, experience, observation, or evidence when relevant |

The prompt protects short, non-English, dissenting, and unconventional answers from automatic penalty. User content is JSON-delimited untrusted data. Embedded instructions cannot alter the rubric. Feedback is limited to one grounded strength and one constructive next step; diagnosis, personality/intelligence inference, mental-state claims, and protected-trait inference are forbidden.

## XP integrity

Valid daily participation earns 10 base XP. A deterministic server calculation adds at most 3 engagement XP from the four rubric scores, then applies the existing day difficulty multiplier. The existing 25-XP weekly completion bonus and historical totals are preserved. The model never emits XP.

If OpenAI fails, times out, refuses, or returns malformed output, Thinkle persists the reflection with neutral fallback feedback and zero engagement bonus. This preserves the daily ritual without fabricating an assessment or allowing retry-based cost farming.

## Rate and cost protection

- one durable submission/evaluation per user and daily question;
- three attempts per user per five minutes per backend process;
- 60 evaluation attempts per minute per process;
- eight concurrent evaluations per process;
- 4,000 answer characters, 16 KiB declared request body, and 220 output tokens;
- 12-second provider timeout and one bounded SDK retry.

The in-memory budgets are defense in depth, not a distributed quota. Multi-instance production should add a gateway or shared limiter. The durable reservation remains the cross-instance duplicate/cost control.

## Benchmark

`tests/fixtures/evaluation_benchmark.json` contains synthetic short thoughtful, long meaningless, contradictory, strong, weak, non-English, injection, empty, and malformed cases. Routine tests mock OpenAI and validate schema, prompt boundaries, fallback behavior, duplicate races, daily-question enforcement, and deterministic XP. No real reflection or live API call is included.

A live benchmark requires separate approval, a fixed case/model/token budget, sandbox credentials, and recorded latency/token/cost ceilings. Human labels are still required before using the dataset to claim comparative fairness or model quality.

## API behavior changes

- Non-current question IDs return `422`.
- Empty/whitespace, overlong, extra-field, or malformed bodies return `422`; declared bodies over 16 KiB return `413`.
- Duplicate daily submissions return `409` before OpenAI.
- Local capacity/rate exhaustion returns `429`.
- Unsafe persistence failure returns `503` without provider/database detail.
- Successful response shape is unchanged. XP amounts may differ because XP is no longer selected by the model or influenced by reported duration.

## Deployment and rollback

1. Apply `202611120002_secure_ai_evaluation.sql` to a schema clone after the Phase 3 migration.
2. Verify existing `answers` and `user_progress` column types match the RPC, and test rollback in a transaction.
3. Test two-worker concurrent submissions and forced OpenAI/database failures.
4. Configure limits and alert on 429, fallback rate, 503, latency, and token usage without logging reflection text.
5. Deploy backend before relying on the reservation table; frontend requires no UI redesign.

Rollback the application first while retaining the reservation table for audit. Do not drop it until pending/finalized submissions have been reconciled. Existing progress rows are never rewritten by this migration.

## Remaining risks

- The migration has not been exercised against a disposable Supabase schema.
- In-memory rate limits are per process and lose counters on restart.
- A crashed pending reservation becomes reclaimable after two minutes and may cause one additional provider call; finalization uniqueness still prevents duplicate XP.
- Automated fixtures validate mechanics, not cultural/language fairness. Human-rated multilingual benchmarking is required.
- Provider safety refusals use neutral fallback rather than specialized crisis handling.
- Phase 3 database migration and Paddle sandbox end-to-end testing remain incomplete; the product is not production-ready.
