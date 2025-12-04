
import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, CheckCircle, RefreshCw } from 'lucide-react';
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
    // Create a date object shifted to Kyiv time
    const kyivTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
    return kyivTime.getHours() * 60 + kyivTime.getMinutes();
  };

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    phone: initialPhone || '',
    serviceId: '',
    serviceDuration: 0,
    serviceLabel: '',
    radius: '',
    date: getKyivDate(), // Default to Kyiv Today
    time: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step === 3) {
      fetchSlots();
    }
  }, [step, formData.date]);

  const generateTimeSlots = (dateStr: string, durationMinutes: number, existingBookings: any[]) => {
    const slots = [];
    const start = WORK_START_HOUR * 60; // 480 mins
    const end = WORK_END_HOUR * 60; // 1140 mins
    
    // Interval between slots (30 mins for cleaner scheduling)
    const step = 30; 

    const kyivDate = getKyivDate();
    const isToday = dateStr === kyivDate;
    const currentMinutes = getKyivCurrentMinutes();

    for (let time = start; time + durationMinutes <= end; time += step) {
       // Filter past time if today (Kyiv time)
       if (isToday && time < currentMinutes) continue;

       const timeEnd = time + durationMinutes;
       
       // Check collision
       let isBusy = false;
       for (const booking of existingBookings) {
         const [bH, bM] = booking.start_time.split(':').map(Number);
         const bStart = bH * 60 + bM;
         const bEnd = bStart + booking.duration_minutes;

         // Overlap logic: (StartA < EndB) and (EndA > StartB)
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

  const fetchSlots = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_date', formData.date);

    if (error) {
      console.error(error);
      setError('Помилка завантаження часу');
    } else {
      const slots = generateTimeSlots(formData.date, formData.serviceDuration, data || []);
      setAvailableSlots(slots);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    const { error } = await supabase.from('bookings').insert([
      {
        customer_name: formData.name,
        customer_phone: formData.phone,
        service_type: formData.serviceId,
        service_label: formData.serviceLabel,
        radius: formData.radius,
        booking_date: formData.date,
        start_time: formData.time,
        duration_minutes: formData.serviceDuration,
        status: 'confirmed' // Default status for web bookings
      }
    ]);

    if (error) {
      console.error(error);
      setError('Не вдалося створити запис. Спробуйте ще раз.');
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
         
         {/* Progress Bar */}
         <div className="h-1 w-full bg-zinc-800">
            <div className="h-full bg-[#FFC300] transition-all duration-300" style={{ width: `${(step / 5) * 100}%` }}></div>
         </div>

         {/* Header */}
         <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex justify-between items-center">
           <div className="flex items-center gap-2">
              {step > 1 && step < 5 && <button onClick={prevStep}><ArrowLeft className="text-zinc-400 hover:text-white" /></button>}
              <h3 className="text-xl font-bold text-white uppercase italic">Онлайн Запис</h3>
           </div>
           <button onClick={onClose}><X className="text-zinc-400 hover:text-white" /></button>
         </div>

         <div className="p-6">
           {/* STEP 1: Phone & Init */}
           {step === 1 && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h4 className="text-[#FFC300] font-bold text-lg mb-2">1. Ваш номер телефону</h4>
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-white text-xl font-bold focus:border-[#FFC300] outline-none"
                  placeholder="0XX XXX XX XX"
                />
                <button 
                  onClick={nextStep}
                  disabled={!formData.phone || formData.phone.length < 9}
                  className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-lg py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  ДАЛІ
                </button>
             </div>
           )}

           {/* STEP 2: Service & Radius */}
           {step === 2 && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
               <h4 className="text-[#FFC300] font-bold text-lg">2. Оберіть послугу</h4>
               <div className="grid gap-2">
                 {BOOKING_SERVICES.map(srv => (
                   <button
                     key={srv.id}
                     onClick={() => setFormData({...formData, serviceId: srv.id, serviceDuration: srv.duration, serviceLabel: srv.label})}
                     className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${formData.serviceId === srv.id ? 'border-[#FFC300] bg-[#FFC300]/10 text-white shadow-[0_0_15px_rgba(255,195,0,0.1)]' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500'}`}
                   >
                     <span className="font-bold">{srv.label}</span>
                     <span className="text-xs bg-black/50 px-2 py-1 rounded text-zinc-400">{srv.duration} хв</span>
                   </button>
                 ))}
               </div>

               <h4 className="text-[#FFC300] font-bold text-lg mt-4">Радіус коліс</h4>
               <div className="grid grid-cols-4 gap-2">
                 {WHEEL_RADII.map(r => (
                   <button
                     key={r}
                     onClick={() => setFormData({...formData, radius: r})}
                     className={`p-2 rounded-lg border text-sm font-bold transition-all ${formData.radius === r ? 'border-[#FFC300] bg-[#FFC300] text-black' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500'}`}
                   >
                     {r}
                   </button>
                 ))}
               </div>

               <button 
                  onClick={nextStep}
                  disabled={!formData.serviceId || !formData.radius}
                  className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-lg py-4 rounded-xl mt-6 disabled:opacity-50 transition-all"
                >
                  ДАЛІ
                </button>
             </div>
           )}

           {/* STEP 3: Date & Time */}
           {step === 3 && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
               <h4 className="text-[#FFC300] font-bold text-lg">3. Дата та Час</h4>
               <input 
                 type="date"
                 min={getKyivDate()} // Min date is Kyiv Today
                 value={formData.date}
                 onChange={(e) => setFormData({...formData, date: e.target.value, time: ''})}
                 className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white focus:border-[#FFC300] outline-none font-bold"
               />
               
               <div className="h-48 overflow-y-auto grid grid-cols-3 gap-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                 {loading ? <p className="col-span-3 text-center text-zinc-500 py-10 flex flex-col items-center"><span className="animate-spin text-[#FFC300] mb-2"><RefreshCw /></span>Пошук часу...</p> : 
                  availableSlots.length > 0 ? availableSlots.map(time => (
                   <button
                     key={time}
                     onClick={() => setFormData({...formData, time})}
                     className={`p-2 rounded-lg border font-bold transition-all ${formData.time === time ? 'border-[#FFC300] bg-[#FFC300] text-black' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700'}`}
                   >
                     {time}
                   </button>
                 )) : <p className="col-span-3 text-center text-red-400 py-4 border border-red-900/30 bg-red-900/10 rounded-lg">Немає вільного часу на цю дату</p>}
               </div>

               <button 
                  onClick={nextStep}
                  disabled={!formData.time}
                  className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-lg py-4 rounded-xl mt-4 disabled:opacity-50 transition-all"
                >
                  ДАЛІ
                </button>
             </div>
           )}

           {/* STEP 4: Name & Confirm */}
           {step === 4 && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
               <h4 className="text-[#FFC300] font-bold text-lg">4. Ваше Ім'я</h4>
               <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-white text-xl font-bold focus:border-[#FFC300] outline-none"
                  placeholder="Введіть ім'я"
                />
                
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700 space-y-2 text-sm text-zinc-300 mt-4">
                  <div className="flex justify-between border-b border-zinc-700 pb-2">
                      <span className="text-zinc-500">Послуга:</span> 
                      <span className="text-white font-bold">{formData.serviceLabel}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-700 pb-2">
                      <span className="text-zinc-500">Радіус:</span> 
                      <span className="text-white font-bold">{formData.radius}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-zinc-500">Час:</span> 
                      <span className="text-[#FFC300] font-bold">{formData.date} / {formData.time}</span>
                  </div>
                </div>

                {error && <p className="text-red-500 text-center bg-red-900/20 p-2 rounded">{error}</p>}

                <button 
                  onClick={handleSubmit}
                  disabled={!formData.name || loading}
                  className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-lg py-4 rounded-xl mt-4 disabled:opacity-50 transition-all"
                >
                  {loading ? 'ЗАПИС...' : 'ПІДТВЕРДИТИ ЗАПИС'}
                </button>
             </div>
           )}

           {/* STEP 5: Success */}
           {step === 5 && (
             <div className="text-center py-8 animate-in zoom-in duration-300">
               <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                 <CheckCircle size={48} />
               </div>
               <h3 className="text-3xl font-black text-white mb-2 uppercase italic">УСПІШНО!</h3>
               <p className="text-zinc-400 mb-8 text-lg">Ви записані. Чекаємо на вас!</p>
               <button 
                  onClick={onClose}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl border border-zinc-600"
                >
                  ЗАКРИТИ
                </button>
             </div>
           )}
         </div>
       </div>
    </div>
  );
};

export default BookingWizard;
