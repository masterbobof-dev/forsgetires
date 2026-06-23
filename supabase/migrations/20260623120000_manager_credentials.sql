CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_manager_credentials(
  m_email text,
  m_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS 
DECLARE
  m_id uuid;
  hashed_password text;
BEGIN
  -- Generate crypt hash for password using pgcrypto
  hashed_password := extensions.crypt(m_password, extensions.gen_salt('bf', 10));

  -- Check if user already exists in auth.users by email
  SELECT id INTO m_id FROM auth.users WHERE email = m_email;

  IF m_id IS NOT NULL THEN
    -- Update existing user's password
    UPDATE auth.users
    SET 
      encrypted_password = hashed_password,
      email_confirmed_at = NOW(),
      updated_at = NOW()
    WHERE id = m_id;
  ELSE
    -- Create new user in auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      confirmed_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      extensions.gen_random_uuid(),
      'authenticated',
      'authenticated',
      m_email,
      hashed_password,
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW(),
      NULL,
      NULL,
      NOW()
    );
  END IF;

  -- Also store the manager email in the settings table
  INSERT INTO public.settings (key, value)
  VALUES ('manager_email', m_email)
  ON CONFLICT (key) DO UPDATE SET value = m_email;
END;
;
