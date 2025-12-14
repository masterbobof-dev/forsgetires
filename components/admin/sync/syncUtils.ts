
import { supabase } from '../../../supabaseClient';

// --- HELPERS ---
export const getValueByPath = (obj: any, path: string) => {
    if (!path || !obj) return undefined;
    if (path === '.') return obj;
    try {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    } catch (e) {
        return undefined;
    }
};

export const safeExtractString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val.value !== undefined) return String(val.value);
        if (val.name !== undefined) return String(val.name);
        if (val.id !== undefined) return String(val.id);
        if (val.code !== undefined) return String(val.code);
        return ''; 
    }
    return String(val).trim();
};

export const smartExtractPrice = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;

    let str = '';

    if (Array.isArray(val)) {
        if (val.length === 0) return 0;
        return smartExtractPrice(val[0]);
    }

    if (typeof val === 'object') {
        if (val.CustomerPrice) return smartExtractPrice(val.CustomerPrice);
        if (val.Price) return smartExtractPrice(val.Price);
        
        const candidates = [
            val.Value, val.value, val.Amount, val.amount, val.Retail, val.retail,
            val.Cost, val.cost, val.Rrc, val.rrc, val.Uah, val.uah
        ];
        const found = candidates.find(c => c !== undefined && c !== null && smartExtractPrice(c) > 0);
        if (found !== undefined) return smartExtractPrice(found);
        
        const values = Object.values(val);
        const numVal = values.find(v => typeof v === 'number' && v > 0);
        if (numVal) return numVal as number;
        
        return 0; 
    }

    str = String(val).trim();
    str = str.replace(/\s/g, '').replace(/\u00A0/g, '');
    if (str.includes(',')) {
        const parts = str.split(',');
        if (parts[parts.length-1].length === 2) {
             str = str.split('.').join(''); 
             str = str.replace(',', '.');   
        } else {
             str = str.split(',').join('');
        }
    } else {
        if ((str.match(/\./g) || []).length > 1) {
             str = str.replace(/\./g, '');
        }
    }
    str = str.replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
};

export const findPriceRecursively = (obj: any): number => {
    if (!obj || typeof obj !== 'object') return 0;
    if (obj.CustomerPrice !== undefined) {
        const cp = smartExtractPrice(obj.CustomerPrice);
        if (cp > 0) return cp;
    }
    if (obj.Price !== undefined) {
        const p = smartExtractPrice(obj.Price);
        if (p > 0) return p;
    }
    const priorityKeys = ['price', 'retail', 'cost', 'value', 'uah'];
    for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        if (priorityKeys.some(pk => lowerKey.includes(pk))) {
             const val = smartExtractPrice(obj[key]);
             if (val > 0) return val;
        }
    }
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') {
            const res = findPriceRecursively(obj[key]);
            if (res > 0) return res;
        }
    }
    return 0;
};

export const detectSeason = (text: string): string => {
    const t = String(text).toLowerCase();
    if (t.includes('зима') || t.includes('зимн') || t.includes('winter') || t.includes('snow') || t.includes('ice') || t.includes('stud') || t.includes('w442') || t.includes('ws')) return 'winter';
    if (t.includes('літо') || t.includes('літн') || t.includes('summer') || t.includes('sport') || t.includes('k125') || t.includes('ventu')) return 'summer';
    if (t.includes('всесезон') || t.includes('all season') || t.includes('4s')) return 'all-season';
    return 'summer';
};

export const scanForArrays = (obj: any, path = '', depth = 0): { path: string, count: number }[] => {
    if (!obj || typeof obj !== 'object' || depth > 3) return [];
    let candidates: { path: string, count: number }[] = [];
    if (Array.isArray(obj)) {
        if (obj.length > 0) candidates.push({ path: path || 'root', count: obj.length });
        return candidates;
    }
    const keys = Object.keys(obj);
    if (keys.length > 5) {
        const values = Object.values(obj);
        const objectValues = values.filter(v => typeof v === 'object' && v !== null && !Array.isArray(v));
        if (objectValues.length > keys.length * 0.8) candidates.push({ path: path || 'root', count: keys.length });
    }
    for (const key of keys) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            candidates = [...candidates, ...scanForArrays(obj[key], path ? `${path}.${key}` : key, depth + 1)];
        }
    }
    return candidates.sort((a,b) => b.count - a.count);
};

export const cleanHeaders = (headers: any) => {
    const cleaned: any = {};
    if (!headers) return cleaned;
    Object.keys(headers).forEach(key => {
        const lower = key.toLowerCase();
        if (lower !== 'host' && lower !== 'content-length' && lower !== 'connection' && lower !== 'accept-encoding') {
            cleaned[key] = headers[key];
        }
    });
    return cleaned;
};

export const requestServerSideUpload = async (bodyPayload: any, productId: string | number): Promise<{ imageUrl: string, status: number }> => {
    // We send a flag "saveToStorage: true" and the filename to the Edge Function
    const requestData = {
        ...bodyPayload,
        _saveToStorage: true,
        _fileName: `tyre_${productId}_${Date.now()}.jpg`
    };

    const { data, error } = await supabase.functions.invoke('foto', {
        body: requestData
    });

    if (error) {
        throw new Error("Edge Function Error: " + error.message);
    }

    if (!data) {
        throw new Error("SERVER ERROR: Порожня відповідь.");
    }

    // Check for Logic Errors returned by our function
    if (data.error) {
        const errLower = data.error.toLowerCase();
        if (errLower.includes("limit") || errLower.includes("exceeded")) throw new Error("LIMIT_EXCEEDED");
        throw new Error("API/Server Error: " + data.error);
    }

    if (!data.imageUrl) {
        throw new Error("Сервер не повернув посилання на фото.");
    }

    return { imageUrl: data.imageUrl, status: 200 };
};

export const PHOTO_DEFAULT_CONFIG = {
    method: 'POST',
    url: 'https://public.omega.page/public/api/v1.0/product/image',
    headers: '{\n  "Content-Type": "application/json",\n  "Accept": "image/jpeg"\n}',
    body: JSON.stringify({
      "ProductId": 0,
      "Number": 1,
      "Key": "INSERT_KEY_HERE"
    }, null, 2)
};

export const EDGE_FUNCTION_CODE = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, method, headers, body, _saveToStorage, _fileName } = await req.json()

    if (!url) throw new Error("Missing URL");

    // 1. Prepare Headers for Omega
    const upstreamHeaders = new Headers(headers || {})
    const forbidden = ['host', 'content-length', 'connection', 'origin', 'referer'];
    forbidden.forEach(k => upstreamHeaders.delete(k));
    upstreamHeaders.set('Accept', 'image/jpeg, image/png, application/json');
    if (body) upstreamHeaders.set('Content-Type', 'application/json');

    console.log(\`Fetching: \${method} \${url}\`);

    // 2. Fetch from Omega
    const res = await fetch(url, {
      method: method || 'GET',
      headers: upstreamHeaders,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    })

    // 3. Get Binary Data
    const arrayBuffer = await res.arrayBuffer();

    // 4. Validate Data (Check if it's JSON error or HTML)
    if (arrayBuffer.byteLength < 500) {
        const text = new TextDecoder().decode(arrayBuffer);
        // Check for specific Omega errors
        if (text.includes('request_limit_exceeded')) throw new Error("request_limit_exceeded");
        if (text.includes('Error') || text.includes('false')) throw new Error("API Error: " + text);
        if (arrayBuffer.byteLength === 0) throw new Error("Empty response from API");
    }

    // Check Magic Numbers (Simple JPEG/PNG check)
    const view = new Uint8Array(arrayBuffer);
    const isJpeg = view[0] === 0xFF && view[1] === 0xD8;
    const isPng = view[0] === 0x89 && view[1] === 0x50;
    
    if (!isJpeg && !isPng && view[0] !== 0x00) {
       const text = new TextDecoder().decode(view.slice(0, 100));
       throw new Error("Not an image. Response start: " + text);
    }

    // 5. SERVER-SIDE UPLOAD (If requested)
    if (_saveToStorage && _fileName) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        
        if (!supabaseKey) throw new Error("Server Config Error: Missing Service Role Key");

        const supabase = createClient(supabaseUrl, supabaseKey);
        const contentType = isPng ? 'image/png' : 'image/jpeg';
        
        const { data, error } = await supabase.storage
            .from('galery')
            .upload(_fileName, arrayBuffer, { contentType: contentType, upsert: true });

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
            .from('galery')
            .getPublicUrl(_fileName);

        return new Response(JSON.stringify({ imageUrl: publicUrlData.publicUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Fallback: Return binary (Legacy Mode)
    return new Response(arrayBuffer, {
      status: res.status,
      headers: {
        ...corsHeaders,
        'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': String(arrayBuffer.byteLength)
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})`;
