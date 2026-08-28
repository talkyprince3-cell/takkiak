-- Betlixx: all migrations concatenated. Idempotent, safe to re-run.
-- Generated from supabase/migrations/ — do not edit by hand.

-- ============ 0001_users.sql ============
-- Players. Country drives currency, KYC shape, gateway and payout rail.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  email text unique,
  password_hash text not null,
  country_code text not null,
  currency text not null,
  kyc_value text,
  balance numeric(14,2) not null default 0,
  total_deposited numeric(14,2) not null default 0,
  total_withdrawn numeric(14,2) not null default 0,
  verification_step smallint not null default 0,
  qualifying_deposits smallint not null default 0,
  withdrawal_approved boolean not null default false,
  first_deposit_at timestamptz,
  bonus_paid boolean not null default false,
  referred_by uuid,
  payout_number text,
  payout_bank text,
  created_at timestamptz not null default now()
);

create index if not exists users_referred_by_idx on users (referred_by);
create index if not exists users_country_idx on users (country_code);

-- ============ 0002_partners.sql ============
-- Referral partners. Balances are held per currency, never summed across markets.
create table if not exists sub_admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  password_hash text not null,
  referral_code text not null unique,
  approved boolean not null default false,
  balances jsonb not null default '{}'::jsonb,
  lifetime jsonb not null default '{}'::jsonb,
  payout_name text,
  payout_network text,
  payout_number text,
  created_at timestamptz not null default now()
);

-- One row per commission payment, for audit and backfill.
create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  sub_admin_id uuid not null references sub_admins(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  payment_reference text,
  deposit_amount numeric(14,2) not null,
  currency text not null,
  rate numeric(5,4) not null,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists commissions_sub_admin_idx on commissions (sub_admin_id);
create unique index if not exists commissions_reference_key
  on commissions (payment_reference) where payment_reference is not null;

do $$ begin
  alter table users add constraint users_referred_by_fkey
    foreign key (referred_by) references sub_admins(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ============ 0003_bets.sql ============
-- One row per ticket.
create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  stake numeric(14,2) not null,
  total_odds numeric(10,3) not null,
  potential_win numeric(14,2) not null,
  currency text not null,
  status text not null default 'pending',
  payout numeric(14,2),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bets_status_chk check (status in ('pending','won','lost','void'))
);

create index if not exists bets_user_idx on bets (user_id, created_at desc);
create index if not exists bets_status_idx on bets (status);

-- One row per leg.
create table if not exists bet_selections (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references bets(id) on delete cascade,
  match_id text not null,
  home_team text not null,
  away_team text not null,
  league text,
  market text not null,
  outcome text not null,
  odds numeric(10,3) not null,
  result text not null default 'pending',
  constraint bet_selections_result_chk check (result in ('pending','won','lost','void'))
);

create index if not exists bet_selections_bet_idx on bet_selections (bet_id);

-- ============ 0004_matches.sql ============
-- Operator-created fixtures, fully under operator control.
create table if not exists custom_matches (
  id uuid primary key default gen_random_uuid(),
  home_team text not null,
  away_team text not null,
  home_crest text,
  away_crest text,
  league text not null default 'Betlixx Special',
  sport text not null default 'football',
  kickoff timestamptz not null,
  odds_home numeric(10,3) not null,
  odds_draw numeric(10,3) not null,
  odds_away numeric(10,3) not null,
  goal_timeline jsonb not null default '[]'::jsonb,
  is_live boolean not null default false,
  is_locked boolean not null default false,
  best_odds boolean not null default false,
  final_home smallint,
  final_away smallint,
  finished boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists custom_matches_kickoff_idx on custom_matches (kickoff);

-- Operator corrections layered over upstream API fixtures.
create table if not exists match_overrides (
  match_id text primary key,
  score_home smallint,
  score_away smallint,
  minute smallint,
  is_live boolean,
  is_locked boolean,
  postponed boolean,
  updated_at timestamptz not null default now()
);

-- ============ 0005_payments.sql ============
-- Every deposit and withdrawal attempt across every rail.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  amount numeric(14,2) not null,
  currency text not null,
  provider text not null,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint payments_status_chk check (status in ('pending','confirmed','failed','resolved'))
);

create index if not exists payments_user_idx on payments (user_id, created_at desc);
create index if not exists payments_status_idx on payments (status);
create index if not exists payments_type_idx on payments ((metadata->>'type'));

-- Saved slips, shareable by code.
create table if not exists bookings (
  code text primary key,
  selections jsonb not null,
  created_by uuid references users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ 0006_settings_push.sql ============
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- Last score alerted per match, so a goal is never announced twice.
create table if not exists goal_notifications (
  match_id text primary key,
  last_home smallint not null default 0,
  last_away smallint not null default 0,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values
  ('deposit_account_name', 'Betlixx Ghana'),
  ('deposit_account_number', '0244000000'),
  ('deposit_account_network', 'MTN Mobile Money')
on conflict (key) do nothing;

-- ============ 0007_selection_context.sql ============
-- Match context on each leg, so a settled ticket can show the player how the
-- match actually finished rather than only a green or red dot.
alter table bet_selections add column if not exists sport text not null default 'football';
alter table bet_selections add column if not exists kickoff timestamptz;
alter table bet_selections add column if not exists final_home smallint;
alter table bet_selections add column if not exists final_away smallint;

