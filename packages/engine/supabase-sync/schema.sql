-- supabase-sync schema: audit trail for OpenEMR referral-intake runs.
-- Apply once: Supabase dashboard -> SQL Editor -> paste this file -> Run. Idempotent.

create table if not exists public.runs (
  id            text primary key,            -- test-runner run id, e.g. 2026-09-19_123032
  intake_id     text,                        -- automation-server /intake id, if the run came from /intake
  site          text not null,               -- OpenEMR base URL the run wrote to
  started_at    timestamptz,
  finished_at   timestamptz,
  totals        jsonb,                       -- items, steps, steps_confirmed, headline, ...
  public_url    text,                        -- public review page in Storage bucket demo-runs
  synced_at     timestamptz not null default now()
);

create table if not exists public.referrals (
  run_id        text not null references public.runs(id) on delete cascade,
  referral      text not null,               -- item id, e.g. r01
  file          text not null,               -- referral-01.pdf
  patient_last  text,                        -- always HACKDEMO-... (sync refuses anything else)
  extracted     jsonb,                       -- fields extracted from the PDF
  triage_flags  jsonb,                       -- triage flags (URGENT, MISSING_FIELD, DUPLICATE, ...)
  status        text,                        -- Confirmed ✓ / Hypothesis ? / Needs Mary
  primary key (run_id, referral)
);

create table if not exists public.steps (
  run_id        text not null references public.runs(id) on delete cascade,
  referral      text not null,               -- r01 ... or 'setup'
  step          text not null,               -- patient / insurance / document / appointment / login
  status        text not null,               -- ✓ or ?
  status_text   text,                        -- full status, e.g. "Confirmed ✓"
  readback      text,                        -- what the verify step read back from OpenEMR after a fresh load
  seconds       numeric,
  primary key (run_id, referral, step)
);

create table if not exists public.reviews (
  run_id        text not null references public.runs(id) on delete cascade,
  referral      text not null,               -- file name, e.g. referral-01.pdf
  verdict       text not null check (verdict in ('looks_right','something_wrong')),
  note          text,
  at            timestamptz not null default now(),
  primary key (run_id, referral)
);

-- Service-role key bypasses RLS; enable RLS with no policies so the anon key cannot read or write.
alter table public.runs      enable row level security;
alter table public.referrals enable row level security;
alter table public.steps     enable row level security;
alter table public.reviews   enable row level security;

-- Public Storage bucket for the standalone review pages (sync also creates it via the Storage API).
insert into storage.buckets (id, name, public) values ('demo-runs', 'demo-runs', true)
on conflict (id) do update set public = true;

-- Make PostgREST see the new tables immediately.
notify pgrst, 'reload schema';
