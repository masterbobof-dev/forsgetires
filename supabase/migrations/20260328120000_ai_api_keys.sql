-- Ключі AI: лише service_role (Edge Functions), клієнт через anon не бачить рядків (RLS без політик = заборона)
CREATE TABLE IF NOT EXISTS public.ai_api_keys (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gemini_key text,
  openai_key text,
  groq_key text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_api_keys ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ai_api_keys (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Опційно: перенести ключі зі старого сховища settings (якщо були)
UPDATE public.ai_api_keys k SET
  gemini_key = COALESCE(NULLIF((SELECT value FROM public.settings WHERE key = 'google_gemini_api_key' LIMIT 1), ''), k.gemini_key),
  openai_key = COALESCE(NULLIF((SELECT value FROM public.settings WHERE key = 'openai_api_key' LIMIT 1), ''), k.openai_key),
  groq_key = COALESCE(NULLIF((SELECT value FROM public.settings WHERE key = 'groq_api_key' LIMIT 1), ''), k.groq_key),
  updated_at = now()
WHERE k.id = 1;

COMMENT ON TABLE public.ai_api_keys IS 'API keys for AI; readable only by Edge Functions (service role).';
