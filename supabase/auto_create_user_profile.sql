-- Auto-create user profile when auth user is confirmed
-- This trigger ensures the profile is created even with email confirmation enabled

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  safe_username TEXT;
  suffix TEXT;
BEGIN
  base_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    split_part(NEW.email, '@', 1),
    'user'
  );

  base_username := lower(base_username);
  base_username := regexp_replace(base_username, '[^a-z0-9_]+', '_', 'g');
  base_username := trim(both '_' from base_username);

  IF base_username = '' THEN
    base_username := 'user';
  END IF;

  suffix := substr(replace(NEW.id::text, '-', ''), 1, 6);
  safe_username := base_username;

  IF EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.username = safe_username
      AND u.id <> NEW.id
  ) THEN
    safe_username := base_username || '_' || suffix;
  END IF;

  -- Insert user profile with username from metadata or email
  INSERT INTO public.users (id, username, avatar_type)
  VALUES (
    NEW.id,
    safe_username,
    'default'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Create profile automatically when auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Comments for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Automatically creates a user profile in public.users when a new auth user signs up. Uses username from metadata or derives from email.';

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 
  'Triggers handle_new_user() function to create user profile after successful signup.';

-- Test the trigger (optional)
-- This will show you that the trigger is working
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
