-- Supabase Storage setup for product image uploads
-- Bucket: product-images
-- Path format enforced in policy: storeId/productId/filename

begin;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update
set public = excluded.public,
    name = excluded.name;

-- Remove older versions if they exist
drop policy if exists "product_images_public_read" on storage.objects;
drop policy if exists "product_images_store_owner_upload" on storage.objects;
drop policy if exists "product_images_store_owner_update" on storage.objects;
drop policy if exists "product_images_store_owner_delete" on storage.objects;

-- Public read is allowed for product image URLs
create policy "product_images_public_read"
on storage.objects
for select
to public
using (bucket_id = 'product-images');

-- Only store owners can upload objects under storeId/productId/filename
create policy "product_images_store_owner_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and array_length(storage.foldername(name), 1) >= 2
  and exists (
    select 1
    from public.stores s
    where s.id::text = (storage.foldername(name))[1]
      and s.owner_id = auth.uid()
  )
);

-- Only the owning store owner can update files in their store folder
create policy "product_images_store_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.stores s
    where s.id::text = (storage.foldername(name))[1]
      and s.owner_id = auth.uid()
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.stores s
    where s.id::text = (storage.foldername(name))[1]
      and s.owner_id = auth.uid()
  )
);

-- Only the owning store owner can delete files in their store folder
create policy "product_images_store_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.stores s
    where s.id::text = (storage.foldername(name))[1]
      and s.owner_id = auth.uid()
  )
);

commit;
