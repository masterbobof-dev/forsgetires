import { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, MAP_DIRECT_LINK } from '../../../constants';
import type { ShowMsg } from './useSettingsMessages';

/**
 * Everything the "Зберегти зміни" button saves: contacts, keys, staff access.
 * AI is not set up on the site: it works in the program.
 */
export const useSettingsForm = (showMsg: ShowMsg) => {
  // Security Settings
  const [novaPoshtaKey, setNovaPoshtaKey] = useState('');
  const [supplierKey, setSupplierKey] = useState('');
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

  const fetchSettings = async () => {
    try {
        const { data } = await supabase.from('settings').select('*');
        if (data) {
            const newContacts = { ...contactSettings };
            data.forEach((r: any) => {
                // Keys & Security
                if(r.key === 'nova_poshta_key') setNovaPoshtaKey(r.value);
                if(r.key === 'supplier_api_key') setSupplierKey(r.value);
                if(r.key === 'service_staff_email') setServiceEmail(r.value);
                if(r.key === 'admin_email') setAdminEmail(r.value);
                if(r.key === 'manager_email') setManagerEmail(r.value);
                if(r.key === 'hide_tire_service') setHideTireService(r.value === 'true');

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
        await supabase.from('settings').upsert({ key: 'contact_phone1', value: contactSettings.phone1 });
        await supabase.from('settings').upsert({ key: 'contact_phone2', value: contactSettings.phone2 });
        await supabase.from('settings').upsert({ key: 'contact_address', value: contactSettings.address });
        await supabase.from('settings').upsert({ key: 'contact_map_link', value: contactSettings.mapLink });

        showMsg("Всі налаштування збережено!");
  };

  return {
    fetchSettings, saveAllSettings,
    contactSettings, setContactSettings,
    adminEmail, setAdminEmail, novaPoshtaKey, setNovaPoshtaKey, supplierKey, setSupplierKey,
    managerEmail, setManagerEmail, managerPassword, setManagerPassword, showManagerPassword, setShowManagerPassword,
    serviceEmail, setServiceEmail,
  };
};

export type SettingsForm = ReturnType<typeof useSettingsForm>;
