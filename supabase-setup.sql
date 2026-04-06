-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  savings_history JSONB DEFAULT '[]'::jsonb,
  monthly_goal NUMERIC DEFAULT 500,
  price_alerts JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create shopping_lists table
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  items JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create deals table
CREATE TABLE IF NOT EXISTS public.deals (
  product_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  store TEXT NOT NULL,
  category TEXT,
  image_url TEXT,
  end_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  brand TEXT,
  size TEXT,
  price_history JSONB DEFAULT '[]'::jsonb,
  price_trend TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  variants JSONB DEFAULT '[]'::jsonb
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for shopping_lists
DROP POLICY IF EXISTS "Users can view own shopping list" ON public.shopping_lists;
CREATE POLICY "Users can view own shopping list" ON public.shopping_lists
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own shopping list" ON public.shopping_lists;
CREATE POLICY "Users can insert own shopping list" ON public.shopping_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own shopping list" ON public.shopping_lists;
CREATE POLICY "Users can update own shopping list" ON public.shopping_lists
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for deals
DROP POLICY IF EXISTS "Anyone can view deals" ON public.deals;
CREATE POLICY "Anyone can view deals" ON public.deals
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert deals" ON public.deals;
CREATE POLICY "Authenticated users can insert deals" ON public.deals
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update deals" ON public.deals;
CREATE POLICY "Authenticated users can update deals" ON public.deals
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete deals" ON public.deals;
CREATE POLICY "Authenticated users can delete deals" ON public.deals
  FOR DELETE USING (auth.role() = 'authenticated');

-- Create a trigger to automatically create a user profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, savings_history, monthly_goal, price_alerts)
  VALUES (new.id, '[]'::jsonb, 500, '[]'::jsonb);
  
  INSERT INTO public.shopping_lists (user_id, items)
  VALUES (new.id, '[]'::jsonb);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists to avoid errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
