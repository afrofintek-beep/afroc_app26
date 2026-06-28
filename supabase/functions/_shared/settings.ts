// Edge Function Settings
// JWT is handled automatically by Supabase Auth
// These are additional configuration values for edge functions

export const settings = {
  // JWT settings (managed by Supabase, these are for reference)
  JWT_ALG: "HS256",
  JWT_EXPIRE_MIN: 30,
  JWT_REFRESH_EXPIRE_DAYS: 14,

  // Rate limiting
  RATE_LIMIT_MAX_ATTEMPTS: 10,
  RATE_LIMIT_WINDOW_MINUTES: 15,

  // OTP settings
  OTP_EXPIRE_MINUTES: 10,
  OTP_MAX_ATTEMPTS: 3,

  // Phone change cooldown
  PHONE_CHANGE_COOLDOWN_DAYS: 60,

  // Session settings
  SESSION_EXPIRE_DAYS: 30,
  BIOMETRIC_TOKEN_EXPIRE_DAYS: 30,

  // Address limits
  MAX_ADDRESSES_PER_USER: 10,

  // Witness settings
  MIN_WITNESSES_REQUIRED: 2,
  WITNESS_REPUTATION_BASE: 50,

  // ATS Score weights
  ATS_WEIGHTS: {
    GPS: 25,
    TELECOM: 25,
    EXIF: 20,
    WITNESSES: 15,
    AUDIT: 15,
  },

  // Fraud detection thresholds
  FRAUD_RAPID_CONFIRMATIONS_HOUR: 5,
  FRAUD_RAPID_CONFIRMATIONS_DAY: 15,
  FRAUD_CROSS_REGION_THRESHOLD: 3,
  FRAUD_COLLUSION_THRESHOLD: 3,

  // Get environment variable with fallback
  env(key: string, fallback: string = ""): string {
    return Deno.env.get(key) ?? fallback;
  },

  // Get Supabase URL
  get SUPABASE_URL(): string {
    return this.env("SUPABASE_URL");
  },

  // Get Supabase service role key
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    return this.env("SUPABASE_SERVICE_ROLE_KEY");
  },

  // Get Supabase anon key
  get SUPABASE_ANON_KEY(): string {
    return this.env("SUPABASE_ANON_KEY");
  },
};

export default settings;
