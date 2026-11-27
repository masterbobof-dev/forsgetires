
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { TyreOrder } from '../../types';
import { Phone, Edit2, Truck, Save, Trash2, X, AlertTriangle, Calendar, Package, Printer, FileSpreadsheet } from 'lucide-react';
import { downloadCsv } from './exportCsv';

const OrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<TyreOrder[]>([]);
  const [searchPhone, setSearchPhone] = useState('');
  const [editingOrder, setEditingOrder] = useState<TyreOrder | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => { 
      const { data } = await supabase.from('tyre_orders').select('*').order('created_at', { ascending: false }); 
      if(data) setOrders(data); 
  };

  const filteredOrders = orders.filter(order => 
    order.customer_phone.includes(searchPhone) || 
    order.customer_name.toLowerCase().includes(searchPhone.toLowerCase())
  );

  const money = (v: unknown) => parseFloat(String(v ?? '').replace(/[^\d.]/g, '')) || 0;
  const orderSum = (o: any) => (o.items || []).reduce((s: number, i: any) => s + money(i.price) * (i.quantity || 1), 0);
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

  /** printable order form: who, where, what, how much */
  const printOrder = (o: any) => {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { alert('Дозвольте спливаючі вікна для друку'); return; }
    const rows = (o.items || []).map((i: any, n: number) => `<tr><td>${n + 1}</td><td>${esc(i.title)}</td><td class="r">${i.quantity || 1}</td><td class="r">${money(i.price).toFixed(2)}</td><td class="r">${(money(i.price) * (i.quantity || 1)).toFixed(2)}</td></tr>`).join('');
    w.document.write(`<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>Замовлення №${o.id}</title><style>
      body{font-family:Arial,sans-serif;color:#000;margin:24px;font-size:14px}h1{font-size:20px;margin:0 0 4px}
      table{width:100%;border-collapse:collapse;margin-top:14px}td,th{border:1px solid #000;padding:6px 8px;text-align:left}th{background:#eee}.r{text-align:right}
      .info td{border:0;padding:3px 0}.sum{font-size:18px;font-weight:bold;text-align:right;margin-top:10px}.sign{margin-top:40px;display:flex;justify-content:space-between}
    </style></head><body>
      <h1>Замовлення №${o.id} від ${new Date(o.created_at).toLocaleString('uk-UA')}</h1>
      <div>Інтернет-магазин «Форсаж», м. Синельникове, вул. Квітнева, 9</div>
      <table class="info">
        <tr><td width="170"><b>Покупець:</b></td><td>${esc(o.customer_name)}</td></tr>
        <tr><td><b>Телефон:</b></td><td>${esc(o.customer_phone)}</td></tr>
        <tr><td><b>Доставка:</b></td><td>${o.delivery_method === 'pickup' ? 'Самовивіз' : `Нова Пошта: ${esc(o.delivery_city)}, ${esc(o.delivery_warehouse)}`}</td></tr>
        <tr><td><b>Оплата:</b></td><td>${o.payment_method === 'online' ? (o.paid ? 'оплачено онлайн' : 'онлайн, очікує оплати') : o.delivery_method === 'pickup' ? 'при отриманні' : o.payment_method === 'full' ? 'повна оплата' : 'передоплата'}</td></tr>
        ${o.tracking_number ? `<tr><td><b>ТТН:</b></td><td>${esc(o.tracking_number)}</td></tr>` : ''}
        ${o.comment ? `<tr><td><b>Коментар:</b></td><td>${esc(o.comment)}</td></tr>` : ''}
      </table>
      <table><tr><th>№</th><th>Товар</th><th class="r">К-сть</th><th class="r">Ціна, грн</th><th class="r">Сума, грн</th></tr>${rows}</table>
      <div class="sum">Разом: ${orderSum(o).toFixed(2)} грн</div>
      <div class="sign"><span>Видав: ______________</span><span>Отримав: ______________</span></div>
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
    w.document.close();
  };

  /** the orders that are on the screen now (with the search applied) → Excel */
  const exportOrders = () => downloadCsv(`zamovlennya-${new Date().toISOString().slice(0, 10)}.csv`,
    ['№', 'Дата', 'Статус', 'Покупець', 'Телефон', 'Доставка', 'Місто', 'Відділення', 'Оплата', 'ТТН', 'Товари', 'Сума, грн'],
    filteredOrders.map((o: any) => [o.id, new Date(o.created_at).toLocaleString('uk-UA'), o.status, o.customer_name, o.customer_phone,
      o.delivery_method === 'pickup' ? 'Самовивіз' : 'Нова Пошта', o.delivery_city, o.delivery_warehouse, o.payment_method, o.tracking_number,
      (o.items || []).map((i: any) => `${i.title} × ${i.quantity || 1}`).join(' | '), orderSum(o).toFixed(2)]));

  const handleSave = async () => {
    if (!editingOrder) return;
    await supabase.from('tyre_orders').update({ 
        customer_name: editingOrder.customer_name, 
        customer_phone: editingOrder.customer_phone, 
        status: editingOrder.status, 
        delivery_city: editingOrder.delivery_city, 
        delivery_warehouse: editingOrder.delivery_warehouse,
        tracking_number: (editingOrder as any).tracking_number?.trim() || null
    }).eq('id', editingOrder.id);
    setShowModal(false); 
    fetchOrders();
  };

  const executeDelete = async () => {
      if (!orderToDelete) return;
      const { error } = await supabase.from('tyre_orders').delete().eq('id', orderToDelete);
      
      if (error) {
          alert("Помилка видалення: " + error.message);
      } else {
          // Optimistic update
          setOrders(prev => prev.filter(o => o.id !== orderToDelete));
          
          // If we deleted the one being edited, close the edit modal
          if (editingOrder && editingOrder.id === orderToDelete) {
              setShowModal(false);
              setEditingOrder(null);
          }
      }
      setOrderToDelete(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
       {/* Search Bar */}
       <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl shadow-xl flex flex-col md:flex-row gap-3 items-center">
           <div className="relative flex-grow w-full">
               <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/>
               <input 
                   type="text" 
                   placeholder="Телефон або ім'я..." 
                   value={searchPhone}
                   onChange={(e) => setSearchPhone(e.target.value)}
                   className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 pl-11 pr-4 text-sm text-white focus:border-[#FFC300] outline-none transition-all"
               />
               {searchPhone && (
                   <button onClick={() => setSearchPhone('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                       <X size={16}/>
                   </button>
               )}
           </div>
           <button onClick={exportOrders} disabled={!filteredOrders.length} title="Замовлення зі списку — в Excel"
               className="shrink-0 h-11 px-4 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm font-bold flex items-center gap-2 hover:bg-zinc-700 disabled:opacity-40">
               <FileSpreadsheet size={16}/> <span className="hidden md:inline">В Excel</span>
           </button>
           {searchPhone && (
               <div className="bg-[#FFC300]/10 border border-[#FFC300]/30 px-3 py-1.5 rounded-lg flex items-center gap-2 w-full md:w-auto">
                   <AlertTriangle size={14} className="text-[#FFC300]"/>
                   <span className="text-[#FFC300] text-[10px] font-black uppercase tracking-wider">Історія активована</span>
               </div>
           )}
       </div>

       {filteredOrders.length === 0 && (
           <div className="flex flex-col items-center justify-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
               <Package size={40} className="mb-3 opacity-30"/>
               <p className="text-sm">{searchPhone ? 'Нічого не знайдено' : 'Немає замовлень'}</p>
           </div>
       )}
       
       {filteredOrders.map((order) => (
          <div key={order.id} className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-2xl flex flex-col gap-3 relative group hover:border-zinc-700 transition-all shadow-lg overflow-hidden">
             
             <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                <div className="flex-grow min-w-0">
                    <h3 className="font-black text-white text-base truncate flex items-center gap-2">
                        {order.customer_name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                        <div className="text-[#FFC300] font-bold flex items-center gap-1.5 text-xs">
                            <Phone size={12}/> <a href={`tel:${order.customer_phone}`} className="hover:underline">{order.customer_phone}</a>
                        </div>
                        <div className="text-zinc-500 text-[10px] font-medium flex items-center gap-1">
                            <Calendar size={10}/> {new Date(order.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border tracking-widest ${
                        order.status === 'new' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                        order.status === 'confirmed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        order.status === 'shipped' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        order.status === 'completed' ? 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50' : 
                        'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                        {order.status === 'new' ? 'Нове' : order.status === 'confirmed' ? 'Підтверджено' : order.status === 'shipped' ? 'Відправлено' : order.status === 'completed' ? 'Виконано' : 'Скасовано'}
                    </span>

                    <div className="flex gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); printOrder(order); }} title="Друк бланка замовлення"
                            className="p-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-all active:scale-95">
                            <Printer size={14}/>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setEditingOrder(order); setShowModal(true); }} 
                            className="p-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-all active:scale-95"
                        >
                            <Edit2 size={14}/>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setOrderToDelete(order.id); }} 
                            className="p-2 bg-red-500/5 rounded-xl hover:bg-red-500 hover:text-white border border-red-500/10 text-red-500/70 transition-all active:scale-95"
                        >
                            <Trash2 size={14}/>
                        </button>
                    </div>
                </div>
             </div>

             {/* Order Items */}
             {order.items && (
                 <div className="bg-black/40 rounded-xl p-3 space-y-2 border border-zinc-800/50">
                     {order.items.map((item: any, idx: number) => (
                         <div key={idx} className="flex justify-between items-start text-xs border-b border-zinc-800/30 last:border-0 pb-2 last:pb-0 gap-3">
                             <div className="flex items-start gap-2 min-w-0">
                                 <div className="w-1 h-4 bg-zinc-700 rounded-full mt-0.5 flex-shrink-0"></div>
                                 <span className="text-zinc-300 font-medium leading-tight">{item.title}</span>
                             </div>
                             <div className="flex flex-col items-end flex-shrink-0">
                                 <span className="font-black text-white">{item.quantity} шт</span>
                                 <span className="text-[#FFC300] font-mono text-[10px]">{item.price} ₴</span>
                             </div>
                         </div>
                     ))}
                     <div className="pt-2 mt-1 border-t border-zinc-800/50 flex justify-between items-center">
                         <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Разом:</span>
                         <span className="text-[#FFC300] font-black text-base">
                             {order.items.reduce((acc: number, i: any) => acc + (parseFloat(String(i.price).replace(/[^\d.]/g,'')) || 0) * (i.quantity || 1), 0)} ₴
                         </span>
                     </div>
                 </div>
             )}

             {/* Delivery Info */}
             {order.delivery_method === 'newpost' ? (
                 <div className="text-[10px] text-zinc-400 flex flex-col md:flex-row items-start md:items-center gap-2 mt-1 bg-blue-500/5 p-2.5 rounded-xl border border-blue-500/10">
                     <div className="flex items-center gap-2">
                        <Truck size={14} className="text-blue-400 flex-shrink-0"/> 
                        <span className="font-bold text-blue-200 line-clamp-1">{order.delivery_city}, {order.delivery_warehouse}</span>
                     </div>
                     {order.payment_method && (
                         <span className="md:ml-auto text-blue-400 font-black bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-[9px] uppercase tracking-wider">
                             {(order.payment_method as string) === 'online' ? ((order as any).paid ? '✅ Оплачено онлайн' : 'Онлайн: очікує оплати') : order.payment_method === 'full' ? 'Повна оплата' : 'Предоплата'}
                         </span>
                     )}
                 </div>
             ) : (
                 <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-1 pl-1">
                     <Truck size={12} className="opacity-50"/> Самовивіз
                 </div>
             )}
          </div>
       ))}

       {/* Edit Modal */}
       {showModal && editingOrder && (
           <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
                   <div className="flex justify-between mb-6">
                       <h3 className="text-xl font-bold text-white">Редагування замовлення</h3>
                       <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white"><X/></button>
                   </div>
                   
                   <div className="space-y-4">
                       <div>
                           <label className="block text-xs text-zinc-500 font-bold mb-1 uppercase">Ім'я клієнта</label>
                           <input value={editingOrder.customer_name} onChange={e => setEditingOrder({...editingOrder, customer_name: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none" />
                       </div>
                       
                       <div>
                           <label className="block text-xs text-zinc-500 font-bold mb-1 uppercase">Телефон</label>
                           <input value={editingOrder.customer_phone} onChange={e => setEditingOrder({...editingOrder, customer_phone: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none" />
                       </div>

                       <div>
                           <label className="block text-xs text-zinc-500 font-bold mb-1 uppercase">Статус</label>
                           <select value={editingOrder.status} onChange={e => setEditingOrder({...editingOrder, status: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold cursor-pointer focus:border-[#FFC300] outline-none">
                               <option value="new">Нове</option>
                               <option value="confirmed">Підтверджено</option>
                               <option value="shipped">Відправлено</option>
                               <option value="completed">Виконано</option>
                               <option value="cancelled">Скасовано</option>
                           </select>
                       </div>

                       <div>
                           <label className="block text-xs text-zinc-500 font-bold mb-1 uppercase">Номер ТТН Нової Пошти</label>
                           <input value={(editingOrder as any).tracking_number || ''} onChange={e => setEditingOrder({...editingOrder, tracking_number: e.target.value} as any)} placeholder="20450000000000" inputMode="numeric" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none" />
                           <p className="text-[10px] text-zinc-500 mt-1">Покупець побачить кнопку «Відстежити посилку» у своєму кабінеті.</p>
                       </div>
                       {(editingOrder as any).customer_email && (
                           <p className="text-xs text-zinc-400">Email покупця: <span className="text-white">{(editingOrder as any).customer_email}</span> (зареєстрований клієнт)</p>
                       )}

                       {(editingOrder.delivery_city || editingOrder.delivery_warehouse) && (
                           <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                               <p className="text-xs text-zinc-500 font-bold uppercase mb-2">Дані доставки</p>
                               <input value={editingOrder.delivery_city || ''} onChange={e => setEditingOrder({...editingOrder, delivery_city: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm mb-2" placeholder="Місто" />
                               <input value={editingOrder.delivery_warehouse || ''} onChange={e => setEditingOrder({...editingOrder, delivery_warehouse: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm" placeholder="Відділення" />
                           </div>
                       )}

                       <div className="flex gap-4 pt-4 border-t border-zinc-800 mt-4">
                           <button onClick={() => setOrderToDelete(editingOrder.id)} className="px-4 py-3 bg-red-900/20 text-red-500 hover:bg-red-900/40 rounded-xl border border-red-900/50 transition-colors">
                               <Trash2 size={20}/>
                           </button>
                           <button onClick={handleSave} className="flex-grow bg-[#FFC300] text-black font-black py-3 rounded-xl hover:bg-[#e6b000] flex justify-center items-center gap-2 shadow-lg transition-transform active:scale-95">
                               <Save size={20}/> Зберегти
                           </button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       {/* Delete Confirmation Modal */}
       {orderToDelete && (
           <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative text-center">
                   <div className="w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-900/50 animate-pulse">
                       <Trash2 size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">Видалити замовлення?</h3>
                   <p className="text-zinc-400 mb-6 text-sm">Цю дію неможливо скасувати. Замовлення буде видалено назавжди.</p>
                   
                   <div className="flex gap-4">
                       <button onClick={() => setOrderToDelete(null)} className="flex-1 py-3 bg-zinc-800 text-white font-bold rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors">Скасувати</button>
                       <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 shadow-lg shadow-red-900/20 transition-colors">Видалити</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default OrdersTab;
