-- Storage configuration for dispute-evidence photos (issue #151)
--
-- These uploads can contain personal data (dive-computer screens with GPS,
-- names, timestamps). They used to live in a PUBLIC bucket at a guessable path
-- (`<user-uuid>/<millisecond-timestamp>.<ext>`), so anyone with the link — or
-- anyone enumerating the timestamp — could read them, and user UUIDs leaked
-- into URLs.
--
-- The app now (a) makes the bucket PRIVATE, (b) uses random UUID object keys,
-- and (c) reads only via short-lived signed URLs. This file locks the bucket
-- down to match. Run it once against the Supabase project (SQL editor or a
-- migration); it is idempotent.

-- 1. Ensure the bucket exists and is private.
insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', false)
on conflict (id) do update set public = false;

-- 2. Replace any prior policies for this bucket so the state is deterministic.
drop policy if exists "dispute-evidence: owner can upload" on storage.objects;
drop policy if exists "dispute-evidence: owner can read" on storage.objects;
drop policy if exists "dispute-evidence: owner can delete" on storage.objects;
drop policy if exists "dispute-evidence: admins can read" on storage.objects;

-- 3. Authenticated users may upload to this bucket. Supabase stamps
--    storage.objects.owner with auth.uid() on insert, which the read policy
--    below keys off.
create policy "dispute-evidence: owner can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'dispute-evidence');

-- 4. The uploader may read their own objects. createSignedUrl() runs under the
--    caller's RLS, so this is what lets the client mint the signed URL it hands
--    to the backend for AI analysis. No public/anon read is granted.
create policy "dispute-evidence: owner can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'dispute-evidence' and owner = auth.uid());

-- 5. The uploader may delete their own objects (e.g. retention cleanup).
create policy "dispute-evidence: owner can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'dispute-evidence' and owner = auth.uid());

-- 6. OPTIONAL — dispute reviewers/admins read access. Enable once an admin
--    review UI exists. This mirrors the server-verified admin model from the
--    auth work (app_metadata role), rather than a client flag. Uncomment to use:
--
-- create policy "dispute-evidence: admins can read"
--   on storage.objects for select to authenticated
--   using (
--     bucket_id = 'dispute-evidence'
--     and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
--   );
