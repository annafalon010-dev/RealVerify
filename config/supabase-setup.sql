-- =============================================
-- REALVERIFY SUPABASE DATABASE SETUP
-- Run this in Supabase SQL Editor
-- =============================================

-- STEP 1: CREATE PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id)
);

-- STEP 2: CREATE PROPERTIES TABLE
CREATE TABLE IF NOT EXISTS properties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    type TEXT,
    price NUMERIC,
    size NUMERIC,
    image_urls TEXT[],
    doc_urls TEXT[],
    status TEXT DEFAULT 'pending',
    admin_notes TEXT,
    admin_id UUID REFERENCES profiles(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 3: CREATE NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 4: CREATE FRAUD FLAGS TABLE
CREATE TABLE IF NOT EXISTS fraud_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES profiles(id),
    reason TEXT NOT NULL,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- STEP 5: AUTO CREATE PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        'user'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- STEP 6: ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

-- Helper functions avoid recursive RLS checks when policies need the current user's role.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.current_user_role() = 'admin', FALSE);
$$;

-- Drop policies first so this setup script can be rerun safely.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Anyone can view verified properties" ON public.properties;
DROP POLICY IF EXISTS "Users can view own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can insert own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete own properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can view all properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can update all properties" ON public.properties;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

DROP POLICY IF EXISTS "Users can insert fraud flags" ON public.fraud_flags;
DROP POLICY IF EXISTS "Users can view own fraud flags" ON public.fraud_flags;
DROP POLICY IF EXISTS "Admins can view all fraud flags" ON public.fraud_flags;
DROP POLICY IF EXISTS "Admins can update fraud flags" ON public.fraud_flags;

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND COALESCE(role, 'user') = COALESCE(public.current_user_role(), 'user')
    );

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

-- PROPERTIES POLICIES
CREATE POLICY "Anyone can view verified properties"
    ON public.properties FOR SELECT
    USING (status = 'verified');

CREATE POLICY "Users can view own properties"
    ON public.properties FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own properties"
    ON public.properties FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND status = 'pending'
        AND admin_notes IS NULL
        AND admin_id IS NULL
        AND verified_at IS NULL
    );

CREATE POLICY "Users can delete own properties"
    ON public.properties FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all properties"
    ON public.properties FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can update all properties"
    ON public.properties FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (public.is_admin());

-- FRAUD FLAGS POLICIES
CREATE POLICY "Users can insert fraud flags"
    ON public.fraud_flags FOR INSERT
    WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users can view own fraud flags"
    ON public.fraud_flags FOR SELECT
    USING (auth.uid() = reported_by);

CREATE POLICY "Admins can view all fraud flags"
    ON public.fraud_flags FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can update fraud flags"
    ON public.fraud_flags FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- =============================================
-- STEP 7: CREATE YOUR ADMIN ACCOUNT
-- Run this AFTER you have signed up with your
-- admin email address on the platform
-- Replace with your actual email address
-- =============================================

-- UPDATE profiles SET role = 'admin'
-- WHERE email = 'your-admin-email@gmail.com';
