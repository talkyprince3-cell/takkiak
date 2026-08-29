-- Buckets.
--
-- Deposit screenshots are private: they are a player's payment record, read
-- only by the operator through short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('deposit-screenshots', 'deposit-screenshots', false)
on conflict (id) do nothing;

-- Team crests are public: they are rendered on the board for every visitor, and
-- signing a URL per crest per page view would be pure waste. Nothing private
-- goes in here.
insert into storage.buckets (id, name, public)
values ('team-crests', 'team-crests', true)
on conflict (id) do update set public = true;

-- Anyone may read a crest; only the service role writes one, and it is the only
-- key the server holds, so no write policy is needed for the app itself.
do $$ begin
  create policy "team crests are publicly readable"
    on storage.objects for select
    using (bucket_id = 'team-crests');
exception when duplicate_object then null; end $$;
