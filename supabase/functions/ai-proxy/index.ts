import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { mode, query } = body;

    console.log('[ai-proxy] Mode:', mode, 'Query:', query);

    // IMAGE SEARCH MODE
    if (mode === 'image_search') {
      // 1. Get key from DB
      const { data: keysData, error: keysError } = await supabaseAdmin
        .from('ai_api_keys')
        .select('serper_key, gemini_key, openai_key, groq_key, custom_key, custom_url, custom_model')
        .eq('id', 1)
        .maybeSingle();

      if (keysError) {
        console.error('[ai-proxy] DB error:', keysError.message);
        return jsonResponse({ error: 'DB Error: ' + keysError.message });
      }

      // Get key from DB and sanitize to pure ASCII
      const rawKey = keysData?.serper_key;
      if (!rawKey) {
        return jsonResponse({ error: 'Додайте Serper API Key у налаштуваннях.' });
      }
      // Keep ONLY printable ASCII characters (codes 32-126)
      const cleanKey = String(rawKey).split('').filter(c => {
        const code = c.charCodeAt(0);
        return code >= 32 && code <= 126;
      }).join('').trim();
      console.log('[ai-proxy] Key length:', cleanKey.length);

      // 3. Call Serper API using Headers object (avoid plain object issues)
      const serperHeaders = new Headers();
      serperHeaders.set('Content-Type', 'application/json');
      serperHeaders.set('X-API-KEY', cleanKey);

      console.log('[ai-proxy] Calling Serper for:', query);

      const serperRes = await fetch('https://google.serper.dev/images', {
        method: 'POST',
        headers: serperHeaders,
        body: JSON.stringify({ q: query, num: 10 })
      });

      if (!serperRes.ok) {
        const errBody = await serperRes.text();
        console.error('[ai-proxy] Serper error:', serperRes.status, errBody);
        return jsonResponse({ error: `Serper ${serperRes.status}: ${errBody}` });
      }

      const serperData = await serperRes.json();
      const images = serperData.images || [];
      console.log('[ai-proxy] Found', images.length, 'images');
      
      return jsonResponse({ ok: true, data: images });
    }

    // SEO / PLAIN TEXT MODES
    if (mode === 'seo' || mode === 'plain' || mode === 'seo_batch') {
      const keysData = await supabaseAdmin.from('ai_api_keys').select('*').eq('id', 1).maybeSingle();
      const keys = keysData.data || {};
      
      const provider = body.provider || 'gemini';
      console.log('[ai-proxy] Chat mode with provider:', provider);

      let targetUrl = '';
      let apiKey = '';
      let targetModel = '';

      if (provider === 'gemini') {
        apiKey = keys.gemini_key || '';
        targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      } else if (provider === 'openai') {
        apiKey = keys.openai_key || '';
        targetUrl = 'https://api.openai.com/v1/chat/completions';
      } else if (provider === 'custom') {
        apiKey = keys.custom_key || '';
        targetUrl = keys.custom_url || 'https://api.openai.com/v1/chat/completions';
        targetModel = keys.custom_model || 'gpt-3.5-turbo';
      }

      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      if (provider !== 'gemini' && apiKey) {
        headers.set('Authorization', `Bearer ${apiKey.trim()}`);
      }

      let payload: any = {};
      const userPrompt = query;

      if (provider === 'gemini') {
        payload = { contents: [{ parts: [{ text: userPrompt }] }] };
      } else {
        // OpenAI / Custom format
        payload = {
          model: targetModel || (provider === 'openai' ? 'gpt-4o-mini' : targetModel),
          messages: [{ role: 'user', content: userPrompt }],
          temperature: 0.7
        };
      }

      console.log('[ai-proxy] Sending request to:', targetUrl);
      const aiRes = await fetch(targetUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!aiRes.ok) {
        const text = await aiRes.text();
        return jsonResponse({ error: `AI Error ${aiRes.status}: ${text}` });
      }

      const aiData = await aiRes.json();
      let resultText = '';

      if (provider === 'gemini') {
        resultText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        resultText = aiData?.choices?.[0]?.message?.content || '';
      }

      return jsonResponse({ ok: true, text: resultText });
    }

    return jsonResponse({ error: 'Unsupported mode: ' + mode });

  } catch (err) {
    console.error('[ai-proxy] FATAL:', err);
    return jsonResponse({ 
      error: String(err?.message || err),
      stack: String(err?.stack || 'no stack')
    });
  }
})
