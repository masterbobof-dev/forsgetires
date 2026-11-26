import { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, MAP_DIRECT_LINK } from '../../../constants';
import { normalizeProviderId, type AIProviderId } from '../../../aiSeoClient';
import { fetchAdminAiKeyStatus, saveAdminAiKeys } from '../../../aiProxyClient';
import type { ShowMsg } from './useSettingsMessages';

/**
 * Everything the "Зберегти зміни" button saves: contacts, keys, the AI provider, staff access.
 * AI keys are never read back: the server only says whether a key is stored (hasKey…).
 */
export const useSettingsForm = (showMsg: ShowMsg) => {
  // Security Settings
  const [novaPoshtaKey, setNovaPoshtaKey] = useState('');
  const [supplierKey, setSupplierKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [groqKey, setGroqKey] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [aiProvider, setAiProvider] = useState<AIProviderId>('gemini');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showCustomKey, setShowCustomKey] = useState(false);
  const [showSerperKey, setShowSerperKey] = useState(false);
  const [serperKey, setSerperKey] = useState('');
  const [hasKeyGemini, setHasKeyGemini] = useState(false);
  const [hasKeyOpenai, setHasKeyOpenai] = useState(false);
  const [hasKeyGroq, setHasKeyGroq] = useState(false);
  const [hasKeyCustom, setHasKeyCustom] = useState(false);
  const [hasKeySerper, setHasKeySerper] = useState(false);
  const [serviceEmail, setServiceEmail] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [isUpdatingManager, setIsUpdatingManager] = useState(false);
  const [hideTireService, setHideTireService] = useState(false);

  // Contact Settings
  const [contactSettings, setContactSettings] = useState({
      phone1: PHONE_NUMBER_1,
      phone2: PHONE_NUMBER_2,
      address: 'м. Синельникове, вул. Квітнева 9',
      mapLink: MAP_DIRECT_LINK
  });

  const refreshAiKeyFlags = async () => {
    try {
      const s = await fetchAdminAiKeyStatus();
      setHasKeyGemini(s.hasGemini);
      setHasKeyOpenai(s.hasOpenai);
      setHasKeyGroq(s.hasGroq);
      setHasKeyCustom(s.hasCustom);
      setHasKeySerper(s.hasSerper);
      if (s.customUrl) setCustomBaseUrl(s.customUrl);
      if (s.customModel) setCustomModel(s.customModel);
    } catch {
      setHasKeyGemini(false);
      setHasKeyOpenai(false);
      setHasKeyGroq(false);
      setHasKeyCustom(false);
      setHasKeySerper(false);
    }
  };

  const fetchSettings = async () => {
    try {
        const { data } = await supabase.from('settings').select('*');
        if (data) {
            const newContacts = { ...contactSettings };
            data.forEach((r: any) => {
                // Keys & Security
                if(r.key === 'nova_poshta_key') setNovaPoshtaKey(r.value);
                if(r.key === 'supplier_api_key') setSupplierKey(r.value);
                if(r.key === 'ai_provider') setAiProvider(normalizeProviderId(r.value));
                if(r.key === 'service_staff_email') setServiceEmail(r.value);
                if(r.key === 'admin_email') setAdminEmail(r.value);
                if(r.key === 'manager_email') setManagerEmail(r.value);
                if(r.key === 'hide_tire_service') setHideTireService(r.value === 'true');
                if(r.key === 'ai_openai_base_url') setOpenaiBaseUrl(r.value);
                if(r.key === 'ai_openai_model') setOpenaiModel(r.value);
                if(r.key === 'ai_custom_base_url') setCustomBaseUrl(r.value);
                if(r.key === 'ai_custom_model') setCustomModel(r.value);

                // Contacts
                if(r.key === 'contact_phone1') newContacts.phone1 = r.value;
                if(r.key === 'contact_phone2') newContacts.phone2 = r.value;
                if(r.key === 'contact_address') newContacts.address = r.value;
                if(r.key === 'contact_map_link') newContacts.mapLink = r.value;
            });
            setContactSettings(newContacts);
        }
    } catch (e) { console.error(e); }
  };

  const saveAllSettings = async () => {
        await supabase.from('settings').upsert({ key: 'nova_poshta_key', value: novaPoshtaKey });
        await supabase.from('settings').upsert({ key: 'supplier_api_key', value: supplierKey });
        await supabase.from('settings').upsert({ key: 'ai_provider', value: aiProvider });
        await supabase.from('settings').upsert({ key: 'service_staff_email', value: serviceEmail });
        await supabase.from('settings').upsert({ key: 'admin_email', value: adminEmail });

        await supabase.from('settings').upsert({ key: 'hide_tire_service', value: hideTireService ? 'true' : 'false' });

        if (managerEmail.trim() && managerPassword.trim()) {
            setIsUpdatingManager(true);
            const { error: rpcError } = await supabase.rpc('set_manager_credentials', {
                m_email: managerEmail.trim(),
                m_password: managerPassword.trim()
            });
            setIsUpdatingManager(false);
            if (rpcError) {
                showMsg("Помилка при створенні/оновленні менеджера: " + rpcError.message, 'error');
                return;
            }
            setManagerPassword(''); // Clear password field after success
        } else {
            await supabase.from('settings').upsert({ key: 'manager_email', value: managerEmail.trim() });
        }
        await supabase.from('settings').upsert({ key: 'ai_openai_base_url', value: openaiBaseUrl });
        await supabase.from('settings').upsert({ key: 'ai_openai_model', value: openaiModel });
        await supabase.from('settings').upsert({ key: 'ai_custom_base_url', value: customBaseUrl });
        await supabase.from('settings').upsert({ key: 'ai_custom_model', value: customModel });
        await supabase.from('settings').upsert({ key: 'contact_phone1', value: contactSettings.phone1 });
        await supabase.from('settings').upsert({ key: 'contact_phone2', value: contactSettings.phone2 });
        await supabase.from('settings').upsert({ key: 'contact_address', value: contactSettings.address });
        await supabase.from('settings').upsert({ key: 'contact_map_link', value: contactSettings.mapLink });

        const aiPayload: Record<string, string> = {};
        if (geminiKey.trim()) aiPayload.gemini = geminiKey.trim();
        if (openaiKey.trim()) aiPayload.openai = openaiKey.trim();
        if (groqKey.trim()) aiPayload.groq = groqKey.trim();
        if (customKey.trim()) aiPayload.custom = customKey.trim();
        if (serperKey.trim()) aiPayload.serper = serperKey.trim();
        if (customBaseUrl.trim()) aiPayload.customUrl = customBaseUrl.trim();
        if (customModel.trim()) aiPayload.customModel = customModel.trim();
        if (Object.keys(aiPayload).length > 0) {
          await saveAdminAiKeys(aiPayload);
          setGeminiKey('');
          setOpenaiKey('');
          setGroqKey('');
          setCustomKey('');
          setSerperKey('');
          await refreshAiKeyFlags();
        }

        showMsg("Всі налаштування збережено!");
  };

  return {
    fetchSettings, refreshAiKeyFlags, saveAllSettings,
    contactSettings, setContactSettings,
    adminEmail, setAdminEmail, novaPoshtaKey, setNovaPoshtaKey, supplierKey, setSupplierKey,
    aiProvider, setAiProvider,
    geminiKey, setGeminiKey, showGeminiKey, setShowGeminiKey, hasKeyGemini,
    openaiKey, setOpenaiKey, showOpenaiKey, setShowOpenaiKey, hasKeyOpenai, openaiModel, setOpenaiModel,
    customKey, setCustomKey, showCustomKey, setShowCustomKey, hasKeyCustom, customBaseUrl, setCustomBaseUrl, customModel, setCustomModel,
    groqKey, setGroqKey, showGroqKey, setShowGroqKey, hasKeyGroq,
    serperKey, setSerperKey, showSerperKey, setShowSerperKey, hasKeySerper,
    managerEmail, setManagerEmail, managerPassword, setManagerPassword, showManagerPassword, setShowManagerPassword,
    serviceEmail, setServiceEmail,
  };
};

export type SettingsForm = ReturnType<typeof useSettingsForm>;
