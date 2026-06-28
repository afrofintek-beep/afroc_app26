-- Add ON DELETE CASCADE to all tables with user_id references to auth.users

-- Helper function to safely add/update foreign key constraints
DO $$ 
BEGIN

  -- user_roles
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_roles_user_id_fkey' AND table_name = 'user_roles') THEN
    ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_user_id_fkey;
  END IF;
  ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- user_devices
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_devices_user_id_fkey' AND table_name = 'user_devices') THEN
    ALTER TABLE public.user_devices DROP CONSTRAINT user_devices_user_id_fkey;
  END IF;
  ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- user_authorization_levels
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_authorization_levels_user_id_fkey' AND table_name = 'user_authorization_levels') THEN
    ALTER TABLE public.user_authorization_levels DROP CONSTRAINT user_authorization_levels_user_id_fkey;
  END IF;
  ALTER TABLE public.user_authorization_levels ADD CONSTRAINT user_authorization_levels_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- biometric_devices
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'biometric_devices_user_id_fkey' AND table_name = 'biometric_devices') THEN
    ALTER TABLE public.biometric_devices DROP CONSTRAINT biometric_devices_user_id_fkey;
  END IF;
  ALTER TABLE public.biometric_devices ADD CONSTRAINT biometric_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- biometric_login_history
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'biometric_login_history_user_id_fkey' AND table_name = 'biometric_login_history') THEN
    ALTER TABLE public.biometric_login_history DROP CONSTRAINT biometric_login_history_user_id_fkey;
  END IF;
  ALTER TABLE public.biometric_login_history ADD CONSTRAINT biometric_login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- user_2fa_settings
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_2fa_settings_user_id_fkey' AND table_name = 'user_2fa_settings') THEN
    ALTER TABLE public.user_2fa_settings DROP CONSTRAINT user_2fa_settings_user_id_fkey;
  END IF;
  ALTER TABLE public.user_2fa_settings ADD CONSTRAINT user_2fa_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- two_factor_codes
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'two_factor_codes_user_id_fkey' AND table_name = 'two_factor_codes') THEN
    ALTER TABLE public.two_factor_codes DROP CONSTRAINT two_factor_codes_user_id_fkey;
  END IF;
  ALTER TABLE public.two_factor_codes ADD CONSTRAINT two_factor_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- two_factor_backup_codes
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'two_factor_backup_codes_user_id_fkey' AND table_name = 'two_factor_backup_codes') THEN
    ALTER TABLE public.two_factor_backup_codes DROP CONSTRAINT two_factor_backup_codes_user_id_fkey;
  END IF;
  ALTER TABLE public.two_factor_backup_codes ADD CONSTRAINT two_factor_backup_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- validator_notifications
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'validator_notifications_user_id_fkey' AND table_name = 'validator_notifications') THEN
    ALTER TABLE public.validator_notifications DROP CONSTRAINT validator_notifications_user_id_fkey;
  END IF;
  ALTER TABLE public.validator_notifications ADD CONSTRAINT validator_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- push_subscriptions
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'push_subscriptions_user_id_fkey' AND table_name = 'push_subscriptions') THEN
    ALTER TABLE public.push_subscriptions DROP CONSTRAINT push_subscriptions_user_id_fkey;
  END IF;
  ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- phone_change_attempts
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'phone_change_attempts_user_id_fkey' AND table_name = 'phone_change_attempts') THEN
    ALTER TABLE public.phone_change_attempts DROP CONSTRAINT phone_change_attempts_user_id_fkey;
  END IF;
  ALTER TABLE public.phone_change_attempts ADD CONSTRAINT phone_change_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- risk_alert_settings
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'risk_alert_settings_user_id_fkey' AND table_name = 'risk_alert_settings') THEN
    ALTER TABLE public.risk_alert_settings DROP CONSTRAINT risk_alert_settings_user_id_fkey;
  END IF;
  ALTER TABLE public.risk_alert_settings ADD CONSTRAINT risk_alert_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- risk_alerts_log (nullable user_id - SET NULL on delete)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'risk_alerts_log_user_id_fkey' AND table_name = 'risk_alerts_log') THEN
    ALTER TABLE public.risk_alerts_log DROP CONSTRAINT risk_alerts_log_user_id_fkey;
  END IF;
  ALTER TABLE public.risk_alerts_log ADD CONSTRAINT risk_alerts_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

  -- security_events (nullable user_id - SET NULL on delete)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'security_events_user_id_fkey' AND table_name = 'security_events') THEN
    ALTER TABLE public.security_events DROP CONSTRAINT security_events_user_id_fkey;
  END IF;
  ALTER TABLE public.security_events ADD CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

  -- security_audit_log (nullable user_id - SET NULL on delete)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'security_audit_log_user_id_fkey' AND table_name = 'security_audit_log') THEN
    ALTER TABLE public.security_audit_log DROP CONSTRAINT security_audit_log_user_id_fkey;
  END IF;
  ALTER TABLE public.security_audit_log ADD CONSTRAINT security_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

  -- afroloc_records
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'afroloc_records_user_id_fkey' AND table_name = 'afroloc_records') THEN
    ALTER TABLE public.afroloc_records DROP CONSTRAINT afroloc_records_user_id_fkey;
  END IF;
  ALTER TABLE public.afroloc_records ADD CONSTRAINT afroloc_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- identity_documents
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'identity_documents_user_id_fkey' AND table_name = 'identity_documents') THEN
    ALTER TABLE public.identity_documents DROP CONSTRAINT identity_documents_user_id_fkey;
  END IF;
  ALTER TABLE public.identity_documents ADD CONSTRAINT identity_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- offline_cache_metadata
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'offline_cache_metadata_user_id_fkey' AND table_name = 'offline_cache_metadata') THEN
    ALTER TABLE public.offline_cache_metadata DROP CONSTRAINT offline_cache_metadata_user_id_fkey;
  END IF;
  ALTER TABLE public.offline_cache_metadata ADD CONSTRAINT offline_cache_metadata_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- afroloc_witnesses (witness_user_id)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'afroloc_witnesses_witness_user_id_fkey' AND table_name = 'afroloc_witnesses') THEN
    ALTER TABLE public.afroloc_witnesses DROP CONSTRAINT afroloc_witnesses_witness_user_id_fkey;
  END IF;
  ALTER TABLE public.afroloc_witnesses ADD CONSTRAINT afroloc_witnesses_witness_user_id_fkey FOREIGN KEY (witness_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- afroloc_witnesses (validated_by_user_id - SET NULL on delete)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'afroloc_witnesses_validated_by_user_id_fkey' AND table_name = 'afroloc_witnesses') THEN
    ALTER TABLE public.afroloc_witnesses DROP CONSTRAINT afroloc_witnesses_validated_by_user_id_fkey;
  END IF;
  ALTER TABLE public.afroloc_witnesses ADD CONSTRAINT afroloc_witnesses_validated_by_user_id_fkey FOREIGN KEY (validated_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

  -- registration_batches (created_by_user_id)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'registration_batches_created_by_user_id_fkey' AND table_name = 'registration_batches') THEN
    ALTER TABLE public.registration_batches DROP CONSTRAINT registration_batches_created_by_user_id_fkey;
  END IF;
  ALTER TABLE public.registration_batches ADD CONSTRAINT registration_batches_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- registration_batches (submitted_to_user_id - SET NULL on delete)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'registration_batches_submitted_to_user_id_fkey' AND table_name = 'registration_batches') THEN
    ALTER TABLE public.registration_batches DROP CONSTRAINT registration_batches_submitted_to_user_id_fkey;
  END IF;
  ALTER TABLE public.registration_batches ADD CONSTRAINT registration_batches_submitted_to_user_id_fkey FOREIGN KEY (submitted_to_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

  -- registration_batches (approved_by_user_id - SET NULL on delete)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'registration_batches_approved_by_user_id_fkey' AND table_name = 'registration_batches') THEN
    ALTER TABLE public.registration_batches DROP CONSTRAINT registration_batches_approved_by_user_id_fkey;
  END IF;
  ALTER TABLE public.registration_batches ADD CONSTRAINT registration_batches_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

  -- witness_contract_downloads (downloaded_by_user_id)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'witness_contract_downloads_downloaded_by_user_id_fkey' AND table_name = 'witness_contract_downloads') THEN
    ALTER TABLE public.witness_contract_downloads DROP CONSTRAINT witness_contract_downloads_downloaded_by_user_id_fkey;
  END IF;
  ALTER TABLE public.witness_contract_downloads ADD CONSTRAINT witness_contract_downloads_downloaded_by_user_id_fkey FOREIGN KEY (downloaded_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- validation_phone_numbers (validator_user_id - SET NULL on delete)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'validation_phone_numbers_validator_user_id_fkey' AND table_name = 'validation_phone_numbers') THEN
    ALTER TABLE public.validation_phone_numbers DROP CONSTRAINT validation_phone_numbers_validator_user_id_fkey;
  END IF;
  ALTER TABLE public.validation_phone_numbers ADD CONSTRAINT validation_phone_numbers_validator_user_id_fkey FOREIGN KEY (validator_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

END $$;