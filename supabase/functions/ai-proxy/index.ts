// @ts-nocheck
/**
 * Edge Function: проксі до Gemini / OpenAI / Groq.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

async function loadAiConfig(): Promise<{ 
  gemini: string; openai: string; groq: string; openaiBaseUrl: string; openaiModel: string; serper: string 
}> {
  console.log('[loadAiConfig] Initializing...');
  const url = Deno.env.get('SUPABASE_URL');
  const sr = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  const config = { 
    gemini: '', 
    openai: '', 
    groq: '',
    custom: '',
    serper: '',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiModel: 'gpt-4o-mini',
    customBaseUrl: '',
    customModel: ''
  };

  if (!url || !sr) {
    console.error('[loadAiConfig] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return config;
  }

  try {
    const admin = createClient(url, sr);
    
    // Load Keys
    const { data: keysData, error: keysError } = await admin.from('ai_api_keys').select('gemini_key, openai_key, groq_key, custom_key').eq('id', 1).maybeSingle();
    if (keysError) {
      console.error('[loadAiConfig] ai_api_keys Select error:', keysError);
    } else if (keysData) {
      config.gemini = (keysData.gemini_key ?? '').trim();
      config.openai = (keysData.openai_key ?? '').trim();
      config.groq = (keysData.groq_key ?? '').trim();
      config.custom = (keysData.custom_key ?? '').trim();
      config.serper = (keysData.serper_key ?? '').trim();
    }

    // Load custom Base URL & Model from settings
    const { data: settingsData, error: settingsError } = await admin.from('settings').select('key, value').in('key', ['ai_openai_base_url', 'ai_openai_model', 'ai_custom_base_url', 'ai_custom_model']);
    if (settingsError) {
      console.error('[loadAiConfig] settings Select error:', settingsError);
    } else if (settingsData) {
      settingsData.forEach(row => {
        if (row.key === 'ai_openai_base_url') {
            const val = row.value.trim();
            if (val) config.openaiBaseUrl = val;
        }
        if (row.key === 'ai_openai_model') {
            const val = row.value.trim();
            if (val) config.openaiModel = val;
        }
        if (row.key === 'ai_custom_base_url') {
            const val = row.value.trim();
            if (val) config.customBaseUrl = val;
        }
        if (row.key === 'ai_custom_model') {
            const val = row.value.trim();
            if (val) config.customModel = val;
        }
      });
      console.log('[loadAiConfig] Custom settings loaded. Custom Model:', config.customModel);
    }

    console.log('[loadAiConfig] Configuration loaded successfully');
    return config;
  } catch (err) {
    console.error('[loadAiConfig] Unexpected error:', err);
    return config;
  }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_MODEL = 'gemini-2.5-flash';
const OPENAI_MODEL = 'gpt-4o-mini';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

type Provider = 'gemini' | 'openai' | 'groq' | 'custom';

function parseJsonFromText(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    const v = JSON.parse(trimmed);
    if (v && typeof v === 'object') return v as Record<string, unknown>;
  } catch { /* fallback */ }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const v = JSON.parse(match[0]);
      if (v && typeof v === 'object') return v as Record<string, unknown>;
    } catch { /* fallback */ }
  }
  throw new Error('Invalid JSON format from AI');
}

function geminiSeoSchema() {
  return {
    type: 'OBJECT',
    properties: {
      description: { type: 'STRING' },
      seo_title: { type: 'STRING' },
      seo_description: { type: 'STRING' },
      seo_keywords: { type: 'STRING' },
      width: { type: 'STRING' },
      height: { type: 'STRING' },
      radius: { type: 'STRING' },
      manufacturer: { type: 'STRING' },
      season: { type: 'STRING' },
      vehicle_type: { type: 'STRING' },
    },
    required: [
      'description', 'seo_title', 'seo_description', 'seo_keywords', 
      'width', 'height', 'radius', 'manufacturer', 'season', 'vehicle_type'
    ],
  };
}

function geminiSeoBulkSchema() {
  return {
    type: 'OBJECT',
    properties: {
      results: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'INTEGER' },
            description: { type: 'STRING' },
            seo_title: { type: 'STRING' },
            seo_description: { type: 'STRING' },
            seo_keywords: { type: 'STRING' },
            width: { type: 'STRING' },
            height: { type: 'STRING' },
            radius: { type: 'STRING' },
            manufacturer: { type: 'STRING' },
            season: { type: 'STRING' },
            vehicle_type: { type: 'STRING' },
          },
          required: [
            'id', 'description', 'seo_title', 'seo_description', 'seo_keywords',
            'width', 'height', 'radius', 'manufacturer', 'season', 'vehicle_type'
          ],
        },
      },
    },
    required: ['results'],
  };
}

async function geminiGenerateSeo(apiKey: string, systemPrompt: string, userPrompt: string, mode: 'seo' | 'seo_bulk'): Promise<Record<string, unknown>> {
  console.log('[Gemini] Requesting SEO JSON...');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: mode === 'seo_bulk' ? geminiSeoBulkSchema() : geminiSeoSchema(),
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error('[Gemini] Error status:', res.status, raw);
    if (raw.includes('API_KEY_INVALID')) {
      throw new Error('INVALID_API_KEY');
    }
    throw new Error(`Gemini ${res.status}: ${raw.slice(0, 400)}`);
  }
  const data = JSON.parse(raw);
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Empty Gemini response');
  return parseJsonFromText(text);
}

async function geminiPlain(apiKey: string, prompt: string): Promise<string> {
  console.log('[Gemini] Requesting plain text...');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error('[Gemini] Error status:', res.status, raw);
    if (raw.includes('API_KEY_INVALID')) {
      throw new Error('INVALID_API_KEY');
    }
    throw new Error(`Gemini ${res.status}: ${raw.slice(0, 400)}`);
  }
  const data = JSON.parse(raw);
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Empty Gemini response');
  return text.trim();
}

async function openaiCompatibleJson(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
  console.log(`[OpenAI-Compatible] Requesting JSON from ${baseUrl}...`);
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error('[AI API] Error status:', res.status, raw);
    if (res.status === 401 || raw.includes('invalid_api_key') || raw.includes('authentication_error')) {
      throw new Error('INVALID_API_KEY');
    }
    throw new Error(`API ${res.status}: ${raw.slice(0, 400)}`);
  }
  const data = JSON.parse(raw);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty model response');
  return parseJsonFromText(content);
}

async function openaiCompatiblePlain(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  console.log(`[OpenAI-Compatible] Requesting plain text from ${baseUrl}...`);
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error('[AI API] Error status:', res.status, raw);
    throw new Error(`API ${res.status}: ${raw.slice(0, 400)}`);
  }
  const data = JSON.parse(raw);
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty model response');
  return content;
}

function getSecretFromEnv(provider: Provider): string {
  const g = Deno.env.get('GEMINI_API_KEY') ?? '';
  const o = Deno.env.get('OPENAI_API_KEY') ?? '';
  const q = Deno.env.get('GROQ_API_KEY') ?? '';
  const c = Deno.env.get('CUSTOM_API_KEY') ?? '';
  const key = provider === 'gemini' ? g : provider === 'openai' ? o : provider === 'groq' ? q : c;
  return key.trim();
}

async function resolveAiConfig(provider: Provider) {
  const config = await loadAiConfig();
  let apiKey = '';
  
  if (provider === 'gemini') apiKey = config.gemini;
  else if (provider === 'openai') apiKey = config.openai;
  else if (provider === 'groq') apiKey = config.groq;
  else if (provider === 'custom') apiKey = config.custom;

  if (!apiKey) {
    apiKey = getSecretFromEnv(provider);
  }

  return { 
    apiKey, 
    openaiBaseUrl: config.openaiBaseUrl,
    openaiModel: config.openaiModel,
    customBaseUrl: config.customBaseUrl,
    customModel: config.customModel,
    serper: config.serper
  };
}

Deno.serve(async (req) => {
  console.log('[ai-proxy] Request method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.warn('[ai-proxy] Unauthorized: No auth header');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    console.error('[ai-proxy] Auth error / No user:', userErr);
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let payload: any;
  try {
    payload = await req.json();
    console.log('[ai-proxy] Payload mode:', payload.mode, 'provider:', payload.provider);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const mode = payload.mode;
  const provider = payload.provider as Provider;
  
  if (provider !== 'gemini' && provider !== 'openai' && provider !== 'groq' && provider !== 'custom') {
    return new Response(JSON.stringify({ error: 'Invalid provider' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { apiKey, openaiBaseUrl, openaiModel, customBaseUrl, customModel, serper } = await resolveAiConfig(provider);
  
  if (mode === 'image_search') {
      if (!serper) {
          return new Response(JSON.stringify({ error: 'Додайте Serper API Key у налаштуваннях для пошуку фото.' }), {
              status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
          });
      }
      const query = payload.query;
      if (!query) return new Response(JSON.stringify({ error: 'Query is missing' }), { status: 400, headers: cors });

      console.log('[Serper] Searching for images:', query);
      const sRes = await fetch('https://google.serper.dev/images', {
          method: 'POST',
          headers: {
              'X-API-KEY': serper,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query, num: 10 })
      });
      const sData = await sRes.json();
      return new Response(JSON.stringify({ ok: true, data: sData.images || [] }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
      });
  }

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: `Немає API-ключа для ${provider}. Будь ласка, додайте його в налаштуваннях адмін-панелі.`,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (mode === 'seo' || mode === 'seo_bulk') {
      const systemPrompt = payload.systemPrompt ?? '';
      const userPrompt = payload.userPrompt ?? '';
      
      let data: Record<string, unknown>;
      if (provider === 'gemini') {
        data = await geminiGenerateSeo(apiKey, systemPrompt, userPrompt, mode);
      } else if (provider === 'openai') {
        data = await openaiCompatibleJson('https://api.openai.com/v1', apiKey, openaiModel, systemPrompt, userPrompt);
      } else if (provider === 'custom') {
        data = await openaiCompatibleJson(customBaseUrl, apiKey, customModel, systemPrompt, userPrompt);
      } else {
        data = await openaiCompatibleJson('https://api.groq.com/openai/v1', apiKey, GROQ_MODEL, systemPrompt, userPrompt);
      }
      return new Response(JSON.stringify({ ok: true, data }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const prompt = payload.prompt ?? '';
    let text: string;
    if (provider === 'gemini') {
      text = await geminiPlain(apiKey, prompt);
    } else if (provider === 'openai') {
      text = await openaiCompatiblePlain('https://api.openai.com/v1', apiKey, openaiModel, prompt);
    } else if (provider === 'custom') {
      text = await openaiCompatiblePlain(customBaseUrl, apiKey, customModel, prompt);
    } else {
      text = await openaiCompatiblePlain('https://api.groq.com/openai/v1', apiKey, GROQ_MODEL, prompt);
    }
    return new Response(JSON.stringify({ ok: true, text }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[ai-proxy] Execution error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});

