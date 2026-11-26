import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import type { TyreProduct } from '../../../types';
import { PHONE_LINK_1, PHONE_NUMBER_1 } from '../../../constants';

/** "099 167 44 24" → "tel:+380991674424" */
const telLink = (phone: string) => {
  const digits = phone.replace(/[^\d]/g, '');
  const link = digits.startsWith('0') && digits.length === 10 ? `+38${digits}` : digits.startsWith('380') ? `+${digits}` : digits;
  return `tel:${link}`;
};

/**
 * Shop settings kept in the database (table `settings`): contact phones, "count stock" switch,
 * Nova Poshta key and the goods shown in the agro banner.
 */
export const useShopSettings = () => {
  const [enableStockQty, setEnableStockQty] = useState(false);
  const [novaPoshtaKey, setNovaPoshtaKey] = useState('');
  const [shopPhone, setShopPhone] = useState(PHONE_NUMBER_1);
  const [shopPhone2, setShopPhone2] = useState('063 582 38 58');
  const [shopPhoneLink, setShopPhoneLink] = useState(PHONE_LINK_1);
  const [shopPhoneLink2, setShopPhoneLink2] = useState('tel:+380635823858');
  const [agroFeaturedProducts, setAgroFeaturedProducts] = useState<TyreProduct[]>([]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: setts } = await supabase.from('settings').select('key, value').in('key', [
        'enable_stock_quantity',
        'contact_phone1',
        'contact_phone2',
        'nova_poshta_key',
        'agro_featured_ids',
      ]);
      if (setts) {
          for (const item of setts) {
              if (item.key === 'enable_stock_quantity') setEnableStockQty(item.value === 'true');
              if (item.key === 'contact_phone1') {
                  setShopPhone(item.value);
                  setShopPhoneLink(telLink(item.value));
              }
              if (item.key === 'contact_phone2') {
                  setShopPhone2(item.value);
                  setShopPhoneLink2(telLink(item.value));
              }
              if (item.key === 'nova_poshta_key') setNovaPoshtaKey(item.value);
              if (item.key === 'agro_featured_ids' && item.value) {
                  const ids = item.value.split(',').map(Number);
                  const { data: aData } = await supabase.from('tyres').select('*').in('id', ids);
                  if (aData) {
                      const sorted = ids.map(id => aData.find(t => t.id === id)).filter(Boolean) as TyreProduct[];
                      setAgroFeaturedProducts(sorted);
                  }
              }
          }
      }
    };
    fetchSettings();
  }, []);

  return { enableStockQty, novaPoshtaKey, shopPhone, shopPhone2, shopPhoneLink, shopPhoneLink2, agroFeaturedProducts };
};
