
import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, CheckCircle, RefreshCw, AlertTriangle, CalendarCheck, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { WORK_START_HOUR, WORK_END_HOUR, BOOKING_SERVICES, WHEEL_RADII } from '../constants';

interface BookingWizardProps {
  initialPhone: string;
  onClose: () => void;
}

const BookingWizard: React.FC<BookingWizardProps> = ({ initialPhone, onClose }) => {
  // HELPER: Get Current Date in Kyiv (YYYY-MM-DD)
  const getKyivDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kiev' });
  
  // HELPER: Get Current Minutes in Kyiv (0-1440)
  const getKyivCurrentMinutes = () => {
    const now = new Date();
    const kyivTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
    return kyivTime.getHours() * 60 + kyivTime.getMinutes();
  };

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    id: null as number | null, // Added for Edit Mode
    phone: initialPhone || '',
    serviceId: '',
    serviceDuration: 0,
    serviceLabel: '',
    radius: '',
    date: getKyivDate(), // Default to Kyiv Today
    time: '',
    name: ''
  });
  
  // NEW: Existing Bookings for Management
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [checkingPhone, setCheckingPhone] = useState(false);

  const [loading, setLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [nearestDate, setNearestDate] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Handle Phone Submit (Step 1 -> 2 or 1.5)
  const handlePhoneSubmit = async () => {
    setCheckingPhone(true);
    // Check if there are future bookings for this phone
    const today = getKyivDate();
    const { data } = await supabase
       .from('bookings')
       .select('*')
       .eq('customer_phone', formData.phone)
       .gte('booking_date', today)
       .order('booking_date', { ascending: true });
    
    setCheckingPhone(false);

    if (data && data.length > 0) {
       setExistingBookings(data);
       setStep(1.5); // Go to Manage Step
    } else {
       setStep(2); // Go to Service Step
    }
  };

  const handleEditBooking = (booking: any) => {
    // Populate form with existing data
    setFormData({
       id: booking.id,
       phone: booking.customer_phone,
       name: booking.customer_name,
       serviceId: booking.service_type || BOOKING_SERVICES[0].id,
       serviceLabel: booking.service_label || '',
       serviceDuration: booking.duration_minutes || 30,
       radius: booking.radius || WHEEL_RADII[2],
       date: booking.booking_date,
       time: booking.start_time
    });
    setStep(2); // Go to Service Step to allow full editing
  };

  const handleCancelBooking = async (id: number) => {
     await supabase.from('bookings').delete().eq('id', id);
     // Refresh list
     setExistingBookings(prev => prev.filter(b => b.id !== id));
     if (existingBookings.length <= 1) {
        setStep(2); // If no more bookings, just go to creating new
     }
  };

  useEffect(() => {
    if (step === 3) {
      fetchSlots(formData.date);
    }
  }, [step, formData.date]);

  const generateTimeSlots = (dateStr: string, durationMinutes: number, existingBookings: any[], checkCurrentTime = true) => {
    const slots = [];
    const start = WORK_START_HOUR * 60; // 480 mins
    const end = WORK_END_HOUR * 60; // 1140 mins
    
    // CHANGED: Step is now 10 minutes instead of 30
    const step = 10; 

    const kyivDate = getKyivDate();
    const isToday = dateStr === kyivDate;
    const currentMinutes = getKyivCurrentMinutes();

    for (let time = start; time + durationMinutes <= end; time += step) {
       // If it's today, don't show slots in the past
       if (checkCurrentTime && isToday && time < currentMinutes) continue;

       const timeEnd = time + durationMinutes;
       let isBusy = false;
       for (const booking of existingBookings) {
         // Exclude current booking if we are editing it
         if (formData.id && booking.id === formData.id) continue;

         const [bH, bM] = booking.start_time.split(':').map(Number);
         const bStart = bH * 60 + bM;
         const bEnd = bStart + booking.duration_minutes;
         
         // Check overlap
         if (time < bEnd && timeEnd > bStart) {
           isBusy = true;
           break;
         }
       }
       if (!isBusy) {
         const h = Math.floor(time / 60).toString().padStart(2, '0');
         const m = (time % 60).toString().padStart(2, '0');
         slots.push(`${h}:${m}`);
       }
    }
    return slots;
  };

  const fetchSlots = async (targetDate: string) => {
    setLoading(true);
    setNearestDate(null);
    setAvailableSlots([]);

    // 1. Fetch slots for selected date
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_date', targetDate);

    const slots = generateTimeSlots(targetDate, formData.serviceDuration, bookings || []);
    
    if (slots.length > 0) {
      setAvailableSlots(slots);
      setLoading(false);
    } else {
      // 2. If no slots, search next 3 days
      await findNearestAvailableDate(targetDate);
      setLoading(false);
    }
  };

  const findNearestAvailableDate = async (baseDate: string) => {
     let nextDate = new Date(baseDate);
     
     // Check next 4 days
     const datesToCheck = [];
     for(let i=1; i<=4; i++) {
        nextDate.setDate(nextDate.getDate() + 1);
        datesToCheck.push(nextDate.toLocaleDateString('en-CA'));
     }

     const { data: futureBookings } = await supabase
        .from('bookings')
        .select('*')
        .in('booking_date', datesToCheck);
    
     for (const date of datesToCheck) {
        const dayBookings = futureBookings?.filter(b => b.booking_date === date) || [];
        const slots = generateTimeSlots(date, formData.serviceDuration, dayBookings, true);
        
        if (slots.length > 0) {
           setNearestDate(date);
           return;
        }
     }
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    const payload = {
        customer_name: formData.name,
        customer_phone: formData.phone,
        service_type: formData.serviceId,
        service_label: formData.serviceLabel,
        radius: formData.radius,
        booking_date: formData.date,
        start_time: formData.time,
        duration_minutes: formData.serviceDuration,
        status: 'confirmed',
        is_edited: !!formData.id // Mark as edited if ID exists
    };

    let error;

    if (formData.id) {
       // Update existing
       const { error: updateError } = await supabase.from('bookings').update(payload).eq('id', formData.id);
       error = updateError;
    } else {
       // Insert new
       const { error: insertError } = await supabase.from('bookings').insert([payload]);
       error = insertError;
    }

    if (error) {
      console.error(error);
      setError('Не вдалося зберегти запис. Спробуйте ще раз.');
      setLoading(false);
    } else {
      setStep(5); // Success
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
       <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
         
         <div className="h-1 w-full bg-zinc-800">
            <div className="h-full bg-[#FFC300] transition-all duration-300" style={{ width: `${(step / 5) * 100}%` }}></div>
         </div>

         <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex justify-between items-center">
           <div className="flex items-center gap-2">
              {step > 1 && step < 5 && <button onClick={() => step === 1.5 ? setStep(1) : prevStep()}><ArrowLeft className="text-zinc-400 hover:text-white" /></button>}
              <h3 className="text-xl font-bold text-white uppercase italic">{formData.id ? 'Зміна запису' : 'Онлайн Запис'}</h3>
           </div>
           <button onClick={onClose}><X className="text-zinc-400 hover:text-white" /></button>
         </div>

         <div className="p-6">
           {/* STEP 1: Phone */}
           {step === 1 && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h4 className="text-[#FFC300] font-bold text-lg mb-2">1. Ваш номер телефону</h4>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-white text-xl font-bold focus:border-[#FFC300] outline-none" placeholder="0XX XXX XX XX" />
                <button onClick={handlePhoneSubmit} disabled={!formData.phone || formData.phone.length < 9} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-lg py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                   {checkingPhone ? <RefreshCw className="animate-spin mx-auto"/> : 'ДАЛІ'}
                </button>
             </div>
           )}

           {/* STEP 1.5: Manage Bookings */}
           {step === 1.5 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                 <h4 className="text-[#FFC300] font-bold text-lg">Ваші активні записи</h4>
                 <div className="space-y-3 max-h-64 overflow-y-auto">
                    {existingBookings.map(b => (
                       <div key={b.id} className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 flex justify-between items-center">
                          <div>
                             <div className="text-white font-bold">{b.service_label}</div>
                             <div className="text-[#FFC300] font-mono font-bold text-sm">{b.booking_date} | {b.start_time}</div>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => handleEditBooking(b)} className="p-2 bg-blue-900/50 text-blue-400 rounded-lg hover:bg-blue-900"><Edit2 size={16}/></button>
                             <button onClick={() => handleCancelBooking(b.id)} className="p-2 bg-red-900/50 text-red-400 rounded-lg hover:bg-red-900"><Trash2 size={16}/></button>
                          </div>
                       </div>
                    ))}
                 </div>
                 <div className="border-t border-zinc-800 pt-4">
                    <button onClick={() => { setFormData({...formData, id: null}); setStep(2); }} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl border border-zinc-600 flex justify-center items-center gap-2">
                       <CalendarCheck size={18}/> Створити НОВИЙ запис
                    </button>
                 </div>
              </div>
           )}

           {/* STEP 2: Service */}
           {step === 2 && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
               <h4 className="text-[#FFC300] font-bold text-lg">2. Оберіть послугу</h4>
               <div className="grid gap-2">
                 {BOOKING_SERVICES.map(srv => (
                   <button key={srv.id} onClick={() => setFormData({...formData, serviceId: srv.id, serviceDuration: srv.duration, serviceLabel: srv.label})} className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${formData.serviceId === srv.id ? 'border-[#FFC300] bg-[#FFC300]/10 text-white shadow-[0_0_15px_rgba(255,195,0,0.1)]' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500'}`}>
                     <span className="font-bold">{srv.label}</span>
                     <span className="text-xs bg-black/50 px-2 py-1 rounded text-zinc-400">{srv.duration} хв</span>
                   </button>
                 ))}
               </div>
               <h4 className="text-[#FFC300] font-bold text-lg mt-4">Радіус коліс</h4>
               <div className="grid grid-cols-4 gap-2">
                 {WHEEL_RADII.map(r => (
                   <button key={r} onClick={() => setFormData({...formData, radius: r})} className={`p-2 rounded-lg border text-sm font-bold transition-all ${formData.radius === r ? 'border-[#FFC300] bg-[#FFC300] text-black' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500'}`}>{r}</button>
                 ))}
               </div>
               <button onClick={nextStep} disabled={!formData.serviceId || !formData.radius} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-lg py-4 rounded-xl mt-6 disabled:opacity-50 transition-all">ДАЛІ</button>
             </div>
           )}

           {/* STEP 3: Date & Time */}
           {step === 3 && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
               <h4 className="text-[#FFC300] font-bold text-lg">3. Дата та Час</h4>
               <input type="date" min={getKyivDate()} value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value, time: ''})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white focus:border-[#FFC300] outline-none font-bold" />
               
               <div className="h-48 overflow-y-auto grid grid-cols-3 gap-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-700 content-start">
                 {loading ? (
                   <div className="col-span-3 text-center text-zinc-500 py-10 flex flex-col items-center">
                     <span className="animate-spin text-[#FFC300] mb-2"><RefreshCw /></span>Пошук часу...
                   </div>
                 ) : availableSlots.length > 0 ? (
                   availableSlots.map(time => (
                     <button key={time} onClick={() => setFormData({...formData, time})} className={`p-2 rounded-lg border font-bold transition-all ${formData.time === time ? 'border-[#FFC300] bg-[#FFC300] text-black' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700'}`}>{time}</button>
                   ))
                 ) : (
                   <div className="col-span-3 flex flex-col items-center gap-4 py-4">
                      <p className="text-center text-red-400 bg-red-900/10 p-2 rounded-lg border border-red-900/30 w-full">Немає вільного часу на цей день</p>
                      {nearestDate && (
                        <button 
                          onClick={() => setFormData({...formData, date: nearestDate, time: ''})}
                          className="w-full bg-zinc-800 border border-[#FFC300] text-white p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#FFC300]/10 transition-colors animate-pulse"
                        >
                           <CalendarCheck className="text-[#FFC300]" size={20} />
                           <div className="text-left">
                              <span className="block text-[10px] text-zinc-400 uppercase font-bold">Найближча дата</span>
                              <span className="font-bold text-lg">{nearestDate}</span>
                           </div>
                        </button>
                      )}
                   </div>
                 )}
               </div>

               <button onClick={nextStep} disabled={!formData.time} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-lg py-4 rounded-xl mt-4 disabled:opacity-50 transition-all">ДАЛІ</button>
             </div>
           )}

           {/* STEP 4: Name & Confirm */}
           {step === 4 && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
               <h4 className="text-[#FFC300] font-bold text-lg">4. Ваше Ім'я</h4>
               <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-white text-xl font-bold focus:border-[#FFC300] outline-none" placeholder="Введіть ім'я" />
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700 space-y-2 text-sm text-zinc-300 mt-4">
                  <div className="flex justify-between border-b border-zinc-700 pb-2"><span className="text-zinc-500">Послуга:</span> <span className="text-white font-bold">{formData.serviceLabel}</span></div>
                  <div className="flex justify-between border-b border-zinc-700 pb-2"><span className="text-zinc-500">Радіус:</span> <span className="text-white font-bold">{formData.radius}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Час:</span> <span className="text-[#FFC300] font-bold">{formData.date} / {formData.time}</span></div>
                </div>
                {error && <p className="text-red-500 text-center bg-red-900/20 p-2 rounded">{error}</p>}
                <div className="bg-zinc-800/30 p-3 rounded-lg border border-zinc-700 mt-4">
                   <p className="text-zinc-400 text-xs md:text-sm text-center italic flex items-start gap-2 justify-center"><AlertTriangle size={16} className="text-[#FFC300] shrink-0 mt-0.5" />Будь ласка, якщо ви вирішите скасувати запис або змінити час, напишіть нам або зателефонуйте.</p>
                </div>
                <button onClick={handleSubmit} disabled={!formData.name || loading} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-lg py-4 rounded-xl mt-2 disabled:opacity-50 transition-all">{loading ? 'ЗАПИС...' : 'ПІДТВЕРДИТИ ЗАПИС'}</button>
             </div>
           )}

           {/* STEP 5: Success */}
           {step === 5 && (
             <div className="text-center py-8 animate-in zoom-in duration-300">
               <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]"><CheckCircle size={48} /></div>
               <h3 className="text-3xl font-black text-white mb-2 uppercase italic">УСПІШНО!</h3>
               <p className="text-zinc-400 mb-8 text-lg">
                 {formData.id ? 'Ваш запис оновлено.' : 'Ви записані. Чекаємо на вас!'}
               </p>
               <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl border border-zinc-600">ЗАКРИТИ</button>
             </div>
           )}
         </div>
       </div>
    </div>
  );
};

export default BookingWizard;
