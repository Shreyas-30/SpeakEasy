create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  native_language text,
  target_language text not null default 'en',
  selected_voice_id text,
  selected_voice_name text,
  has_completed_onboarding boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null,
  topic_name text not null,
  is_custom boolean not null default false,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id)
);

create table if not exists public.saved_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  title text not null,
  image_url text not null,
  topic text not null,
  topic_id text not null,
  topic_color text not null,
  difficulty text not null,
  read_time integer not null,
  published_at_label text not null,
  content text not null,
  url text,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, article_id)
);

create table if not exists public.liked_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  title text not null,
  image_url text not null,
  topic text not null,
  topic_id text not null,
  topic_color text not null,
  difficulty text not null,
  read_time integer not null,
  published_at_label text not null,
  content text not null,
  url text,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, article_id)
);

create table if not exists public.saved_vocab (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  definition text not null,
  context text not null,
  article_id text not null,
  saved_at_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.article_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  topic_id text not null,
  source text not null,
  difficulty text not null,
  event_type text not null check (
    event_type in (
      'article_open',
      'article_like',
      'article_save',
      'article_share',
      'full_article_open',
      'listen_start',
      'discuss_start',
      'vocab_lookup',
      'vocab_save'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_topics enable row level security;
alter table public.saved_articles enable row level security;
alter table public.liked_articles enable row level security;
alter table public.saved_vocab enable row level security;
alter table public.article_events enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Users can delete own profile"
  on public.profiles for delete
  using (id = auth.uid());

create policy "Users can read own topics"
  on public.user_topics for select
  using (user_id = auth.uid());

create policy "Users can insert own topics"
  on public.user_topics for insert
  with check (user_id = auth.uid());

create policy "Users can update own topics"
  on public.user_topics for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own topics"
  on public.user_topics for delete
  using (user_id = auth.uid());

create policy "Users can read own saved articles"
  on public.saved_articles for select
  using (user_id = auth.uid());

create policy "Users can insert own saved articles"
  on public.saved_articles for insert
  with check (user_id = auth.uid());

create policy "Users can update own saved articles"
  on public.saved_articles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own saved articles"
  on public.saved_articles for delete
  using (user_id = auth.uid());

create policy "Users can read own liked articles"
  on public.liked_articles for select
  using (user_id = auth.uid());

create policy "Users can insert own liked articles"
  on public.liked_articles for insert
  with check (user_id = auth.uid());

create policy "Users can update own liked articles"
  on public.liked_articles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own liked articles"
  on public.liked_articles for delete
  using (user_id = auth.uid());

create policy "Users can read own saved vocab"
  on public.saved_vocab for select
  using (user_id = auth.uid());

create policy "Users can insert own saved vocab"
  on public.saved_vocab for insert
  with check (user_id = auth.uid());

create policy "Users can update own saved vocab"
  on public.saved_vocab for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own saved vocab"
  on public.saved_vocab for delete
  using (user_id = auth.uid());

create policy "Users can read own article events"
  on public.article_events for select
  using (user_id = auth.uid());

create policy "Users can insert own article events"
  on public.article_events for insert
  with check (user_id = auth.uid());
