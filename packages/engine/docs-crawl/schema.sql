-- docs-crawl schema (Supabase / Postgres). Paste into the Supabase SQL editor once.
-- Keyword search only: Postgres full-text search (tsvector), no LLM / embeddings.
create table if not exists public.docs (
  url        text primary key,
  title      text,
  text       text not null,
  crawled_at timestamptz default now(),
  run_id     text
);

create table if not exists public.doc_passages (
  id      bigserial primary key,
  url     text not null references public.docs(url) on delete cascade,
  title   text,
  seq     int  not null,
  passage text not null,
  fts     tsvector generated always as (
            setweight(to_tsvector('english', coalesce(title,'')), 'B') ||
            setweight(to_tsvector('english', passage), 'A')) stored,
  unique (url, seq)
);
create index if not exists doc_passages_fts_idx on public.doc_passages using gin (fts);

-- Page-level tsvector too (spec: 'docs' table with tsvector)
alter table public.docs add column if not exists fts tsvector
  generated always as (to_tsvector('english', coalesce(title,'') || ' ' || text)) stored;
create index if not exists docs_fts_idx on public.docs using gin (fts);

-- RPC used by docs-search: top-N passages. Query words are OR-ed (websearch AND is too strict
-- for short passages); ranking by ts_rank_cd rewards passages that match more of the words.
create or replace function public.search_docs(q text, n int default 3)
returns table (url text, title text, passage text, rank real)
language sql stable as $$
  with terms as (
    select to_tsquery('english',
      array_to_string(array(select quote_literal(w) || ':*'
        from regexp_split_to_table(lower(q), '[^a-z0-9]+') w
        where length(w) > 1 and to_tsvector('english', w) <> ''::tsvector), ' | ')) as tq
  )
  select p.url, p.title, p.passage,
         (ts_rank_cd(p.fts, t.tq, 32) * (1 + ts_rank(p.fts, t.tq)))::real as rank
  from public.doc_passages p, terms t
  where p.fts @@ t.tq
  order by rank desc
  limit n;
$$;
