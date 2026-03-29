import { invokeAiProxy } from './aiProxyClient';
import type { AIProviderId } from './aiTypes';

export type { AIProviderId };

/** @deprecated Залишено для сумісності; ключі не використовуються — усе йде через Edge Function. */
export interface AiKeyBundle {
  gemini?: string;
  openai?: string;
  groq?: string;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

export function parseJsonFromAiText(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    const v = JSON.parse(trimmed);
    if (v && typeof v === 'object') return v as Record<string, unknown>;
  } catch {
    /* fallback */
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    const v = JSON.parse(match[0]);
    if (v && typeof v === 'object') return v as Record<string, unknown>;
  }
  throw new Error('AI повернув некоректний формат. Спробуйте ще раз.');
}

/** SEO JSON через Edge Function `ai-proxy` (ключі на сервері). */
export async function generateSeoJson(params: {
  provider: AIProviderId;
  systemPrompt: string;
  userPrompt: string;
}): Promise<Record<string, unknown>> {
  const res = await invokeAiProxy({
    mode: 'seo',
    provider: params.provider,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
  });
  if (!res.data || typeof res.data !== 'object') {
    throw new Error('AI не повернув JSON-дані');
  }
  return res.data;
}

export async function generateSeoBulkJson(params: {
  provider: AIProviderId;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ results: any[] }> {
  // Use mode 'seo_batch' or 'seo' because the older deployed edge function only supports those.
  // Pass the combined prompt via 'query' to support the old edge function format.
  const res = await invokeAiProxy({
    mode: 'seo',
    provider: params.provider,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    query: `${params.systemPrompt}\n\n${params.userPrompt}`
  } as any);

  let parsedData: any = null;

  // Try to use pre-parsed data if the new edge function processed it
  if (res.data && typeof res.data === 'object' && Array.isArray((res.data as any).results)) {
    parsedData = res.data;
  } 
  // Otherwise, manually extract and parse JSON from the raw text (for the old edge function)
  else if (res.text) {
    try {
      parsedData = parseJsonFromAiText(res.text);
    } catch (e) {
      console.error("Local JSON parse failed:", e);
    }
  }

  if (!parsedData || !Array.isArray(parsedData.results)) {
    throw new Error('AI не повернув масив результатів. Спробуйте ще раз або перевірте налаштування AI.');
  }

  return parsedData;
}

/** Простий текст через Edge Function `ai-proxy`. */
export async function generatePlainDescription(params: {
  provider: AIProviderId;
  prompt: string;
}): Promise<string> {
  const res = await invokeAiProxy({
    mode: 'plain',
    provider: params.provider,
    prompt: params.prompt,
  });
  if (!res.text?.trim()) throw new Error('Порожня відповідь AI');
  return res.text.trim();
}

export function normalizeProviderId(v: string | null | undefined): AIProviderId {
  if (v === 'openai' || v === 'groq' || v === 'gemini' || v === 'custom') return v;
  return 'gemini';
}
