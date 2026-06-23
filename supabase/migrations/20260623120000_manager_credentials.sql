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
      updated_at = NOW(),
      confirmation_token = COALESCE(confirmation_token, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      reauthentication_token = COALESCE(reauthentication_token, '')
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
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      email_change_token_current,
      phone_change_token,
      reauthentication_token
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
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Also store the manager email in the settings table
  INSERT INTO public.settings (key, value)
  VALUES ('manager_email', m_email)
  ON CONFLICT (key) DO UPDATE SET value = m_email;
END;
;

-- Fix any existing users that have NULLs in these token columns causing login crash
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL 
   OR email_change IS NULL 
   OR email_change_token_new IS NULL 
   OR recovery_token IS NULL
   OR email_change_token_current IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL;
