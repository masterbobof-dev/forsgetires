
import React from 'react';
import { formatUaPhone } from '../../phone';
import { X, ShoppingBag, Trash2, Minus, Plus, Truck, MapPin, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { CartItem } from '../../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  cartTotal: number;
  orderName: string;
  setOrderName: (v: string) => void;
  orderPhone: string;
  setOrderPhone: (v: string) => void;
  deliveryMethod: 'pickup' | 'newpost';
  setDeliveryMethod: (v: 'pickup' | 'newpost') => void;
  paymentMethod: 'prepayment' | 'full';
  setPaymentMethod: (v: 'prepayment' | 'full') => void;
  npSearchCity: string;
  handleCityInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isNpLoadingCities: boolean;
  showCityDropdown: boolean;
  npCities: any[];
  handleCitySelect: (city: any) => void;
  selectedWarehouseName: string;
  setSelectedWarehouseName: (v: string) => void;
  isNpLoadingWarehouses: boolean;
  npWarehouses: any[];
  selectedCityRef: string;
  updateQuantity: (id: number, delta: number) => void;
  removeFromCart: (id: number) => void;
  submitOrder: (selected?: CartItem[]) => void;
  orderSending: boolean;
  orderSuccess: boolean;
  orderError: string;
  setOrderSuccess: (v: boolean) => void;
  formatPrice: (p: string | undefined) => string;
}

const priceOf = (i: CartItem) => (i.on_order ? 0 : parseFloat(String(i.price || '0').replace(/[^\d.]/g, '')) || 0);
const money = (n: number) => n.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Availability of a cart line, like on the product card. */
const Stock: React.FC<{ item: CartItem }> = ({ item }) => {
  // the delivery time is set in the shop program for each product
  if (item.on_order) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 rounded-lg px-2 py-1">Під замовлення · {item.lead_days ? `очікування ${item.lead_days} дн.` : 'термін уточнить менеджер'}</span>;
  const q = Number(item.stock_quantity || 0);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2 py-1">
      В наявності{q > 0 ? `: ${q > 10 ? '>10' : q} шт` : ''}
    </span>
  );
};

/**
 * Cart in two steps: 1) the list — tick what to order, change quantities, see the sum;
 * 2) the order form — contacts and delivery. Arrows at the top go back; the sum and the main button stay at the bottom.
 */
const CartDrawer: React.FC<CartDrawerProps> = (props) => {
  const [step, setStep] = React.useState<'cart' | 'checkout'>('cart');
  const [off, setOff] = React.useState<Set<number>>(new Set());
  React.useEffect(() => { if (props.isOpen) setStep('cart'); }, [props.isOpen]);
  // goods removed from the cart drop out of the "not ticked" list too
  React.useEffect(() => { setOff(prev => new Set([...prev].filter(id => props.cart.some(i => i.id === id)))); }, [props.cart]);
  if (!props.isOpen) return null;

  const selected = props.cart.filter(i => !off.has(i.id));
  const total = selected.reduce((a, i) => a + priceOf(i) * i.quantity, 0);
  const pieces = selected.reduce((a, i) => a + i.quantity, 0);
  const hasOnOrder = selected.some(i => i.on_order);
  const allOn = off.size === 0;
  const toggle = (id: number) => setOff(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const back = () => (step === 'checkout' ? setStep('cart') : props.onClose());

  return (
    <div className="fixed inset-0 z-[175] animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={props.onClose}></div>
      <div className="absolute top-0 right-0 h-full w-full max-w-lg bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* top: back arrow, title, close */}
        <div className="px-3 py-3 border-b border-zinc-800 flex items-center gap-2 bg-zinc-900">
          <button onClick={back} aria-label="Назад" className="w-11 h-11 rounded-xl flex items-center justify-center text-white hover:bg-zinc-800 active:scale-95"><ArrowLeft size={24} /></button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-white leading-tight">{props.orderSuccess ? 'Замовлення прийнято' : step === 'cart' ? 'Кошик' : 'Оформлення замовлення'}</h2>
            {!props.orderSuccess && props.cart.length > 0 && <p className="text-[11px] text-zinc-500 font-bold">{step === 'cart' ? `${props.cart.length} ${props.cart.length === 1 ? 'товар' : props.cart.length < 5 ? 'товари' : 'товарів'}` : `${pieces} шт на ${money(total)} грн`}</p>}
          </div>
          <button onClick={props.onClose} aria-label="Закрити" className="w-11 h-11 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800"><X size={22} /></button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {props.orderSuccess ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in zoom-in duration-500">
              <div className="w-24 h-24 bg-emerald-500/20 text-emerald-500 rounded-3xl flex items-center justify-center mb-8 rotate-12 shadow-2xl shadow-emerald-900/20"><CheckCircle size={56} strokeWidth={2.5}/></div>
              <h3 className="text-3xl font-black text-white mb-3 tracking-tight uppercase">Дякуємо!</h3>
              <p className="text-zinc-300 mb-5 text-sm leading-relaxed">Замовлення прийнято. Що буде далі:</p>
              {props.paymentMethod === 'full' && props.deliveryMethod !== 'pickup' && (
                <div className="w-full max-w-xs mb-5 text-left text-sm bg-blue-500/10 border border-blue-500/30 text-blue-200 rounded-2xl p-3">
                  <b className="text-white">Повна оплата.</b> Менеджер зв'яжеться з вами, уточнить деталі та надішле реквізити для оплати. Нічого платити зараз не потрібно.
                </div>
              )}
              <ol className="text-left text-sm text-zinc-400 space-y-2 mb-8 w-full max-w-xs">
                <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-[#FFC300] text-black text-[11px] font-black flex items-center justify-center shrink-0">1</span> Менеджер зателефонує вам, щоб підтвердити наявність і ціну.</li>
                <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-[#FFC300] text-black text-[11px] font-black flex items-center justify-center shrink-0">2</span> Відправимо Новою Поштою або підготуємо до самовивозу.</li>
                <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-[#FFC300] text-black text-[11px] font-black flex items-center justify-center shrink-0">3</span> Номер ТТН з'явиться у «Моєму кабінеті» (якщо ви зареєстровані).</li>
              </ol>
              <button onClick={() => { props.setOrderSuccess(false); props.onClose(); }} className="w-full bg-white text-black font-black py-5 rounded-2xl hover:bg-[#FFC300] transition-all shadow-xl active:scale-95 uppercase tracking-widest text-sm">ПРОДОВЖИТИ ПОКУПКИ</button>
            </div>
          ) : props.cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-700 py-20">
              <div className="p-10 bg-zinc-800/20 rounded-full mb-6"><ShoppingBag size={80} strokeWidth={1} className="opacity-20"/></div>
              <p className="font-black uppercase tracking-widest text-xs">Ваш кошик порожній</p>
              <button onClick={props.onClose} className="mt-6 text-[#FFC300] font-bold text-sm hover:underline">Перейти до покупок</button>
            </div>
          ) : step === 'cart' ? (
            <>
              <label className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 cursor-pointer select-none">
                <input type="checkbox" checked={allOn} onChange={() => setOff(allOn ? new Set(props.cart.map(i => i.id)) : new Set())} className="w-6 h-6 accent-[#FFC300]" />
                <span className="text-sm font-bold text-zinc-300">Вибрати все</span>
              </label>
              <ul className="divide-y-8 divide-zinc-900">
                {props.cart.map(item => {
                  const on = !off.has(item.id);
                  const p = priceOf(item);
                  return (
                    <li key={item.id} className={`p-4 bg-zinc-950 ${on ? '' : 'opacity-60'}`}>
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center gap-4 pt-1">
                          <button onClick={() => props.removeFromCart(item.id)} aria-label="Видалити з кошика" className="text-zinc-500 hover:text-red-500"><Trash2 size={22} /></button>
                          <input type="checkbox" checked={on} onChange={() => toggle(item.id)} aria-label="Замовити цей товар" className="w-6 h-6 accent-[#FFC300] cursor-pointer" />
                        </div>
                        <div className="w-20 h-20 bg-white rounded-xl overflow-hidden flex-shrink-0">
                          <img src={item.image_thumb_url || item.image_url || '/favicon.svg'} alt={item.title} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-zinc-500 truncate">
                            {item.manufacturer && <span className="text-zinc-300">{item.manufacturer}</span>}
                            {item.catalog_number && <span>{item.manufacturer ? ' · ' : ''}Арт: {item.catalog_number}</span>}
                          </p>
                          <h4 className="text-white font-bold text-sm leading-snug mt-0.5 line-clamp-3">{item.title}</h4>
                          <div className="mt-2"><Stock item={item} /></div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pl-9">
                        <div className="flex items-stretch h-11 rounded-xl border-2 border-zinc-700 overflow-hidden">
                          <button onClick={() => props.updateQuantity(item.id, -1)} disabled={item.quantity <= 1} aria-label="Менше" className="w-11 flex items-center justify-center text-white hover:bg-zinc-800 disabled:text-zinc-700"><Minus size={20}/></button>
                          <input value={item.quantity} inputMode="numeric" aria-label="Кількість"
                            onChange={e => { const n = Math.max(1, Math.min(999, parseInt(e.target.value.replace(/\D/g, '') || '1', 10))); if (n !== item.quantity) props.updateQuantity(item.id, n - item.quantity); }}
                            className="w-12 text-center bg-black text-white font-black border-x-2 border-zinc-700 outline-none" />
                          <button onClick={() => props.updateQuantity(item.id, 1)} aria-label="Більше" className="w-11 flex items-center justify-center text-white hover:bg-zinc-800"><Plus size={20}/></button>
                        </div>
                        <div className="text-right">
                          {p > 0 ? <>
                            <p className="text-xl font-black text-white">{money(p * item.quantity)} <span className="text-xs font-bold text-zinc-400">грн</span></p>
                            {item.quantity > 1 && <p className="text-[11px] text-zinc-500">{money(p)} грн / шт</p>}
                          </> : <p className="text-sm font-bold text-orange-400">Ціну уточнимо</p>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="p-4 space-y-4">
              <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#FFC300] text-black rounded-full flex items-center justify-center font-black text-xs">1</div>
                  <h3 className="font-black text-white uppercase text-xs tracking-widest">Контактні дані</h3>
                </div>
                <input value={props.orderName} onChange={e => props.setOrderName(e.target.value)} placeholder="Прізвище Ім'я По батькові" autoComplete="name" className="w-full bg-black/50 border border-zinc-700 rounded-2xl p-4 text-white focus:border-[#FFC300] outline-none transition-all placeholder:text-zinc-600 font-bold text-sm" />
                <input type="tel" inputMode="tel" autoComplete="tel" value={props.orderPhone} onChange={e => props.setOrderPhone(formatUaPhone(e.target.value))} placeholder="+380 __ ___ __ __" className="w-full bg-black/50 border border-zinc-700 rounded-2xl p-4 text-white focus:border-[#FFC300] outline-none transition-all placeholder:text-zinc-600 font-bold text-sm" />
              </div>
              <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#FFC300] text-black rounded-full flex items-center justify-center font-black text-xs">2</div>
                  <h3 className="font-black text-white uppercase text-xs tracking-widest">Доставка та оплата</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-black rounded-2xl border border-zinc-800">
                  <button onClick={() => props.setDeliveryMethod('pickup')} className={`py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${props.deliveryMethod === 'pickup' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-400'}`}>Самовивіз</button>
                  <button onClick={() => props.setDeliveryMethod('newpost')} className={`py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${props.deliveryMethod === 'newpost' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-400'}`}>Нова Пошта</button>
                </div>
                {props.deliveryMethod === 'pickup' && <p className="text-xs text-zinc-400 flex items-start gap-2"><MapPin size={14} className="text-[#FFC300] shrink-0 mt-0.5" /> м. Синельникове, вул. Квітнева, 9. Менеджер зателефонує, коли замовлення буде готове.</p>}
                {props.deliveryMethod === 'newpost' && (
                  <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                    <div className="relative group">
                      <input value={props.npSearchCity} onChange={props.handleCityInputChange} placeholder="Введіть місто..." className="w-full bg-black/50 border border-zinc-700 rounded-2xl p-4 text-white text-sm focus:border-blue-500 outline-none transition-all placeholder:text-zinc-600" />
                      {props.isNpLoadingCities && <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-blue-500"/>}
                      {props.showCityDropdown && props.npCities.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-zinc-800 border border-zinc-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto backdrop-blur-xl">
                          {props.npCities.map((city, i) => (
                            <button key={i} onClick={() => props.handleCitySelect(city)} className="w-full text-left p-4 hover:bg-zinc-700 text-white text-sm border-b border-zinc-700 last:border-0 transition-colors">{city.Present}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <select disabled={!props.selectedCityRef} value={props.selectedWarehouseName} onChange={e => props.setSelectedWarehouseName(e.target.value)} className="w-full bg-black/50 border border-zinc-700 rounded-2xl p-4 text-white text-sm focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50">
                      <option value="">{props.isNpLoadingWarehouses ? 'Завантаження відділень...' : 'Оберіть відділення'}</option>
                      {props.npWarehouses.map((w, i) => <option key={i} value={w.Description}>{w.Description}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2 p-1.5 bg-black rounded-2xl border border-zinc-800 mt-2">
                      <button onClick={() => props.setPaymentMethod('prepayment')} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter ${props.paymentMethod === 'prepayment' ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>Предоплата</button>
                      <button onClick={() => props.setPaymentMethod('full')} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter ${props.paymentMethod === 'full' ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>Повна оплата</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Ваше замовлення</p>
                <ul className="space-y-1.5 text-sm">
                  {selected.map(i => (
                    <li key={i.id} className="flex justify-between gap-3"><span className="text-zinc-300 truncate">{i.title}</span><span className="text-zinc-400 shrink-0">{i.quantity} шт</span></li>
                  ))}
                </ul>
                <button onClick={() => setStep('cart')} className="mt-3 text-xs font-bold text-[#FFC300] hover:underline">Змінити</button>
              </div>
            </div>
          )}
        </div>

        {/* bottom: the sum and the main button, always visible */}
        {!props.orderSuccess && props.cart.length > 0 && (
          <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-zinc-800 bg-zinc-900">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-zinc-300 font-bold">До сплати</span>
              <span className="text-2xl font-black text-white">{money(total)} <span className="text-sm text-zinc-400 font-bold">грн</span></span>
            </div>
            {hasOnOrder && <p className="-mt-2 mb-2 text-[11px] text-orange-400 text-right">+ товари під замовлення: ціну назве менеджер</p>}
            {props.orderError && step === 'checkout' && <div className="mb-3 text-red-400 text-center text-xs font-bold bg-red-900/20 p-3 rounded-xl border border-red-900/50">{props.orderError}</div>}
            {step === 'cart' ? (
              <button onClick={() => setStep('checkout')} disabled={selected.length === 0}
                className="w-full bg-[#FFC300] hover:bg-white text-black font-black py-4 rounded-2xl text-lg transition-all active:scale-[0.98] disabled:opacity-40">
                {selected.length ? 'Оформити замовлення' : 'Оберіть товари'}
              </button>
            ) : (
              <>
                <button onClick={() => props.submitOrder(selected)} disabled={props.orderSending}
                  className="w-full bg-[#FFC300] hover:bg-white text-black font-black py-4 rounded-2xl text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50">
                  {props.orderSending ? <Loader2 className="animate-spin" size={24}/> : <><Truck size={24} strokeWidth={2.5}/> Підтвердити замовлення</>}
                </button>
                <p className="mt-2 text-[11px] text-zinc-500 text-center leading-snug">
                  Оформлюючи замовлення, ви погоджуєтесь з <a href="/oferta" target="_blank" className="underline hover:text-zinc-300">публічною офертою</a> та{' '}
                  <a href="/privacy" target="_blank" className="underline hover:text-zinc-300">політикою конфіденційності</a>.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
