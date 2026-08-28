-- Private bucket for manual-deposit screenshots.
-- The app reads and writes it with the service-role key and hands the operator
-- short-lived signed URLs, so no public policy is needed or wanted.
insert into storage.buckets (id, name, public)
values ('deposit-screenshots', 'deposit-screenshots', false)
on conflict (id) do nothing;
