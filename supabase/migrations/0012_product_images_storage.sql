-- Public bucket for product photos. Anyone can view (product images are
-- public catalog content); only the uploader can write into their own
-- folder, keyed by auth.uid() rather than store id so the policy doesn't
-- need a join and stays valid even for admins uploading on a store's behalf.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "anyone can view product images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "authenticated users upload to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "authenticated users manage own uploads"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "authenticated users delete own uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
