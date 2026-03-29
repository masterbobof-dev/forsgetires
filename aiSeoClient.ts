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

/** SEO Bulk JSON через Edge Function `ai-proxy` (масова обробка). */
export async function generateSeoBulkJson(params: {
  provider: AIProviderId;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ results: any[] }> {
  const res = await invokeAiProxy({
    mode: 'seo_bulk',
    provider: params.provider,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
  });
  if (!res.data || !Array.isArray(res.data.results)) {
    throw new Error('AI не повернув масив результатів. Можливо, потрібно оновити Edge Function.');
  }
  return res.data;
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
