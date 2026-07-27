-- Bucket + políticas para a prova documental dos co-residentes.
-- O titular do endereço (dono do afroloc_record) pode carregar/ver/gerir os
-- documentos de QUALQUER co-residente da sua residência — incl. membros
-- registados só por nome (sem conta própria). O próprio co-residente (quando
-- tem conta) também pode gerir os seus. As autoridades podem ver/atualizar.
--
-- Caminho dos ficheiros: '<resident_id>/<tipo>_<timestamp>.<ext>'
-- => (storage.foldername(name))[1] = resident_id

-- Bucket privado (nunca público), 10MB, imagens + PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resident-documents',
  'resident-documents',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','application/pdf'];

-- Predicado partilhado: quem pode tocar nos documentos deste resident_id.
-- (repetido em cada política porque as policies de storage não partilham funções facilmente)

drop policy if exists "Resident docs: upload by owner or resident" on storage.objects;
create policy "Resident docs: upload by owner or resident"
on storage.objects for insert
with check (
  bucket_id = 'resident-documents'
  and exists (
    select 1 from public.afroloc_residents r
    where r.id::text = (storage.foldername(name))[1]
      and (
        r.user_id = auth.uid()
        or r.afroloc_record_id in (
          select id from public.afroloc_records where user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Resident docs: view by owner, resident or authority" on storage.objects;
create policy "Resident docs: view by owner, resident or authority"
on storage.objects for select
using (
  bucket_id = 'resident-documents'
  and (
    exists (
      select 1 from public.afroloc_residents r
      where r.id::text = (storage.foldername(name))[1]
        and (
          r.user_id = auth.uid()
          or r.afroloc_record_id in (
            select id from public.afroloc_records where user_id = auth.uid()
          )
        )
    )
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('admin','admin_national','admin_province','admin_municipality','operator_field','auditor_read')
    )
  )
);

drop policy if exists "Resident docs: update by owner or authority" on storage.objects;
create policy "Resident docs: update by owner or authority"
on storage.objects for update
using (
  bucket_id = 'resident-documents'
  and (
    exists (
      select 1 from public.afroloc_residents r
      where r.id::text = (storage.foldername(name))[1]
        and (
          r.user_id = auth.uid()
          or r.afroloc_record_id in (
            select id from public.afroloc_records where user_id = auth.uid()
          )
        )
    )
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('admin','admin_national','admin_province','admin_municipality','operator_field')
    )
  )
);

drop policy if exists "Resident docs: delete by owner or authority" on storage.objects;
create policy "Resident docs: delete by owner or authority"
on storage.objects for delete
using (
  bucket_id = 'resident-documents'
  and (
    exists (
      select 1 from public.afroloc_residents r
      where r.id::text = (storage.foldername(name))[1]
        and (
          r.user_id = auth.uid()
          or r.afroloc_record_id in (
            select id from public.afroloc_records where user_id = auth.uid()
          )
        )
    )
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('admin','admin_national','admin_province','admin_municipality')
    )
  )
);
