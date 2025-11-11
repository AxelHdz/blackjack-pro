-- Function to automatically create user profile with display name from email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  username_from_email text;
BEGIN
  -- Extract username from email (part before @)
  username_from_email := split_part(NEW.email, '@', 1);
  
  -- Replace dots and special characters with underscores
  username_from_email := regexp_replace(username_from_email, '[^a-zA-Z0-9]', '', 'g');
  
  -- Insert into user_profiles
  INSERT INTO public.user_profiles (id, email, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    username_from_email,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
