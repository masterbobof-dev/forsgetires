
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { BOOKING_SERVICES, WHEEL_RADII, WORK_START_HOUR, WORK_END_HOUR } from '../../constants';
import { Clock, Plus, Phone, X, Save, Trash2 } from 'lucide-react';

const getKyivDateObj = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
const getKyivDateString = (date = getKyivDateObj()) => date.toLocaleDateString('en-CA');
const getKyivTimeString = () => { const d = getKyivDateObj(); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); };
const timeToMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const minsToTime = (m: number) => { const h = Math.floor(m / 60).toString().padStart(2, '0'); const min = (m % 60).toString().padStart(2, '0'); return `${h}:${min}`; };
const generateTimeOptions = () => { const o = []; for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) { for (let m = 0; m < 60; m += 10) { o.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`); } } return o; };

const ScheduleTab: React.FC = () => {
  const [displayDate1, setDisplayDate1] = useState('');
  const [displayDate2, setDisplayDate2] = useState('');
  const [bookingsCol1, setBookingsCol1] = useState<any[]>([]);
  const [bookingsCol2, setBookingsCol2] = useState<any[]>([]);
  const [draggedBookingId, setDraggedBookingId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({ id: null as number | null, name: '', phone: '', time: '08:00', date: '', serviceId: BOOKING_SERVICES[0].id, radius: WHEEL_RADII[2], duration: 30 });

  useEffect(() => {
    const calculateDates = () => {
       const now = getKyivDateObj();
       const d1 = new Date(now);
       const d2 = new Date(now);
       if (now.getHours() >= 20) { d1.setDate(now.getDate() + 1); d2.setDate(now.getDate() + 2); } 
       else { d2.setDate(now.getDate() + 1); }
       setDisplayDate1(getKyivDateString(d1)); setDisplayDate2(getKyivDateString(d2));
    };
    calculateDates();
  }, []);

  useEffect(() => { if (displayDate1 && displayDate2) fetchSchedule(); }, [displayDate1, displayDate2]);

  const fetchSchedule = async () => {
    const { data } = await supabase.from('bookings').select('*').in('booking_date', [displayDate1, displayDate2]).order('start_time', { ascending: true });
    if (data) {
      setBookingsCol1(data.filter((b: any) => b.booking_date === displayDate1));
      setBookingsCol2(data.filter((b: any) => b.booking_date === displayDate2));
    }
  };

  const handleDropOnGap = async (e: React.DragEvent, targetDate: string, newTime: string) => {
    e.preventDefault();
    if (!draggedBookingId) return;
    await supabase.from('bookings').update({ booking_date: targetDate, start_time: newTime, is_edited: true }).eq('id', draggedBookingId);
    fetchSchedule(); setDraggedBookingId(null);
  };

  const handleSaveBooking = async () => {
    if (!bookingForm.name || !bookingForm.phone) return;
    const srv = BOOKING_SERVICES.find(s => s.id === bookingForm.serviceId);
    const payload = { customer_name: bookingForm.name, customer_phone: bookingForm.phone, service_type: bookingForm.serviceId, service_label: srv ? srv.label : 'Custom', radius: bookingForm.radius, booking_date: bookingForm.date, start_time: bookingForm.time, duration_minutes: srv ? srv.duration : bookingForm.duration, status: 'staff', is_edited: !!bookingForm.id };
    if (bookingForm.id) await supabase.from('bookings').update(payload).eq('id', bookingForm.id); else await supabase.from('bookings').insert([payload]);
    setShowEditModal(false); fetchSchedule();
  };

  const handleDeleteBooking = async () => { if (bookingForm.id) { await supabase.from('bookings').delete().eq('id', bookingForm.id); setShowEditModal(false); fetchSchedule(); } };

  const getDayTimeline = (date: string, bookings: any[]) => {
    const sorted = [...bookings].sort((a, b) => timeToMins(a.start_time) - timeToMins(b.start_time));
    const items = [];
    let currentMins = WORK_START_HOUR * 60;
    sorted.forEach((b) => {
       const bStart = timeToMins(b.start_time);
       const bEnd = bStart + b.duration_minutes;
       if (bStart > currentMins) items.push(renderFreeBlock(currentMins, bStart, date));
       items.push(renderBookingBlock(b, date));
       currentMins = Math.max(currentMins, bEnd);
    });
    if (currentMins < WORK_END_HOUR * 60) items.push(renderFreeBlock(currentMins, WORK_END_HOUR * 60, date));
    return items;
  };

  const renderFreeBlock = (start: number, end: number, date: string) => (
     <div key={`free-${start}`} className="flex gap-2 mb-2 min-h-[50px] group">
         <div className="w-14 flex-shrink-0 flex flex-col items-center pt-2"><span className="text-zinc-500 font-mono text-sm">{minsToTime(start)}</span><div className="w-px h-full bg-zinc-800 my-1"></div></div>
         <div className="flex-grow border border-dashed border-zinc-700 rounded-xl flex items-center justify-between px-4 bg-zinc-900/30 hover:bg-[#FFC300]/5 hover:border-[#FFC300] cursor-pointer" onClick={() => { setBookingForm({ id: null, name: '', phone: '', time: minsToTime(start), date: date, serviceId: BOOKING_SERVICES[0].id, radius: WHEEL_RADII[2], duration: 30 }); setShowEditModal(true); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropOnGap(e, date, minsToTime(start))}>
             <div className="text-zinc-500 text-sm">Вільний час <span className="font-bold text-white">{minsToTime(start)} - {minsToTime(end)}</span></div>
             <button className="bg-zinc-800 text-zinc-400 p-2 rounded-full group-hover:bg-[#FFC300] group-hover:text-black"><Plus size={20} /></button>
         </div>
     </div>
  );

  const renderBookingBlock = (b: any, date: string) => (
     <div key={b.id} className="flex gap-2 mb-2">
        <div className="w-14 flex-shrink-0 pt-2 text-right"><span className={`font-mono text-sm font-bold ${b.status === 'staff' ? 'text-blue-400' : 'text-[#FFC300]'}`}>{b.start_time}</span></div>
        <div draggable onDragStart={() => setDraggedBookingId(b.id)} onClick={() => { setBookingForm({ id: b.id, name: b.customer_name, phone: b.customer_phone, time: b.start_time, date: b.booking_date, serviceId: b.service_type || BOOKING_SERVICES[0].id, radius: b.radius || WHEEL_RADII[2], duration: b.duration_minutes || 30 }); setShowEditModal(true); }} className={`flex-grow p-3 rounded-xl border-l-4 shadow-lg cursor-pointer hover:scale-[1.01] transition-transform ${b.status === 'staff' ? 'bg-zinc-800 border-blue-500' : 'bg-zinc-900 border-[#FFC300]'}`}>
           <div className="flex justify-between"><div><div className="font-bold text-white">{b.customer_name}</div><div className="text-sm text-zinc-400 font-mono"><Phone size={12} className="inline"/> {b.customer_phone}</div></div><div className="text-right"><div className="text-zinc-300 font-bold text-sm">{b.service_label}</div><div className="bg-black/40 px-2 rounded text-xs text-zinc-500 inline-block">{b.radius}</div></div></div>
        </div>
     </div>
  );

  return (
    <div className="animate-in fade-in">
       <div className="flex items-center gap-2 mb-4 bg-blue-900/20 p-3 rounded-lg border border-blue-900/50"><Clock className="text-blue-400" size={20} /><span className="text-blue-200 font-bold">Час: {getKyivTimeString()}</span></div>
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[80vh]"><div className="bg-black p-4 sticky top-0 z-20"><h3 className="text-xl font-black text-white">{displayDate1}</h3></div><div className="p-4 overflow-y-auto flex-grow bg-black/20">{getDayTimeline(displayDate1, bookingsCol1)}</div></div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[80vh]"><div className="bg-black p-4 sticky top-0 z-20"><h3 className="text-xl font-black text-zinc-300">{displayDate2}</h3></div><div className="p-4 overflow-y-auto flex-grow bg-black/20">{getDayTimeline(displayDate2, bookingsCol2)}</div></div>
       </div>
       {showEditModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
             <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-md">
                <div className="flex justify-between mb-4"><h3 className="text-xl font-black text-white">{bookingForm.id ? 'Редагування' : 'Новий запис'}</h3><button onClick={() => setShowEditModal(false)}><X/></button></div>
                <div className="space-y-4">
                   <input type="text" placeholder="Ім'я" value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white" />
                   <input type="tel" placeholder="Телефон" value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white" />
                   <div className="flex gap-2">
                      <select value={bookingForm.time} onChange={e => setBookingForm({...bookingForm, time: e.target.value})} className="bg-black border border-zinc-700 rounded-lg p-3 text-white">{generateTimeOptions().map(t => <option key={t} value={t}>{t}</option>)}</select>
                      <select value={bookingForm.serviceId} onChange={e => setBookingForm({...bookingForm, serviceId: e.target.value})} className="flex-grow bg-black border border-zinc-700 rounded-lg p-3 text-white">{BOOKING_SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                   </div>
                   <div className="flex gap-4 pt-4">
                      {bookingForm.id && <button onClick={handleDeleteBooking} className="px-4 py-3 bg-red-900/20 text-red-500 rounded-xl"><Trash2/></button>}
                      <button onClick={handleSaveBooking} className="flex-grow bg-[#FFC300] text-black font-black py-3 rounded-xl hover:bg-[#e6b000] flex justify-center items-center gap-2"><Save/> Зберегти</button>
                   </div>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};

export default ScheduleTab;
