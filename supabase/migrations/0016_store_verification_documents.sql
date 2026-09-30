-- CR/VAT registration copies for admin to verify a store application.
-- Private bucket (unlike product-images) since these are business/legal
-- documents, not public catalog content — only the applicant and admins
-- can read them.
insert into storage.buckets (id, name, public)
values ('store-documents', 'store-documents', false)
on conflict (id) do nothing;

create policy "applicants upload own store documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'store-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners and admins read store documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'store-documents'
  and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
);

create policy "applicants delete own store documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'store-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter table stores add column cr_document_path text;
alter table stores add column vat_document_path text;
