-- Corrigir views com SECURITY INVOKER para respeitar RLS do utilizador
DROP VIEW IF EXISTS public.expiring_resident_documents;
DROP VIEW IF EXISTS public.pending_resident_approvals;

-- Recriar view com SECURITY INVOKER
CREATE VIEW public.expiring_resident_documents 
WITH (security_invoker = on) AS
SELECT 
  rd.id,
  rd.resident_id,
  rd.document_type,
  rd.document_number,
  rd.expiry_date,
  rd.expiry_date - CURRENT_DATE AS days_until_expiry,
  r.user_id,
  r.afroloc_record_id,
  ar.code AS afroloc_code,
  p.full_name,
  p.phone
FROM public.afroloc_resident_documents rd
JOIN public.afroloc_residents r ON rd.resident_id = r.id
JOIN public.afroloc_records ar ON r.afroloc_record_id = ar.id
LEFT JOIN public.profiles p ON r.user_id = p.user_id
WHERE rd.expiry_date IS NOT NULL
  AND rd.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
  AND rd.status = 'verified'
  AND r.status = 'approved'
ORDER BY rd.expiry_date;

-- Recriar view com SECURITY INVOKER
CREATE VIEW public.pending_resident_approvals 
WITH (security_invoker = on) AS
SELECT 
  r.id AS resident_id,
  r.afroloc_record_id,
  ar.code AS afroloc_code,
  ar.country,
  ar.level1_name AS province,
  ar.level2_name AS municipality,
  ar.level3_name AS commune,
  r.user_id,
  p.full_name,
  p.phone,
  r.relationship,
  r.status,
  r.created_at,
  r.primary_approved_at,
  (
    SELECT COUNT(*) FROM public.afroloc_resident_documents rd 
    WHERE rd.resident_id = r.id AND rd.status = 'pending'
  ) AS pending_documents,
  (
    SELECT COUNT(*) FROM public.afroloc_resident_documents rd 
    WHERE rd.resident_id = r.id AND rd.status = 'verified'
  ) AS verified_documents
FROM public.afroloc_residents r
JOIN public.afroloc_records ar ON r.afroloc_record_id = ar.id
LEFT JOIN public.profiles p ON r.user_id = p.user_id
WHERE r.status = 'pending_authority'
ORDER BY r.created_at;