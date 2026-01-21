
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
        
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-black/20">
           <h2 className="text-2xl font-black text-white flex items-center gap-3"><ShoppingBag className="text-[#FFC300]"/> Кошик</h2>
           <button onClick={props.onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white"><X size={24}/></button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
           {props.orderSuccess ? (
               <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in zoom-in">
                  <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6"><CheckCircle size={48}/></div>
                  <h3 className="text-2xl font-black text-white mb-2">Замовлення прийнято!</h3>
                  <p className="text-zinc-400 mb-8">Ми зателефонуємо вам найближчим часом для уточнення деталей.</p>
                  <button onClick={() => { props.setOrderSuccess(false); props.onClose(); }} className="w-full bg-[#FFC300] text-black font-black py-4 rounded-xl">ПРОДОВЖИТИ ПОКУПКИ</button>
               </div>
           ) : props.cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                  <ShoppingBag size={64} className="opacity-10 mb-4"/>
                  <p className="font-bold">Ваш кошик порожній</p>
               </div>
           ) : (
               <div className="space-y-6">
                  <div className="space-y-3">
                     {props.cart.map(item => (
                        <div key={item.id} className="bg-black/40 p-3 rounded-xl border border-zinc-800 flex gap-3">
                           <div className="w-16 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                              <img src={item.image_url || '/favicon.svg'} className="w-full h-full object-cover" />
                           </div>
                           <div className="flex-grow min-w-0">
                              <h4 className="text-white font-bold text-sm truncate">{item.title}</h4>
                              <p className="text-[#FFC300] font-black text-sm">{props.formatPrice(item.price)} грн</p>
                              <div className="flex items-center justify-between mt-2">
                                 <div className="flex items-center bg-zinc-800 rounded-lg p-1 border border-zinc-700">
                                    <button onClick={() => props.updateQuantity(item.id, -1)} className="p-1 text-zinc-400 hover:text-white"><Minus size={14}/></button>
                                    <span className="px-3 text-white font-bold text-sm">{item.quantity}</span>
                                    <button onClick={() => props.updateQuantity(item.id, 1)} className="p-1 text-zinc-400 hover:text-white"><Plus size={14}/></button>
                                 </div>
                                 <button onClick={() => props.removeFromCart(item.id)} className="text-zinc-600 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>

                  <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700 space-y-4">
                     <h3 className="font-black text-white uppercase text-sm tracking-widest border-b border-zinc-700 pb-2">Оформлення</h3>
                     <div className="space-y-3">
                        <input value={props.orderName} onChange={e => props.setOrderName(e.target.value)} placeholder="Ваше ім'я" className="w-full bg-black border border-zinc-600 rounded-xl p-3 text-white focus:border-[#FFC300] outline-none" />
                        <input value={props.orderPhone} onChange={e => props.setOrderPhone(e.target.value)} placeholder="Телефон (099...)" className="w-full bg-black border border-zinc-600 rounded-xl p-3 text-white focus:border-[#FFC300] outline-none" />
                        
                        <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-xl border border-zinc-800">
                           <button onClick={() => props.setDeliveryMethod('pickup')} className={`py-2 rounded-lg text-xs font-bold uppercase transition-all ${props.deliveryMethod === 'pickup' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500'}`}>Самовивіз</button>
                           <button onClick={() => props.setDeliveryMethod('newpost')} className={`py-2 rounded-lg text-xs font-bold uppercase transition-all ${props.deliveryMethod === 'newpost' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500'}`}>Нова Пошта</button>
                        </div>

                        {props.deliveryMethod === 'newpost' && (
                           <div className="space-y-2 animate-in slide-in-from-top-2">
                              <div className="relative">
                                 <input value={props.npSearchCity} onChange={props.handleCityInputChange} placeholder="Місто доставки" className="w-full bg-black border border-zinc-600 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none" />
                                 {props.isNpLoadingCities && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500"/>}
                                 {props.showCityDropdown && props.npCities.length > 0 && (
                                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                                       {props.npCities.map((city, i) => (
                                          <button key={i} onClick={() => props.handleCitySelect(city)} className="w-full text-left p-3 hover:bg-zinc-700 text-white text-sm border-b border-zinc-700 last:border-0">{city.Present}</button>
                                       ))}
                                    </div>
                                 )}
                              </div>
                              <select disabled={!props.selectedCityRef} value={props.selectedWarehouseName} onChange={e => props.setSelectedWarehouseName(e.target.value)} className="w-full bg-black border border-zinc-600 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none">
                                 <option value="">{props.isNpLoadingWarehouses ? 'Завантаження...' : 'Оберіть відділення'}</option>
                                 {props.npWarehouses.map((w, i) => <option key={i} value={w.Description}>{w.Description}</option>)}
                              </select>
                              <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-xl border border-zinc-800 mt-2">
                                 <button onClick={() => props.setPaymentMethod('prepayment')} className={`py-2 rounded-lg text-[10px] font-bold uppercase ${props.paymentMethod === 'prepayment' ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>Предоплата</button>
                                 <button onClick={() => props.setPaymentMethod('full')} className={`py-2 rounded-lg text-[10px] font-bold uppercase ${props.paymentMethod === 'full' ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>Повна оплата</button>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
           )}
        </div>

        {!props.orderSuccess && props.cart.length > 0 && (
           <div className="p-6 border-t border-zinc-800 bg-black/40">
              <div className="flex justify-between items-end mb-6">
                 <span className="text-zinc-400 font-bold uppercase text-xs">Разом до оплати:</span>
                 <span className="text-3xl font-black text-[#FFC300]">{props.cartTotal} грн</span>
              </div>
              {props.orderError && <div className="mb-4 text-red-500 text-center text-sm font-bold bg-red-900/20 p-2 rounded-lg border border-red-900/50">{props.orderError}</div>}
              <button 
                onClick={props.submitOrder} 
                disabled={props.orderSending} 
                className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-5 rounded-2xl text-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                 {props.orderSending ? <Loader2 className="animate-spin" size={24}/> : <><Truck size={24}/> ОФОРМИТИ</>}
              </button>
           </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
