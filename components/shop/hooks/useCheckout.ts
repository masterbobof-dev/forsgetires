import { useEffect, useState } from 'react';
import type React from 'react';
import { supabase } from '../../../supabaseClient';
import type { TyreProduct, CartItem } from '../../../types';
import { formatUaPhone, isValidUaPhone } from '../../../phone';
import { logAnalyticsEvent } from '../../admin/analytics';
import { safeParsePrice } from '../shopUtils';

interface CheckoutParams {
  /** signed-in customer: the order is linked to the account, the form is prefilled from the profile */
  userId?: string;
  userEmail?: string;
  cartItems: CartItem[];
  onCartChange: (items: CartItem[]) => void;
  novaPoshtaKey: string;
}

/** the database refuses some orders with a text meant for the customer; anything else gets a general message */
const orderErrorText = (err: any) =>
  /Забагато|телефону|немає товарів/.test(err?.message || '') ? err.message : "Помилка при відправці замовлення. Спробуйте ще раз або зателефонуйте нам";

/**
 * Everything about placing an order: the cart form (name, phone, delivery, Nova Poshta city and warehouse, payment),
 * sending the order, and the "buy in 1 click / ask the price" request.
 */
export const useCheckout = ({ userId, userEmail, cartItems, onCartChange, novaPoshtaKey }: CheckoutParams) => {
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'newpost'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'prepayment' | 'full'>('prepayment');

  const [npSearchCity, setNpSearchCity] = useState('');
  const [npCities, setNpCities] = useState<any[]>([]);
  const [npWarehouses, setNpWarehouses] = useState<any[]>([]);
  const [selectedCityRef, setSelectedCityRef] = useState('');
  const [selectedCityName, setSelectedCityName] = useState('');
  const [selectedWarehouseName, setSelectedWarehouseName] = useState('');
  const [isNpLoadingCities, setIsNpLoadingCities] = useState(false);
  const [isNpLoadingWarehouses, setIsNpLoadingWarehouses] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const [orderSending, setOrderSending] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');

  const [quickOrderProduct, setQuickOrderProduct] = useState<TyreProduct | null>(null);
  const [quickOrderPhone, setQuickOrderPhone] = useState('');
  const [quickOrderSending, setQuickOrderSending] = useState(false);

  // Prefill checkout from the customer's profile
  useEffect(() => {
    if (!userId) return;
    supabase.from('customer_profiles').select('full_name, phone, city, warehouse').eq('id', userId).maybeSingle().then(({ data }) => {
      if (!data) return;
      if (data.full_name) setOrderName(prev => prev || data.full_name);
      if (data.phone) { setOrderPhone(prev => prev || formatUaPhone(data.phone)); setQuickOrderPhone(prev => prev || formatUaPhone(data.phone)); }
      if (data.city) { setNpSearchCity(prev => prev || data.city); setSelectedCityName(prev => prev || data.city); }
      if (data.warehouse) setSelectedWarehouseName(prev => prev || data.warehouse);
    });
  }, [userId]);

  const submitQuickOrder = async () => {
    if (!isValidUaPhone(quickOrderPhone)) { setOrderError("Введіть номер повністю: +380 XX XXX XX XX"); return; }
    if (!quickOrderProduct) return;

    setQuickOrderSending(true); setOrderError('');
    try {
      const { error } = await supabase.from('tyre_orders').insert([{
          customer_name: orderName || 'Швидке замовлення',
          customer_phone: quickOrderPhone,
          status: 'new',
          user_id: userId || null,
          customer_email: userEmail || null,
          items: [{ id: quickOrderProduct.id, title: quickOrderProduct.title, quantity: 1, price: quickOrderProduct.on_order && !quickOrderProduct.supplier_offer_id ? '0' : quickOrderProduct.price }],
          ...(quickOrderProduct.on_order && !quickOrderProduct.supplier_offer_id ? { comment: 'Запит ціни і терміну постачання (товар під замовлення)' } : {}),
      }]);
      if (error) throw error;
      logAnalyticsEvent('purchase', String(quickOrderProduct.id), quickOrderProduct.title, undefined, safeParsePrice(quickOrderProduct.price));
      setOrderSuccess(true);
      setQuickOrderProduct(null);
      setQuickOrderPhone('');
    } catch (err: any) { setOrderError(orderErrorText(err)); } finally { setQuickOrderSending(false); }
  };

  /** sends the order; `selected` = only the ticked goods of the cart (the rest stay in the cart) */
  const submitOrder = async (selected?: CartItem[]) => {
    const items = selected?.length ? selected : cartItems;
    // Nova Poshta needs the full name: at least surname + name
    if (orderName.trim().split(/\s+/).filter(w => w.replace(/[^a-zа-яіїєґ'’-]/gi, '').length >= 2).length < 2) { setOrderError("Вкажіть прізвище та ім'я повністю (ПІБ) — без цього Нова Пошта не видасть посилку"); return; }
    if (!isValidUaPhone(orderPhone)) { setOrderError("Введіть телефон повністю: +380 XX XXX XX XX"); return; }
    setOrderSending(true); setOrderError('');
    try {
      const { error } = await supabase.from('tyre_orders').insert([{
          customer_name: orderName,
          customer_phone: orderPhone,
          status: 'new',
          delivery_method: deliveryMethod,
          delivery_city: selectedCityName,
          delivery_warehouse: selectedWarehouseName,
          payment_method: paymentMethod,
          user_id: userId || null,
          customer_email: userEmail || null,
          items: items.map(i => ({ id: i.id, title: i.title, quantity: i.quantity, price: i.on_order && !i.supplier_offer_id ? '0' : i.price }))
      }]);
      if (error) throw error;
      logAnalyticsEvent('purchase', items.map(i => i.id).join(','), `${items.length} товар(и)`, undefined,
        items.reduce((sum, i) => sum + safeParsePrice(i.price) * i.quantity, 0));
      // remember name / phone / delivery address in the customer's profile
      if (userId) {
        supabase.from('customer_profiles').upsert({
          id: userId, full_name: orderName, phone: orderPhone,
          ...(deliveryMethod === 'newpost' && selectedCityName ? { city: selectedCityName, warehouse: selectedWarehouseName } : {}),
          updated_at: new Date().toISOString(),
        }).then(() => {});
      }
      setOrderSuccess(true);
      onCartChange(cartItems.filter(i => !items.some(s => s.id === i.id)));
    } catch (err: any) { setOrderError(orderErrorText(err)); } finally { setOrderSending(false); }
  };

  const fetchNpCities = async (term: string) => {
    if(!novaPoshtaKey) return;
    setIsNpLoadingCities(true);
    try {
        const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            body: JSON.stringify({ apiKey: novaPoshtaKey, modelName: "Address", calledMethod: "searchSettlements", methodProperties: { CityName: term, Limit: "20" } })
        });
        const data = await res.json();
        if (data.success) { setNpCities(data.data[0]?.Addresses || []); setShowCityDropdown(true); }
    } catch (e) { console.error(e); } finally { setIsNpLoadingCities(false); }
  };

  const fetchNpWarehouses = async (cityRef: string) => {
    if(!novaPoshtaKey) return;
    setIsNpLoadingWarehouses(true);
    try {
        const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            body: JSON.stringify({ apiKey: novaPoshtaKey, modelName: "Address", calledMethod: "getWarehouses", methodProperties: { CityRef: cityRef } })
        });
        const data = await res.json();
        if (data.success) setNpWarehouses(data.data);
    } catch (e) { console.error(e); } finally { setIsNpLoadingWarehouses(false); }
  };

  const handleCityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setNpSearchCity(e.target.value); if(e.target.value.length > 2) fetchNpCities(e.target.value); };
  const handleCitySelect = (city: any) => { setNpSearchCity(city.Present); setSelectedCityName(city.Present); setSelectedCityRef(city.DeliveryCity); setShowCityDropdown(false); fetchNpWarehouses(city.DeliveryCity); };

  return {
    /** props of the cart drawer form (see CartDrawer) */
    form: {
      orderName, setOrderName, orderPhone, setOrderPhone,
      deliveryMethod, setDeliveryMethod, paymentMethod, setPaymentMethod,
      npSearchCity, handleCityInputChange, isNpLoadingCities, showCityDropdown, npCities, handleCitySelect,
      selectedWarehouseName, setSelectedWarehouseName, isNpLoadingWarehouses, npWarehouses, selectedCityRef,
      orderSending, orderSuccess, orderError, setOrderSuccess, submitOrder,
    },
    /** "buy in 1 click" / "ask the price" window */
    quickOrder: {
      product: quickOrderProduct, open: setQuickOrderProduct, close: () => setQuickOrderProduct(null),
      phone: quickOrderPhone, setPhone: setQuickOrderPhone, sending: quickOrderSending, submit: submitQuickOrder, error: orderError,
    },
    /** the customer's name from the form (also signs reviews) */
    orderName,
  };
};
