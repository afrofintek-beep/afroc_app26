
-- Fix permissive RLS policies: replace USING(true)/WITH CHECK(true) with service_role check

-- 1. afroloc_delivery_audit_log
DROP POLICY IF EXISTS "System can insert delivery audit logs" ON public.afroloc_delivery_audit_log;
CREATE POLICY "System can insert delivery audit logs" ON public.afroloc_delivery_audit_log
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- 2. afroloc_requests
DROP POLICY IF EXISTS "System can insert requests" ON public.afroloc_requests;
CREATE POLICY "System can insert requests" ON public.afroloc_requests
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role' OR auth.uid() IS NOT NULL);

-- 3. afroloc_resident_audit_log
DROP POLICY IF EXISTS "System can insert audit logs" ON public.afroloc_resident_audit_log;
CREATE POLICY "System can insert audit logs" ON public.afroloc_resident_audit_log
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- 4. cadastral_creation_quotas
DROP POLICY IF EXISTS "System can manage quotas" ON public.cadastral_creation_quotas;
CREATE POLICY "System can manage quotas" ON public.cadastral_creation_quotas
  FOR ALL USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');

-- 5. phone_otp_verifications
DROP POLICY IF EXISTS "Service role can manage OTP records" ON public.phone_otp_verifications;
CREATE POLICY "Service role can manage OTP records" ON public.phone_otp_verifications
  FOR ALL USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');

-- 6. risk_alerts_log
DROP POLICY IF EXISTS "System can insert alerts" ON public.risk_alerts_log;
CREATE POLICY "System can insert alerts" ON public.risk_alerts_log
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- 7. user_authorization_levels - INSERT
DROP POLICY IF EXISTS "System can insert authorization levels" ON public.user_authorization_levels;
CREATE POLICY "System can insert authorization levels" ON public.user_authorization_levels
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- 8. user_authorization_levels - UPDATE
DROP POLICY IF EXISTS "System can update authorization levels" ON public.user_authorization_levels;
CREATE POLICY "System can update authorization levels" ON public.user_authorization_levels
  FOR UPDATE USING ((select auth.role()) = 'service_role');

-- 9. validator_notifications
DROP POLICY IF EXISTS "Only service role can insert notifications" ON public.validator_notifications;
CREATE POLICY "Only service role can insert notifications" ON public.validator_notifications
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- 10. witness_contract_downloads
DROP POLICY IF EXISTS "System can insert download logs" ON public.witness_contract_downloads;
CREATE POLICY "System can insert download logs" ON public.witness_contract_downloads
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- 11. witness_fraud_flags
DROP POLICY IF EXISTS "System can insert fraud flags" ON public.witness_fraud_flags;
CREATE POLICY "System can insert fraud flags" ON public.witness_fraud_flags
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- 12. witness_reputation_history
DROP POLICY IF EXISTS "System can insert reputation history" ON public.witness_reputation_history;
CREATE POLICY "System can insert reputation history" ON public.witness_reputation_history
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
