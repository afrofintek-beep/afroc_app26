-- Create enums for status and roles
CREATE TYPE public.afroid_status AS ENUM ('draft', 'verified', 'certified');
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  afro_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create afroid_records table
CREATE TABLE public.afroid_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  level1_code TEXT,
  level1_name TEXT,
  level2_code TEXT,
  level2_name TEXT,
  level3_code TEXT,
  level3_name TEXT,
  level4_code TEXT,
  level4_name TEXT,
  street_code TEXT,
  street_name TEXT,
  number TEXT,
  unit TEXT,
  geo_lat NUMERIC,
  geo_lon NUMERIC,
  status afroid_status DEFAULT 'draft',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.afroid_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own records"
  ON public.afroid_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own records"
  ON public.afroid_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own draft records"
  ON public.afroid_records FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Admins can view all records"
  ON public.afroid_records FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any record"
  ON public.afroid_records FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create afroid_witnesses table
CREATE TABLE public.afroid_witnesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  afroid_record_id UUID REFERENCES public.afroid_records(id) ON DELETE CASCADE NOT NULL,
  witness_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  witness_afro_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  signature TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.afroid_witnesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view witnesses for their records"
  ON public.afroid_witnesses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.afroid_records
      WHERE id = afroid_record_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can be witnesses"
  ON public.afroid_witnesses FOR INSERT
  WITH CHECK (auth.uid() = witness_user_id);

CREATE POLICY "Witnesses can update their own confirmations"
  ON public.afroid_witnesses FOR UPDATE
  USING (auth.uid() = witness_user_id);

-- Create afroid_validations table
CREATE TABLE public.afroid_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  afroid_record_id UUID REFERENCES public.afroid_records(id) ON DELETE CASCADE NOT NULL,
  validation_method TEXT NOT NULL,
  authority_role TEXT,
  authority_signature TEXT,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.afroid_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view validations for their records"
  ON public.afroid_validations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.afroid_records
      WHERE id = afroid_record_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create validations"
  ON public.afroid_validations FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger function for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_afroid_records_updated_at
  BEFORE UPDATE ON public.afroid_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();