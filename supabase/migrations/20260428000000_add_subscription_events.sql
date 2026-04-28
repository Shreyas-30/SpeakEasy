create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  event_type text not null check (
    event_type in (
      'plan_cta_tap',
      'restore_tap',
      'mock_entitlement_granted'
    )
  ),
  plan_id text check (plan_id in ('free', 'plus', 'pro')),
  source text not null default 'app',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.subscription_events enable row level security;

create policy "Clients can log subscription intent events"
  on public.subscription_events for insert
  with check (user_id is null or user_id = auth.uid());

create index if not exists subscription_events_type_created_idx
  on public.subscription_events (event_type, created_at desc);

create index if not exists subscription_events_plan_created_idx
  on public.subscription_events (plan_id, created_at desc);
