
import React, { useState, useEffect } from 'react';
import { Lock, Trash2, Calendar, Users, Search, Plus, X, History, Image as ImageIcon, Settings, Upload, Save, Phone, AlertTriangle, DollarSign, Loader2, Printer, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { BOOKING_SERVICES, WHEEL_RADII, WORK_START_HOUR, WORK_END_HOUR, PRICING_DATA_CARS, PRICING_DATA_SUV, ADDITIONAL_SERVICES, PriceRow } from '../constants';

interface AdminPanelProps {
  onLogout: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  // HELPER: Get Current Date/Time in Kyiv
  const getKyivTime = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
  const getKyivDateString = (date = getKyivTime()) => date.toLocaleDateString('en-CA'); // YYYY-MM-DD
  
  // Initialize date: If > 20:00, show starting from tomorrow
  const getInitialDate = () => {
    const now = getKyivTime();
    if (now.getHours() >= 20) {
      now.setDate(now.getDate() + 1);
    }
    return getKyivDateString(now);
  };

  const [activeTab, setActiveTab] = useState<'schedule' | 'clients' | 'archive' | 'gallery' | 'settings' | 'prices'>('schedule');
  const [selectedDate, setSelectedDate] = useState(getInitialDate());
  
  // Schedule State
  const [bookings, setBookings] = useState<any[]>([]);
  const [draggedBooking, setDraggedBooking] = useState<any | null>(null);
  
  // Clients & Archive State
  const [clients, setClients] = useState<any[]>([]);
  const [archiveBookings, setArchiveBookings] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  
  // Prices State
  const [priceData, setPriceData] = useState<{
    cars: PriceRow[],
    suv: PriceRow[],
    additional: { name: string, price: string }[]
  }>({
    cars: PRICING_DATA_CARS,
    suv: PRICING_DATA_SUV,
    additional: ADDITIONAL_SERVICES
  });
  const [pricesLoading, setPricesLoading] = useState(false);
  const [priceMessage, setPriceMessage] = useState('');
  
  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<number | null>(null);

  // Manual Booking State
  const [newBooking, setNewBooking] = useState({
    name: '',
    phone: '',
    time: '',
    serviceId: BOOKING_SERVICES[0].id, 
    radius: WHEEL_RADII[2],
    date: ''
  });
  const [availableManualSlots, setAvailableManualSlots] = useState<string[]>([]);

  // Gallery State
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Settings State
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  // Global Error State
  const [errorMessage, setErrorMessage] = useState('');

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 4000);
  };

  useEffect(() => {
    if (activeTab === 'schedule') fetchSchedule();
    else if (activeTab === 'archive') fetchArchive();
    else if (activeTab === 'clients') fetchClients();
    else if (activeTab === 'gallery') fetchGallery();
    else if (activeTab === 'prices') fetchPrices();
  }, [selectedDate, activeTab]);

  useEffect(() => {
    if (showAddModal) {
      calculateAvailableManualSlots();
    }
  }, [showAddModal, newBooking.date, newBooking.serviceId, bookings]);

  // --- SCHEDULE LOGIC ---
  const fetchSchedule = async () => {
    const dateObj = new Date(selectedDate);
    const nextDateObj = new Date(dateObj);
    nextDateObj.setDate(dateObj.getDate() + 1);
    
    const d1 = dateObj.toLocaleDateString('en-CA');
    const d2 = nextDateObj.toLocaleDateString('en-CA');

    const { data } = await supabase
      .from('bookings')
      .select('*')
      .in('booking_date', [d1, d2])
      .order('start_time', { ascending: true });
    
    if (data) setBookings(data);
  };

  const calculateAvailableManualSlots = () => {
    const date = newBooking.date || selectedDate;
    const service = BOOKING_SERVICES.find(s => s.id === newBooking.serviceId);
    const duration = service ? service.duration : 30;
    
    const slots = [];
    const start = WORK_START_HOUR * 60; 
    const end = WORK_END_HOUR * 60;
    const step = 10;

    const now = getKyivTime();
    const kyivDate = getKyivDateString(now);
    const isToday = date === kyivDate;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const dayBookings = bookings.filter(b => b.booking_date === date);

    for (let time = start; time + duration <= end; time += step) {
      if (isToday && time < currentMinutes) continue;

      const timeEnd = time + duration;
      let isBusy = false;

      for (const booking of dayBookings) {
        const [bH, bM] = booking.start_time.split(':').map(Number);
        const bStart = bH * 60 + bM;
        const bEnd = bStart + booking.duration_minutes;
        
        // Manual booking collision check logic
        const sTime = time;
        const eTime = timeEnd;
        
        // Simple overlap check
        if (sTime < bEnd && eTime > bStart) {
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
    setAvailableManualSlots(slots);
    
    if ((!newBooking.time || !slots.includes(newBooking.time)) && slots.length > 0) {
      setNewBooking(prev => ({ ...prev, time: slots[0] }));
    }
  };

  const handleDropOnGap = async (e: React.DragEvent, targetDate: string, startTimeStr: string) => {
    e.preventDefault();
    if (!draggedBooking) return;

    const updatedList = bookings.map(b => 
      b.id === draggedBooking.id ? { ...b, booking_date: targetDate, start_time: startTimeStr } : b
    );
    setBookings(updatedList);
    setDraggedBooking(null);

    await supabase
      .from('bookings')
      .update({ booking_date: targetDate, start_time: startTimeStr })
      .eq('id', draggedBooking.id);
    
    fetchSchedule();
  };

  const confirmDelete = (id: number) => {
    setBookingToDelete(id);
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    if (bookingToDelete) {
      await supabase.from('bookings').delete().eq('id', bookingToDelete);
      setBookings(bookings.filter(b => b.id !== bookingToDelete));
      setArchiveBookings(archiveBookings.filter(b => b.id !== bookingToDelete));
      
      const imgToDelete = galleryImages.find(img => img.id === bookingToDelete);
      if (imgToDelete) {
         await supabase.from('gallery').delete().eq('id', bookingToDelete);
         setGalleryImages(galleryImages.filter(g => g.id !== bookingToDelete));
      }

      setShowDeleteModal(false);
      setBookingToDelete(null);
    }
  };

  const handleAddStaffBooking = async () => {
    const bookingDate = newBooking.date || selectedDate;
    if (!newBooking.time) {
      showError("Оберіть час!");
      return;
    }

    const service = BOOKING_SERVICES.find(s => s.id === newBooking.serviceId);
    if (!service) return;

    const { error } = await supabase.from('bookings').insert([{
      customer_name: newBooking.name || 'Клієнт (Персонал)',
      customer_phone: newBooking.phone || '-',
      service_type: service.id,
      service_label: service.label,
      radius: newBooking.radius,
      booking_date: bookingDate,
      start_time: newBooking.time,
      duration_minutes: service.duration,
      status: 'staff'
    }]);

    if (!error) {
      setShowAddModal(false);
      fetchSchedule();
      setNewBooking({
        name: '', 
        phone: '', 
        time: '', 
        serviceId: BOOKING_SERVICES[0].id, 
        radius: WHEEL_RADII[2], 
        date: '' 
      });
    } else {
      console.error(error);
      showError("Помилка при записі.");
    }
  };

  const openAddModalAtTime = (dateStr: string, timeStr: string) => {
    setNewBooking(prev => ({ ...prev, date: dateStr, time: timeStr }));
    setShowAddModal(true);
  };

  // --- PRICES LOGIC ---
  const fetchPrices = async () => {
    setPricesLoading(true);
    try {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['prices_cars', 'prices_suv', 'prices_additional']);
      
      const newPrices = { ...priceData };
      if (data) {
        data.forEach((row: any) => {
          try {
            if (row.key === 'prices_cars') newPrices.cars = JSON.parse(row.value);
            if (row.key === 'prices_suv') newPrices.suv = JSON.parse(row.value);
            if (row.key === 'prices_additional') newPrices.additional = JSON.parse(row.value);
          } catch (e) {
            console.error("Error parsing price data", e);
          }
        });
        setPriceData(newPrices);
      }
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setPricesLoading(false);
    }
  };

  const handlePriceChange = (section: 'cars' | 'suv' | 'additional', index: number, field: string, value: string) => {
    const newData = { ...priceData };
    if (section === 'additional') {
      // @ts-ignore
      newData[section][index][field] = value;
    } else {
      // @ts-ignore
      newData[section][index][field] = value;
    }
    setPriceData(newData);
  };

  // Bulk Price Update Logic (supports negative for decrease)
  const handleBulkChange = (percent: number) => {
    const applyChange = (valStr: string) => {
      // Find numbers in string
      return valStr.replace(/-?\d+(\.\d+)?/g, (match) => {
        const num = parseFloat(match);
        if (isNaN(num)) return match;
        // Calculate new value
        const changed = num * (1 + percent / 100);
        // Round to nearest 5
        const rounded = Math.round(changed / 5) * 5;
        return rounded.toString();
      });
    };

    const newCars = priceData.cars.map(row => ({
      ...row,
      removeInstall: applyChange(row.removeInstall),
      balancing: applyChange(row.balancing),
      mounting: applyChange(row.mounting),
      total1: applyChange(row.total1),
      total4: applyChange(row.total4),
    }));

    const newSuv = priceData.suv.map(row => ({
      ...row,
      removeInstall: applyChange(row.removeInstall),
      balancing: applyChange(row.balancing),
      mounting: applyChange(row.mounting),
      total1: applyChange(row.total1),
      total4: applyChange(row.total4),
    }));

    const newAdditional = priceData.additional.map(item => ({
      ...item,
      price: applyChange(item.price)
    }));

    setPriceData({
      cars: newCars,
      suv: newSuv,
      additional: newAdditional
    });
    
    const direction = percent > 0 ? "піднято" : "знижено";
    setPriceMessage(`Ціни ${direction} на ${Math.abs(percent)}% (округлено до 5)`);
    setTimeout(() => setPriceMessage(''), 3000);
  };

  const savePrices = async () => {
    setPricesLoading(true);
    setPriceMessage('');
    try {
      const updates = [
        { key: 'prices_cars', value: JSON.stringify(priceData.cars) },
        { key: 'prices_suv', value: JSON.stringify(priceData.suv) },
        { key: 'prices_additional', value: JSON.stringify(priceData.additional) },
      ];

      for (const item of updates) {
        const { error } = await supabase.from('settings').upsert(item);
        if (error) throw error;
      }
      setPriceMessage('Ціни оновлено успішно!');
      setTimeout(() => setPriceMessage(''), 3000);
    } catch (error) {
      console.error("Error saving prices:", error);
      setPriceMessage('Помилка збереження.');
    } finally {
      setPricesLoading(false);
    }
  };

  const handlePrint = () => {
    try {
      window.focus();
      setTimeout(() => {
        window.print();
      }, 50);
    } catch (e) {
      console.error(e);
      alert("Натисніть Ctrl+P (або Cmd+P) для друку.");
    }
  };

  // --- CLIENTS & ARCHIVE ---
  const fetchClients = async () => {
    const { data } = await supabase.from('bookings').select('customer_name, customer_phone, created_at').order('created_at', { ascending: false });
    if (data) {
      const unique = new Map();
      data.forEach((item: any) => {
        if (!unique.has(item.customer_phone)) unique.set(item.customer_phone, { ...item, visits: 1 });
        else unique.get(item.customer_phone).visits += 1;
      });
      setClients(Array.from(unique.values()));
    }
  };

  const fetchArchive = async () => {
    const now = getKyivTime();
    let cutoffDate = getKyivDateString(now); // Default: < Today

    if (now.getHours() >= 20) {
       const tomorrow = new Date(now);
       tomorrow.setDate(tomorrow.getDate() + 1);
       cutoffDate = getKyivDateString(tomorrow); 
    }

    const { data } = await supabase
      .from('bookings')
      .select('*')
      .lt('booking_date', cutoffDate)
      .order('booking_date', { ascending: false });
      
    if (data) setArchiveBookings(data);
  };

  // --- GALLERY LOGIC ---
  const fetchGallery = async () => {
    const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
    if (data) setGalleryImages(data);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const sanitizedName = uploadFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}_${sanitizedName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage.from('galery').upload(fileName, uploadFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('galery').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('gallery').insert([{ url: publicUrl, description: uploadFile.name }]);
      if (dbError) throw dbError;

      fetchGallery();
      setUploadFile(null);
    } catch (err: any) {
      showError("Помилка завантаження: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdatePin = async () => {
    if (newPin.length < 4) { setPinMessage('Мінімум 4 символи'); return; }
    const { error } = await supabase.from('settings').upsert({ key: 'admin_pin', value: newPin });
    if (error) setPinMessage('Помилка оновлення');
    else { setPinMessage('Пароль змінено!'); setNewPin(''); }
  };

  const filteredClients = clients.filter(c => c.customer_name.toLowerCase().includes(clientSearch.toLowerCase()) || c.customer_phone.includes(clientSearch));
  const filteredArchive = archiveBookings.filter(b => b.customer_name.toLowerCase().includes(clientSearch.toLowerCase()) || b.customer_phone.includes(clientSearch));

  const getNextDate = () => { 
    const d = new Date(selectedDate); 
    d.setDate(d.getDate() + 1); 
    return d.toLocaleDateString('en-CA'); 
  };

  const renderDayTimeline = (dateStr: string) => {
    const dayBookings = bookings
      .filter(b => b.booking_date === dateStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    const now = getKyivTime();
    const kyivDate = getKyivDateString(now);
    const isToday = dateStr === kyivDate;
    
    let startTimeMins = WORK_START_HOUR * 60; 
    
    if (isToday) {
      const currentMins = now.getHours() * 60 + now.getMinutes();
      if (currentMins > startTimeMins) {
        startTimeMins = Math.ceil(currentMins / 10) * 10;
      }
    }
    
    const endTimeMins = WORK_END_HOUR * 60;
    const timelineItems = [];
    let cursor = startTimeMins;

    dayBookings.forEach(booking => {
      const [h, m] = booking.start_time.split(':').map(Number);
      const bStart = h * 60 + m;
      const bEnd = bStart + booking.duration_minutes;

      if (bEnd <= cursor) return;

      if (bStart > cursor) {
        const gapStart = Math.max(cursor, startTimeMins);
        let currentGapTime = gapStart;
        while (currentGapTime < bStart) {
             const timeLeft = bStart - currentGapTime;
             const chunkDuration = Math.min(30, timeLeft);
             timelineItems.push({ 
                 type: 'gap', 
                 start: currentGapTime, 
                 end: currentGapTime + chunkDuration, 
                 duration: chunkDuration 
             });
             currentGapTime += chunkDuration;
        }
      }
      timelineItems.push({ type: 'booking', data: booking });
      cursor = Math.max(cursor, bEnd);
    });

    if (cursor < endTimeMins) {
       let currentGapTime = cursor;
       while (currentGapTime < endTimeMins) {
           const timeLeft = endTimeMins - currentGapTime;
           const chunkDuration = Math.min(30, timeLeft);
           timelineItems.push({ 
               type: 'gap', 
               start: currentGapTime, 
               end: currentGapTime + chunkDuration, 
               duration: chunkDuration 
           });
           currentGapTime += chunkDuration;
       }
    }

    const minToTime = (m: number) => {
      const hh = Math.floor(m / 60).toString().padStart(2, '0');
      const mm = (m % 60).toString().padStart(2, '0');
      return `${hh}:${mm}`;
    };

    return (
      <div className="flex flex-col gap-2 p-2">
        {timelineItems.length === 0 && (
           <div className="text-zinc-500 text-center py-10 italic">Немає записів</div>
        )}

        {timelineItems.map((item, idx) => {
          if (item.type === 'booking') {
             const b = item.data;
             const isStaff = b.status === 'staff';
             return (
               <div 
                 key={b.id} 
                 draggable 
                 onDragStart={() => setDraggedBooking(b)}
                 className={`
                   relative p-3 rounded-xl border-l-4 shadow-lg transition-transform active:scale-[0.99] cursor-move
                   ${isStaff ? 'bg-zinc-800 border-blue-500' : 'bg-zinc-800 border-[#FFC300]'}
                 `}
               >
                 <div className="flex justify-between items-start">
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xl font-black ${isStaff ? 'text-blue-400' : 'text-[#FFC300]'}`}>
                            {b.start_time}
                          </span>
                          <span className="text-xs text-zinc-500 font-mono bg-black/50 px-1.5 py-0.5 rounded">
                            {b.duration_minutes} хв
                          </span>
                       </div>
                       <h4 className="text-white font-bold text-lg leading-none mb-1">{b.customer_name}</h4>
                       <p className="text-zinc-400 text-sm flex items-center gap-1"><Phone size={12}/> {b.customer_phone}</p>
                       <p className="text-zinc-500 text-xs mt-1">{b.service_label} ({b.radius})</p>
                    </div>
                    <button onClick={() => confirmDelete(b.id)} className="text-zinc-600 hover:text-red-500 p-2"><Trash2 size={18} /></button>
                 </div>
               </div>
             );
          } else {
             const timeStr = minToTime(item.start);
             return (
               <div 
                 key={`gap-${idx}`}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => handleDropOnGap(e, dateStr, timeStr)}
                 onClick={() => openAddModalAtTime(dateStr, timeStr)}
                 className="
                   group flex items-center justify-between p-2 rounded-lg border border-dashed border-zinc-800 
                   hover:border-[#FFC300] hover:bg-[#FFC300]/5 cursor-pointer transition-all min-h-[50px]
                 "
               >
                  <div className="flex items-center gap-3 text-zinc-600 group-hover:text-[#FFC300]">
                     <span className="text-base font-mono font-bold">{timeStr}</span>
                     <div className="h-px bg-zinc-800 w-full flex-grow group-hover:bg-[#FFC300]/30 transition-colors"></div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 bg-[#FFC300] text-black p-1 rounded-full transition-opacity">
                     <Plus size={14} />
                  </div>
               </div>
             );
          }
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      
      {/* Inject Strict Print Styles */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { height: auto !important; overflow: visible !important; background: white !important; color: black !important; }
          
          /* Hide everything by default using !important to override framework styles */
          .no-print { display: none !important; }
          
          /* Show print content */
          .print-only { display: block !important; visibility: visible !important; }
          
          /* Ensure table borders and text are black */
          table, th, td { border-color: black !important; color: black !important; }
          
          /* Avoid breaking tables awkwardly */
          .no-break { break-inside: avoid; }
          
          /* Hide scrollbars */
          ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {/* PRINT VIEW (Absolutely Plain HTML/CSS for A4) */}
      <div className="print-only w-full bg-white text-black text-sm" style={{ display: 'none' }}>
        <div className="text-center mb-6">
           <h1 className="text-3xl font-black uppercase tracking-widest mb-1 text-black">ФОРСАЖ</h1>
           <p className="text-sm text-black uppercase font-bold">Шиномонтажний сервіс</p>
           <p className="text-xs text-black mt-1">{new Date().toLocaleDateString()}</p>
        </div>
        
        <div className="flex flex-col gap-8">
          {/* Cars Print */}
          <div className="no-break">
            <h2 className="text-lg font-bold mb-2 uppercase border-b-2 border-black pb-1 text-black">Легкові Автомобілі</h2>
            <table className="w-full text-xs border-collapse border border-black">
              <thead>
                <tr className="bg-transparent text-black">
                  <th className="border border-black p-1 text-left">Радіус</th>
                  <th className="border border-black p-1 text-center">Зн/Вст</th>
                  <th className="border border-black p-1 text-center">Баланс</th>
                  <th className="border border-black p-1 text-center">Монтаж</th>
                  <th className="border border-black p-1 text-center font-bold">1 колесо</th>
                  <th className="border border-black p-1 text-center font-bold">4 колеса</th>
                </tr>
              </thead>
              <tbody>
                {priceData.cars.map((row, i) => (
                  <tr key={i}>
                    <td className="border border-black p-1 font-bold text-black">{row.isSurcharge ? row.radius : `R ${row.radius}`}</td>
                    <td className="border border-black p-1 text-center text-black">{row.removeInstall}</td>
                    <td className="border border-black p-1 text-center text-black">{row.balancing}</td>
                    <td className="border border-black p-1 text-center text-black">{row.mounting}</td>
                    <td className="border border-black p-1 text-center font-bold text-black">{row.total1}</td>
                    <td className="border border-black p-1 text-center font-bold text-black">{row.total4}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SUV Print */}
          <div className="no-break">
            <h2 className="text-lg font-bold mb-2 uppercase border-b-2 border-black pb-1 text-black">Мікроавтобуси / Кросовери</h2>
            <table className="w-full text-xs border-collapse border border-black">
              <thead>
                <tr className="bg-transparent text-black">
                  <th className="border border-black p-1 text-left">Радіус</th>
                  <th className="border border-black p-1 text-center">Зн/Вст</th>
                  <th className="border border-black p-1 text-center">Баланс</th>
                  <th className="border border-black p-1 text-center">Монтаж</th>
                  <th className="border border-black p-1 text-center font-bold">1 колесо</th>
                  <th className="border border-black p-1 text-center font-bold">4 колеса</th>
                </tr>
              </thead>
              <tbody>
                {priceData.suv.map((row, i) => (
                  <tr key={i}>
                    <td className="border border-black p-1 font-bold text-black">{row.isSurcharge ? row.radius : `R ${row.radius}`}</td>
                    <td className="border border-black p-1 text-center text-black">{row.removeInstall}</td>
                    <td className="border border-black p-1 text-center text-black">{row.balancing}</td>
                    <td className="border border-black p-1 text-center text-black">{row.mounting}</td>
                    <td className="border border-black p-1 text-center font-bold text-black">{row.total1}</td>
                    <td className="border border-black p-1 text-center font-bold text-black">{row.total4}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Additional Print */}
          <div className="no-break">
             <h2 className="text-lg font-bold mb-2 uppercase border-b-2 border-black pb-1 text-black">Додаткові Послуги</h2>
             <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                {priceData.additional.map((item, i) => (
                  <div key={i} className="flex justify-between border-b border-black/20 py-1 text-black">
                     <span>{item.name}</span>
                     <span className="font-bold whitespace-nowrap">{item.price}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
      
      {/* SCREEN VIEW */}
      <div className="no-print">
        {errorMessage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-red-900/90 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4 border border-red-500">
             <AlertTriangle size={20} className="text-red-300" />
             <span className="font-bold">{errorMessage}</span>
          </div>
        )}

        <header className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-50 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2"><div className="bg-[#FFC300] p-2 rounded-lg text-black"><Lock size={20} /></div><h1 className="text-xl font-bold uppercase tracking-wide">CRM Система</h1></div>
            <div className="flex flex-wrap bg-black rounded-lg p-1 border border-zinc-800 overflow-x-auto max-w-full">
              <button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 rounded font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'schedule' ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}><Calendar className="inline w-4 h-4 mr-2" /> Розклад</button>
              <button onClick={() => setActiveTab('prices')} className={`px-4 py-2 rounded font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'prices' ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}><DollarSign className="inline w-4 h-4 mr-2" /> Ціни</button>
              <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'archive' ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}><History className="inline w-4 h-4 mr-2" /> Історія</button>
              <button onClick={() => setActiveTab('clients')} className={`px-4 py-2 rounded font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'clients' ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}><Users className="inline w-4 h-4 mr-2" /> Клієнти</button>
              <button onClick={() => setActiveTab('gallery')} className={`px-4 py-2 rounded font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'gallery' ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}><ImageIcon className="inline w-4 h-4 mr-2" /> Галерея</button>
              <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}><Settings className="inline w-4 h-4 mr-2" /> Налаштування</button>
            </div>
            <div className="flex items-center gap-4">{activeTab === 'schedule' && <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white px-3 py-2 rounded-lg outline-none focus:border-[#FFC300]"/>}<button onClick={onLogout} className="text-sm text-zinc-500 hover:text-white">Вийти</button></div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-4">
          {activeTab === 'schedule' && (
            <div className="animate-in fade-in">
               <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-4 text-sm">
                     <div className="flex items-center gap-2"><span className="w-4 h-4 bg-zinc-800 border-l-4 border-[#FFC300] rounded"></span> Онлайн</div>
                     <div className="flex items-center gap-2"><span className="w-4 h-4 bg-zinc-800 border-l-4 border-blue-500 rounded"></span> Персонал</div>
                  </div>
                  <button onClick={() => setShowAddModal(true)} className="bg-[#FFC300] hover:bg-[#e6b000] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus size={18} /> Додати запис</button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Left Column (Selected Date) */}
                 <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[80vh]">
                   <div className="bg-black p-4 text-center border-b border-zinc-800 font-black text-2xl text-[#FFC300] uppercase sticky top-0 z-20 shadow-md">
                      {selectedDate}
                   </div>
                   <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-700">
                      {renderDayTimeline(selectedDate)}
                   </div>
                 </div>
                 
                 {/* Right Column (Next Day) */}
                 <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[80vh]">
                   <div className="bg-black p-4 text-center border-b border-zinc-800 font-black text-2xl text-zinc-400 uppercase sticky top-0 z-20 shadow-md">
                      {getNextDate()}
                   </div>
                   <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-700">
                      {renderDayTimeline(getNextDate())}
                   </div>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'prices' && (
            <div className="animate-in fade-in space-y-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-white">Редагування цін</h2>
                <div className="flex gap-2">
                   <button 
                     onClick={handlePrint}
                     className="bg-white text-black font-bold px-4 py-2 rounded-lg hover:bg-zinc-200 flex items-center gap-2 shadow-lg"
                     title="Друк прайс-листа"
                   >
                     <Printer size={20} /> Друк (А4)
                   </button>
                   <button 
                     onClick={savePrices} 
                     disabled={pricesLoading}
                     className="bg-[#FFC300] text-black font-black px-6 py-2 rounded-lg hover:bg-[#e6b000] flex items-center gap-2 disabled:opacity-50"
                   >
                     {pricesLoading ? <Loader2 className="animate-spin" /> : <Save size={20} />} 
                     ЗБЕРЕГТИ
                   </button>
                </div>
              </div>

              {/* Bulk Change Controls */}
              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Increase */}
                    <div>
                       <div className="flex items-center gap-2 mb-3 text-[#FFC300] font-bold uppercase text-sm">
                          <TrendingUp size={16} /> Швидке підняття (з округленням до 5)
                       </div>
                       <div className="flex flex-wrap gap-2">
                          {[2, 5, 10, 15, 20].map(percent => (
                             <button
                               key={`inc-${percent}`}
                               onClick={() => handleBulkChange(percent)}
                               className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-[#FFC300] hover:text-black border border-zinc-700 rounded-lg font-bold transition-colors text-sm"
                             >
                               +{percent}%
                             </button>
                          ))}
                       </div>
                    </div>
                    
                    {/* Decrease */}
                    <div>
                       <div className="flex items-center gap-2 mb-3 text-red-400 font-bold uppercase text-sm">
                          <TrendingDown size={16} /> Швидке зниження (з округленням до 5)
                       </div>
                       <div className="flex flex-wrap gap-2">
                          {[2, 5, 10, 15, 20].map(percent => (
                             <button
                               key={`dec-${percent}`}
                               onClick={() => handleBulkChange(-percent)}
                               className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-red-500 hover:text-white border border-zinc-700 rounded-lg font-bold transition-colors text-sm text-zinc-300"
                             >
                               -{percent}%
                             </button>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
              
              {priceMessage && <div className="bg-blue-500/20 text-blue-300 p-4 rounded-lg font-bold border border-blue-500/50 flex items-center gap-2"><Settings size={18}/> {priceMessage}</div>}

              {/* Cars */}
              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 overflow-x-auto">
                <h3 className="text-xl font-bold mb-4 text-[#FFC300]">Легкові авто</h3>
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="text-zinc-500 text-left">
                      <th className="p-2">Радіус</th>
                      <th className="p-2">Зняття/Вст</th>
                      <th className="p-2">Баланс</th>
                      <th className="p-2">Монтаж</th>
                      <th className="p-2">Сума 1</th>
                      <th className="p-2">Сума 4</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {priceData.cars.map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-zinc-300" value={row.radius || ''} onChange={e => handlePriceChange('cars', idx, 'radius', e.target.value)} /></td>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-white" value={row.removeInstall || ''} onChange={e => handlePriceChange('cars', idx, 'removeInstall', e.target.value)} /></td>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-white" value={row.balancing || ''} onChange={e => handlePriceChange('cars', idx, 'balancing', e.target.value)} /></td>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-white" value={row.mounting || ''} onChange={e => handlePriceChange('cars', idx, 'mounting', e.target.value)} /></td>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-[#FFC300] font-bold" value={row.total1 || ''} onChange={e => handlePriceChange('cars', idx, 'total1', e.target.value)} /></td>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-[#FFC300] font-bold" value={row.total4 || ''} onChange={e => handlePriceChange('cars', idx, 'total4', e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* SUVs */}
              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 overflow-x-auto">
                <h3 className="text-xl font-bold mb-4 text-[#FFC300]">Кросовери / Буси</h3>
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="text-zinc-500 text-left">
                      <th className="p-2">Радіус</th>
                      <th className="p-2">Зняття/Вст</th>
                      <th className="p-2">Баланс</th>
                      <th className="p-2">Монтаж</th>
                      <th className="p-2">Сума 1</th>
                      <th className="p-2">Сума 4</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {priceData.suv.map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-zinc-300" value={row.radius || ''} onChange={e => handlePriceChange('suv', idx, 'radius', e.target.value)} /></td>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-white" value={row.removeInstall || ''} onChange={e => handlePriceChange('suv', idx, 'removeInstall', e.target.value)} /></td>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-white" value={row.balancing || ''} onChange={e => handlePriceChange('suv', idx, 'balancing', e.target.value)} /></td>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-white" value={row.mounting || ''} onChange={e => handlePriceChange('suv', idx, 'mounting', e.target.value)} /></td>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-[#FFC300] font-bold" value={row.total1 || ''} onChange={e => handlePriceChange('suv', idx, 'total1', e.target.value)} /></td>
                        <td className="p-2"><input className="bg-black border border-zinc-700 rounded p-1 w-full text-[#FFC300] font-bold" value={row.total4 || ''} onChange={e => handlePriceChange('suv', idx, 'total4', e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Additional */}
              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                <h3 className="text-xl font-bold mb-4 text-[#FFC300]">Додаткові послуги</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {priceData.additional.map((item, idx) => (
                     <div key={idx} className="flex gap-2">
                        <input className="bg-black border border-zinc-700 rounded p-2 w-full text-zinc-300" value={item.name || ''} onChange={e => handlePriceChange('additional', idx, 'name', e.target.value)} />
                        <input className="bg-black border border-zinc-700 rounded p-2 w-24 text-[#FFC300] font-bold text-right" value={item.price || ''} onChange={e => handlePriceChange('additional', idx, 'price', e.target.value)} />
                     </div>
                   ))}
                </div>
              </div>
            </div>
          )}

          {/* ... (Other tabs remain unchanged) ... */}
          {activeTab === 'archive' && (
            <div className="animate-in fade-in">
               <div className="mb-6 relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" /><input type="text" placeholder="Пошук в архіві..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 text-white outline-none focus:border-[#FFC300]"/></div>
               <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                 <table className="w-full text-left">
                   <thead className="bg-black text-zinc-400 text-xs uppercase"><tr><th className="p-4">Дата</th><th className="p-4">Час</th><th className="p-4">Клієнт</th><th className="p-4">Телефон</th><th className="p-4">Послуга</th><th className="p-4">Джерело</th><th className="p-4 text-right">Дія</th></tr></thead>
                   <tbody className="divide-y divide-zinc-800">{filteredArchive.map(b => (<tr key={b.id} className="hover:bg-zinc-800/50 transition-colors"><td className="p-4 font-mono text-[#FFC300]">{b.booking_date}</td><td className="p-4 font-mono">{b.start_time}</td><td className="p-4 font-bold text-white">{b.customer_name}</td><td className="p-4 text-zinc-400">{b.customer_phone}</td><td className="p-4 text-zinc-300">{b.service_label} ({b.radius})</td><td className="p-4"><span className={`px-2 py-1 rounded text-xs uppercase font-bold ${b.status === 'staff' ? 'bg-blue-900/30 text-blue-400' : 'bg-yellow-900/30 text-yellow-500'}`}>{b.status === 'staff' ? 'Staff' : 'Web'}</span></td><td className="p-4 text-right"><button onClick={() => confirmDelete(b.id)} className="text-red-500 hover:text-red-400 p-2"><Trash2 size={16} /></button></td></tr>))}{filteredArchive.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Записів не знайдено</td></tr>}</tbody>
                 </table>
               </div>
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="animate-in fade-in">
              <div className="mb-6 relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" /><input type="text" placeholder="Пошук клієнта..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 text-white outline-none focus:border-[#FFC300]"/></div>
              <div className="grid gap-4">{filteredClients.map((client, idx) => (<div key={idx} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex justify-between items-center hover:border-zinc-600 transition-colors"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400"><Users size={20} /></div><div><h3 className="font-bold text-white text-lg">{client.customer_name}</h3><p className="text-zinc-500 font-mono flex items-center gap-2"><Phone size={12} /> {client.customer_phone}</p></div></div><div className="text-right"><div className="text-[#FFC300] font-bold text-xl">{client.visits}</div><div className="text-xs text-zinc-500 uppercase">Візитів</div></div></div>))}</div>
            </div>
          )}

          {activeTab === 'gallery' && (
             <div className="animate-in fade-in">
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-6">
                   <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Upload size={20} /> Завантажити фото</h3>
                   <div className="flex gap-4">
                      <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="bg-black border border-zinc-700 rounded-lg p-3 text-white flex-grow" />
                      <button onClick={handleUpload} disabled={!uploadFile || uploading} className="bg-[#FFC300] text-black font-bold px-6 py-3 rounded-lg hover:bg-[#e6b000] disabled:opacity-50">{uploading ? '...' : 'Завантажити'}</button>
                   </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   {galleryImages.map(img => (
                      <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-square border border-zinc-800">
                         <img src={img.url} alt="Gallery" className="w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button onClick={() => confirmDelete(img.id)} className="bg-red-600 p-2 rounded-full text-white hover:bg-red-700"><Trash2 size={20} /></button>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
             <div className="animate-in fade-in max-w-md mx-auto">
                <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800">
                   <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white"><Settings size={24} /> Зміна пароля адміністратора</h3>
                   <div className="space-y-4">
                      <input type="password" inputMode="numeric" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="Новий PIN-код (мін 4 цифри)" className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-center text-xl font-bold text-white outline-none focus:border-[#FFC300]" />
                      <button onClick={handleUpdatePin} className="w-full bg-[#FFC300] text-black font-black py-4 rounded-xl hover:bg-[#e6b000] flex items-center justify-center gap-2"><Save size={20} /> ЗБЕРЕГТИ</button>
                      {pinMessage && <p className="text-center text-zinc-400 font-bold">{pinMessage}</p>}
                   </div>
                </div>
             </div>
          )}
        </main>
      </div>

      {/* Manual Booking Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 no-print">
           <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-md">
              <h3 className="text-xl font-bold text-white mb-4">Ручний запис (Персонал)</h3>
              <div className="space-y-4">
                 <input className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none" placeholder="Ім'я клієнта" value={newBooking.name} onChange={e => setNewBooking({...newBooking, name: e.target.value})} />
                 <input className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none" placeholder="Телефон" value={newBooking.phone} onChange={e => setNewBooking({...newBooking, phone: e.target.value})} />
                 
                 <div className="grid grid-cols-2 gap-2">
                    <input type="date" className="bg-black border border-zinc-700 rounded-lg p-3 text-white" value={newBooking.date || selectedDate} onChange={e => setNewBooking({...newBooking, date: e.target.value})} />
                    <select 
                      className="bg-black border border-zinc-700 rounded-lg p-3 text-white outline-none" 
                      value={newBooking.time} 
                      onChange={e => setNewBooking({...newBooking, time: e.target.value})}
                    >
                       <option value="" disabled>Оберіть час</option>
                       {availableManualSlots.length > 0 ? (
                         availableManualSlots.map((t) => (
                           <option key={t} value={t}>
                             {t}
                           </option>
                         ))
                       ) : (
                         <option disabled>Немає вільного часу</option>
                       )}
                    </select>
                 </div>
                 
                 <div>
                    <label className="text-zinc-500 text-sm mb-1 block">Тип послуги:</label>
                    <select className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white outline-none" value={newBooking.serviceId} onChange={(e) => setNewBooking({...newBooking, serviceId: e.target.value})}>{BOOKING_SERVICES.map(s => <option key={s.id} value={s.id}>{s.label} ({s.duration} хв)</option>)}</select>
                 </div>
                 <div>
                    <label className="text-zinc-500 text-sm mb-1 block">Радіус:</label>
                    <div className="grid grid-cols-4 gap-2">{WHEEL_RADII.map(r => <button key={r} onClick={() => setNewBooking({...newBooking, radius: r})} className={`p-2 rounded text-xs font-bold transition-all border ${newBooking.radius === r ? 'bg-[#FFC300] text-black border-[#FFC300]' : 'bg-black text-zinc-400 border-zinc-800'}`}>{r}</button>)}</div>
                 </div>

                 <div className="flex gap-2 mt-4">
                    <button onClick={handleAddStaffBooking} disabled={!newBooking.time} className="flex-1 bg-[#FFC300] text-black font-bold py-3 rounded-lg hover:bg-[#e6b000] disabled:opacity-50">Створити</button>
                    <button onClick={() => setShowAddModal(false)} className="flex-1 bg-zinc-800 text-white font-bold py-3 rounded-lg hover:bg-zinc-700">Скасувати</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 no-print">
           <div className="bg-zinc-900 border border-red-900/50 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl">
              <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500"><Trash2 size={32} /></div>
              <h3 className="text-xl font-bold text-white mb-2">Видалити?</h3>
              <p className="text-zinc-400 mb-6">Цю дію неможливо відмінити.</p>
              <div className="flex gap-3"><button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors">Скасувати</button><button onClick={executeDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors">Видалити</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
