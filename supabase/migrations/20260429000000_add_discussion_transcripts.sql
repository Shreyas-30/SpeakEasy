create table if not exists public.discussion_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  article_title text not null,
  article_source text,
  topic_id text,
  difficulty text,
  created_at timestamptz not null default now()
);

create table if not exists public.discussion_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.discussion_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.discussion_sessions enable row level security;
alter table public.discussion_messages enable row level security;

create policy "Users can manage their discussion sessions"
  on public.discussion_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their discussion messages"
  on public.discussion_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists discussion_sessions_user_created_idx
  on public.discussion_sessions(user_id, created_at desc);

create index if not exists discussion_messages_session_created_idx
  on public.discussion_messages(session_id, created_at);
