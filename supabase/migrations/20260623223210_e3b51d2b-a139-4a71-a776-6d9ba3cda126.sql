
-- 1. afroloc_delivery_points
REVOKE UPDATE ON public.afroloc_delivery_points FROM authenticated;
GRANT UPDATE (point_address, metadata, updated_at)
  ON public.afroloc_delivery_points TO authenticated;

-- 2. afroloc_operators
REVOKE SELECT ON public.afroloc_operators FROM authenticated;
GRANT SELECT (id, code, name, country_code, operator_type, logo_path,
              is_active, metadata, created_at, updated_at)
  ON public.afroloc_operators TO authenticated;

-- 3. afroloc_requests
DROP POLICY IF EXISTS "System can insert requests" ON public.afroloc_requests;
CREATE POLICY "System can insert requests"
ON public.afroloc_requests FOR INSERT TO service_role WITH CHECK (true);

-- 4. afroloc_residents
REVOKE SELECT ON public.afroloc_residents FROM authenticated;
GRANT SELECT (id, afroloc_record_id, user_id, relationship, is_primary, status,
  primary_approved_at, primary_approved_by_user_id,
  authority_approved_at, authority_approved_by_user_id, authority_role, authority_notes,
  rejected_at, rejected_by_user_id, rejection_reason,
  revoked_at, revoked_by_user_id, revocation_reason,
  valid_from, valid_until, created_at, updated_at)
  ON public.afroloc_residents TO authenticated;

-- 5. afroloc_witnesses
DROP POLICY IF EXISTS "Validators can view requests for their jurisdiction" ON public.afroloc_witnesses;
CREATE POLICY "Validators can view requests for their jurisdiction"
ON public.afroloc_witnesses FOR SELECT TO authenticated
USING (
  otp_code IS NULL
  AND EXISTS (
    SELECT 1
    FROM validation_phone_numbers vpn
    JOIN afroloc_records ar ON ar.id = afroloc_witnesses.afroloc_record_id
    JOIN administrative_divisions ad
      ON ad.country_code = ar.country
     AND (ad.code = ar.level1_code OR ad.code = ar.level2_code
       OR ad.code = ar.level3_code OR ad.code = ar.level4_code)
    WHERE vpn.validator_user_id = auth.uid()
      AND vpn.administrative_division_id = ad.id
      AND afroloc_witnesses.status = 'pending'
  )
);

-- 6. partner_api_keys
ALTER TABLE public.partner_api_keys DROP COLUMN IF EXISTS api_key;

-- 7. storage afroloc-request-docs
DROP POLICY IF EXISTS "System can upload request docs" ON storage.objects;
CREATE POLICY "System can upload request docs"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'afroloc-request-docs');

-- 8. storage document-library
DROP POLICY IF EXISTS "Public documents accessible by everyone" ON storage.objects;
CREATE POLICY "Authenticated users can read document library"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'document-library');

-- 9. SECURITY DEFINER: revoke from PUBLIC & anon broadly
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                   fn.nspname, fn.proname, fn.args);
  END LOOP;
END$$;

-- Revoke EXECUTE from authenticated on admin/system-only functions
DO $$
DECLARE
  fn record;
  admin_only text[] := ARRAY[
    'archive_old_gps_history','assign_citizen_role','check_risk_alerts',
    'cleanup_expired_2fa_codes','cleanup_expired_signup_otps','cleanup_old_security_events',
    'cleanup_old_sessions','cleanup_phone_change_attempts','clear_urban_zones',
    'delete_afroloc_property_photos','delete_identity_document_file',
    'detect_brute_force_attempts','detect_witness_fraud_patterns','flag_witness_fraud',
    'generate_audit_hash_chain','generate_fine_number','generate_violation_event_hash',
    'get_fraud_detection_metrics','get_security_stats','get_validation_stats_by_region',
    'get_validation_stats_by_validator','get_validation_trends','get_urban_zones_status',
    'import_urban_zone','import_urban_zones_bulk','log_fine_audit',
    'log_phone_change_attempt','log_resident_changes','log_security_event',
    'merge_duplicate_profiles','notify_critical_fraud_flag','notify_reputation_change',
    'notify_requester_validation_completed','notify_validator_new_request',
    'notify_webhook_on_status_change','register_yamioo_agent',
    'update_user_authorization_level','update_validation_number_usage',
    'update_witness_reputation','calculate_witness_reputation'
  ];
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
      AND p.proname = ANY(admin_only)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated',
                   fn.nspname, fn.proname, fn.args);
  END LOOP;
END$$;
