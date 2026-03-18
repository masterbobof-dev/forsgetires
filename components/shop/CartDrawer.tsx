
import React from 'react';
import { X, ShoppingBag, Trash2, Minus, Plus, Truck, MapPin, Loader2, CheckCircle } from 'lucide-react';
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
  submitOrder: () => void;
  orderSending: boolean;
  orderSuccess: boolean;
  orderError: string;
  setOrderSuccess: (v: boolean) => void;
  formatPrice: (p: string | undefined) => string;
}

const CartDrawer: React.FC<CartDrawerProps> = (props) => {
  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={props.onClose}></div>
      <div className="absolute top-0 right-0 h-full w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-10">
           <div className="flex flex-col">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <ShoppingBag className="text-[#FFC300]" size={28}/> 
                Кошик
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                {props.cart.length} позицій у списку
              </p>
           </div>
           <button onClick={props.onClose} className="p-3 hover:bg-zinc-800 rounded-2xl text-zinc-500 hover:text-white transition-all active:scale-90 border border-transparent hover:border-zinc-700"><X size={24}/></button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 custom-scrollbar space-y-8">
           {props.orderSuccess ? (
               <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-emerald-500/20 text-emerald-500 rounded-3xl flex items-center justify-center mb-8 rotate-12 shadow-2xl shadow-emerald-900/20"><CheckCircle size={56} strokeWidth={2.5}/></div>
                  <h3 className="text-3xl font-black text-white mb-3 tracking-tight uppercase">Дякуємо!</h3>
                  <p className="text-zinc-400 mb-10 text-sm leading-relaxed">Ваше замовлення успішно оформлене. Наш менеджер зв'яжеться з вами протягом 15 хвилин для підтвердження.</p>
                  <button onClick={() => { props.setOrderSuccess(false); props.onClose(); }} className="w-full bg-white text-black font-black py-5 rounded-2xl hover:bg-[#FFC300] transition-all shadow-xl active:scale-95 uppercase tracking-widest text-sm">ПРОДОВЖИТИ ПОКУПКИ</button>
               </div>
           ) : props.cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-zinc-700 py-20">
                  <div className="p-10 bg-zinc-800/20 rounded-full mb-6">
                    <ShoppingBag size={80} strokeWidth={1} className="opacity-20"/>
                  </div>
                  <p className="font-black uppercase tracking-widest text-xs">Ваш кошик порожній</p>
                  <button onClick={props.onClose} className="mt-6 text-[#FFC300] font-bold text-sm hover:underline">Перейти до покупок</button>
               </div>
           ) : (
               <div className="space-y-8">
                  <div className="space-y-4">
                     {props.cart.map(item => (
                        <div key={item.id} className="group bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800/50 flex gap-4 hover:border-zinc-700 transition-all">
                           <div className="w-20 h-20 bg-black rounded-xl overflow-hidden flex-shrink-0 border border-zinc-800">
                              <img src={item.image_url || '/favicon.svg'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                           </div>
                           <div className="flex-grow min-w-0 flex flex-col justify-between">
                              <div>
                                <h4 className="text-white font-bold text-sm truncate group-hover:text-[#FFC300] transition-colors">{item.title}</h4>
                                <p className="text-[#FFC300] font-black text-base mt-1">{props.formatPrice(item.price)} <span className="text-[10px] font-normal text-zinc-500">грн</span></p>
                              </div>
                              <div className="flex items-center justify-between mt-3">
                                 <div className="flex items-center bg-black/50 rounded-xl p-1 border border-zinc-800">
                                    <button onClick={() => props.updateQuantity(item.id, -1)} className="p-1.5 text-zinc-500 hover:text-white transition-colors"><Minus size={14}/></button>
                                    <span className="px-4 text-white font-black text-sm">{item.quantity}</span>
                                    <button onClick={() => props.updateQuantity(item.id, 1)} className="p-1.5 text-zinc-500 hover:text-white transition-colors"><Plus size={14}/></button>
                                 </div>
                                 <button onClick={() => props.removeFromCart(item.id)} className="text-zinc-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={18}/></button>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>

                  <div className="bg-zinc-800/50 p-6 rounded-3xl border border-zinc-700/50 space-y-6 shadow-xl">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#FFC300] text-black rounded-full flex items-center justify-center font-black text-xs">1</div>
                        <h3 className="font-black text-white uppercase text-xs tracking-widest">Контактні дані</h3>
                     </div>
                     <div className="space-y-4">
                        <div className="relative group">
                          <input value={props.orderName} onChange={e => props.setOrderName(e.target.value)} placeholder="Ваше ім'я" className="w-full bg-black/50 border border-zinc-700 rounded-2xl p-4 text-white focus:border-[#FFC300] outline-none transition-all placeholder:text-zinc-600 font-bold text-sm" />
                        </div>
                        <div className="relative group">
                          <input value={props.orderPhone} onChange={e => props.setOrderPhone(e.target.value)} placeholder="Телефон (099...)" className="w-full bg-black/50 border border-zinc-700 rounded-2xl p-4 text-white focus:border-[#FFC300] outline-none transition-all placeholder:text-zinc-600 font-bold text-sm" />
                        </div>
                        
                        <div className="flex items-center gap-3 pt-4">
                          <div className="w-8 h-8 bg-[#FFC300] text-black rounded-full flex items-center justify-center font-black text-xs">2</div>
                          <h3 className="font-black text-white uppercase text-xs tracking-widest">Доставка та оплата</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-1.5 bg-black rounded-2xl border border-zinc-800">
                           <button onClick={() => props.setDeliveryMethod('pickup')} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${props.deliveryMethod === 'pickup' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}>Самовивіз</button>
                           <button onClick={() => props.setDeliveryMethod('newpost')} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${props.deliveryMethod === 'newpost' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}>Нова Пошта</button>
                        </div>

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
                                 <button onClick={() => props.setPaymentMethod('prepayment')} className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-tighter ${props.paymentMethod === 'prepayment' ? 'bg-blue-600 text-white' : 'text-zinc-600'}`}>Предоплата</button>
                                 <button onClick={() => props.setPaymentMethod('full')} className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-tighter ${props.paymentMethod === 'full' ? 'bg-blue-600 text-white' : 'text-zinc-600'}`}>Повна оплата</button>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
           )}
        </div>

        {!props.orderSuccess && props.cart.length > 0 && (
           <div className="p-8 border-t border-zinc-800 bg-black/60 backdrop-blur-xl sticky bottom-0">
              <div className="flex justify-between items-end mb-8">
                 <div className="flex flex-col">
                    <span className="text-zinc-500 font-black uppercase text-[10px] tracking-widest mb-1">Загальна сума:</span>
                    <span className="text-4xl font-black text-[#FFC300] tracking-tighter">{props.cartTotal} <span className="text-sm text-white font-normal">грн</span></span>
                 </div>
              </div>
              {props.orderError && <div className="mb-6 text-red-500 text-center text-xs font-black bg-red-900/20 p-4 rounded-2xl border border-red-900/50 animate-bounce uppercase tracking-widest">{props.orderError}</div>}
              <button 
                onClick={props.submitOrder} 
                disabled={props.orderSending} 
                className="w-full bg-[#FFC300] hover:bg-white text-black font-black py-6 rounded-2xl text-xl shadow-2xl shadow-yellow-900/20 transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50 uppercase tracking-widest"
              >
                 {props.orderSending ? <Loader2 className="animate-spin" size={28}/> : <><Truck size={28} strokeWidth={2.5}/> ОФОРМИТИ ЗАМОВЛЕННЯ</>}
              </button>
           </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
