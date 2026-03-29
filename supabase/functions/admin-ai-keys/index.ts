// @ts-nocheck
/**
 * Збереження / статус ключів AI (лише email з admin_email у settings).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function isAdmin(
  adminClient: ReturnType<typeof createClient>,
  userEmail: string | undefined
): Promise<boolean> {
  console.log('[isAdmin] Checking for:', userEmail);
  if (!userEmail) return false;
  
  const { data, error } = await adminClient.from('settings').select('value').eq('key', 'admin_email').maybeSingle();
  if (error) {
    console.error('[isAdmin] Database error fetching admin_email:', error);
    return false;
  }
  
  const adminEmail = (data?.value ?? '').trim().toLowerCase();
  console.log('[isAdmin] Found admin_email in DB:', adminEmail);
  
  if (!adminEmail) return false;
  return userEmail.toLowerCase() === adminEmail;
}

Deno.serve(async (req) => {
  console.log('[Request] Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.warn('[Request] Missing Authorization header');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!supabaseUrl || !serviceKey) {
    console.error('[Config] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    console.error('[Auth] Invalid session:', userErr);
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  const isUserAdmin = await isAdmin(adminClient, user.email ?? undefined);
  if (!isUserAdmin) {
    console.warn('[Auth] Access denied for:', user.email);
    return new Response(
      JSON.stringify({
        error: `Доступ лише для власника (${user.email}). Оновіть таблицю settings -> admin_email.`,
      }),
      { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  let body: any;
  try {
    body = await req.json();
    console.log('[Body] Received:', JSON.stringify(body));
  } catch (e) {
    console.error('[Body] Parse error:', e);
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Handle "status" action
  if (body.action === 'status') {
    const { data, error } = await adminClient
      .from('ai_api_keys')
      .select('gemini_key, openai_key, groq_key, custom_key, serper_key')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.error('[DB] Status fetch error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        hasGemini: !!(data?.gemini_key?.trim()),
        hasOpenai: !!(data?.openai_key?.trim()),
        hasGroq: !!(data?.groq_key?.trim()),
        hasCustom: !!(data?.custom_key?.trim()),
        hasSerper: !!(data?.serper_key?.trim()),
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Handle saving keys
  const { data: row, error: fetchErr } = await adminClient
    .from('ai_api_keys')
    .select('gemini_key, openai_key, groq_key, custom_key, serper_key')
    .eq('id', 1)
    .maybeSingle();

  if (fetchErr) {
    console.error('[DB] Fetch keys for update error:', fetchErr);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const current = row ?? { gemini_key: null, openai_key: null, groq_key: null, custom_key: null, serper_key: null };
  const next = { ...current };

  if (body.gemini !== undefined) next.gemini_key = body.gemini.trim() || null;
  if (body.openai !== undefined) next.openai_key = body.openai.trim() || null;
  if (body.groq !== undefined) next.groq_key = body.groq.trim() || null;
  if (body.custom !== undefined) next.custom_key = body.custom.trim() || null;
  if (body.serper !== undefined) next.serper_key = body.serper.trim() || null;

  console.log('[DB] Attempting upsert with id=1');
  const { error: upsertErr } = await adminClient.from('ai_api_keys').upsert({
    id: 1,
    ...next,
    updated_at: new Date().toISOString(),
  });

  if (upsertErr) {
    console.error('[DB] Upsert error:', upsertErr);
    return new Response(JSON.stringify({ error: upsertErr.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  console.log('[Success] Keys updated');
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});

