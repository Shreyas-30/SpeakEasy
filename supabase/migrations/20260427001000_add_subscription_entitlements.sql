create table if not exists public.subscription_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free'
    check (plan_id in ('free', 'plus', 'pro')),
  status text not null default 'free'
    check (status in ('free', 'active', 'trialing', 'past_due', 'expired')),
  provider text not null default 'mock'
    check (provider in ('mock', 'revenuecat', 'stripe', 'app_store', 'play_store')),
  renews_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscription_entitlements enable row level security;

create policy "Users can read own subscription entitlement"
  on public.subscription_entitlements for select
  using (user_id = auth.uid());

-- No client insert/update/delete policies by design.
-- Future payment webhooks or backend jobs should write this table with the Supabase service role.
