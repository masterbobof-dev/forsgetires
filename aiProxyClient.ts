/**
 * Виклики Edge Functions для AI (ключі на сервері: ai_api_keys + ai-proxy).
 */
import { supabase } from './supabaseClient';
import type { AIProviderId } from './aiTypes';

export type AiProxySeoPayload = {
  mode: 'seo';
  provider: AIProviderId;
  systemPrompt: string;
  userPrompt: string;
};

export type AiProxySeoBulkPayload = {
  mode: 'seo_bulk';
  provider: AIProviderId;
  systemPrompt: string;
  userPrompt: string;
};

export type AiProxyPlainPayload = {
  mode: 'plain';
  provider: AIProviderId;
  prompt: string;
};

export type AiProxyImageSearchPayload = {
  mode: 'image_search';
  query: string;
  provider?: AIProviderId;
};

export type AdminAiKeyStatus = {
  hasGemini: boolean;
  hasOpenai: boolean;
  hasGroq: boolean;
  hasCustom: boolean;
  hasSerper: boolean;
  customUrl?: string;
  customModel?: string;
};

export async function invokeAiProxy(
  payload: AiProxySeoPayload | AiProxySeoBulkPayload | AiProxyPlainPayload | AiProxyImageSearchPayload
): Promise<{ ok: true; data?: any; text?: string }> {
  console.log('[AI Proxy Request]', payload);
  const { data, error } = await supabase.functions.invoke('ai-proxy', { body: payload });
  
  if (error) {
    console.error('[AI Proxy Network Error]', error);
    throw new Error(error.message);
  }
  
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    console.error('[AI Proxy Response Error]', data.error);
    throw new Error((data as { error: string }).error);
  }
  
  console.log('[AI Proxy Response OK]', data);
  return data as { ok: true; data?: Record<string, unknown>; text?: string };
}

/** Лише для власника (email = admin_email). Повертає, чи збережені ключі (без самих ключів). */
export async function fetchAdminAiKeyStatus(): Promise<AdminAiKeyStatus> {
  const { data, error } = await supabase.functions.invoke('admin-ai-keys', {
    body: { action: 'status' },
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  const d = data as { ok?: boolean; hasGemini?: boolean; hasOpenai?: boolean; hasGroq?: boolean; hasCustom?: boolean; hasSerper?: boolean; customUrl?: string; customModel?: string };
  return {
    hasGemini: !!d.hasGemini,
    hasOpenai: !!d.hasOpenai,
    hasGroq: !!d.hasGroq,
    hasCustom: !!d.hasCustom,
    hasSerper: !!d.hasSerper,
    customUrl: d.customUrl || '',
    customModel: d.customModel || '',
  };
}

/** Зберегти лише передані поля (непорожній рядок). Порожній рядок у полі — видалити цей ключ. */
export async function saveAdminAiKeys(keys: Partial<Record<'gemini' | 'openai' | 'groq' | 'custom' | 'serper' | 'customUrl' | 'customModel', string>>): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-ai-keys', { body: keys });
  if (error) throw new Error(error.message);
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
}

export function hasProviderKey(status: AdminAiKeyStatus, provider: AIProviderId): boolean {
  if (provider === 'gemini') return status.hasGemini;
  if (provider === 'openai') return status.hasOpenai;
  if (provider === 'custom') return status.hasCustom;
  return status.hasGroq;
}
