
import React, { useState, useEffect, useRef } from 'react';
import { Lock, Trash2, Calendar, Users, Search, Plus, X, Image as ImageIcon, Settings, Upload, Save, Phone, AlertTriangle, DollarSign, Loader2, TrendingUp, ShoppingBag, FileSpreadsheet, CheckSquare, Square, Edit2, ArrowRight, ArrowLeft, ArrowDown, Clock, Move, History } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { BOOKING_SERVICES, WHEEL_RADII, WORK_START_HOUR, WORK_END_HOUR, PRICING_DATA_CARS, PRICING_DATA_SUV, ADDITIONAL_SERVICES, PriceRow } from '../constants';
import { TyreProduct, TyreOrder } from '../types';
import readXlsxFile from 'read-excel-file';

interface AdminPanelProps {
  onLogout: () => void;
  mode: 'service' | 'tyre';
}

const PAGE_SIZE = 60;

// --- TIME HELPERS ---
const getKyivDateObj = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
const getKyivDateString = (date = getKyivDateObj()) => date.toLocaleDateString('en-CA'); // YYYY-MM-DD
const getKyivTimeString = () => {
  const d = getKyivDateObj();
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
};

// Convert "08:30" to minutes (e.g., 510)
const timeToMins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Convert minutes to "08:30"
const minsToTime = (m: number) => {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const min = (m % 60).toString().padStart(2, '0');
  return `${h}:${min}`;
};

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout, mode }) => {
  // Set initial tab based on mode
  const [activeTab, setActiveTab] = useState<'schedule' | 'clients' | 'gallery' | 'prices' | 'tyres' | 'orders' | 'stats'>(
    mode === 'service' ? 'schedule' : 'tyres'
  );

  // Force sync active tab with mode if props change
  useEffect(() => {
     if (mode === 'service' && !['schedule', 'clients', 'gallery', 'prices'].includes(activeTab)) {
        setActiveTab('schedule');
     } else if (mode === 'tyre' && !['tyres', 'orders', 'stats'].includes(activeTab)) {
        setActiveTab('tyres');
     }
  }, [mode]);

  // --- SCHEDULE STATE ---
  const [displayDate1, setDisplayDate1] = useState('');
  const [displayDate2, setDisplayDate2] = useState('');
  
  const [bookingsCol1, setBookingsCol1] = useState<any[]>([]);
  const [bookingsCol2, setBookingsCol2] = useState<any[]>([]);

  // Drag & Drop
  const [draggedBookingId, setDraggedBookingId] = useState<number | null>(null);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false); // Used for Add AND Edit
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<number | null>(null);
  
  // Form State (for Add/Edit)
  const [bookingForm, setBookingForm] = useState({
    id: null as number | null,
    name: '', 
    phone: '', 
    time: '', 
    date: '',
    serviceId: BOOKING_SERVICES[0].id, 
    radius: WHEEL_RADII[2],
    duration: 30
  });

  // --- TYRE SHOP STATE ---
  const [tyres, setTyres] = useState<TyreProduct[]>([]);
  const [tyrePage, setTyrePage] = useState(0);
  const [tyreCategoryTab, setTyreCategoryTab] = useState<'all' | 'winter' | 'summer' | 'cargo'>('all');
  const [hasMoreTyres, setHasMoreTyres] = useState(true);
  const [loadingTyres, setLoadingTyres] = useState(false);
  const [tyreOrders, setTyreOrders] = useState<TyreOrder[]>([]);
  const [showAddTyreModal, setShowAddTyreModal] = useState(false);
  const [editingTyreId, setEditingTyreId] = useState<number | null>(null);
  const [selectedTyreIds, setSelectedTyreIds] = useState<Set<number>>(new Set());
  const [bulkMarkup, setBulkMarkup] = useState('');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [tyreSearch, setTyreSearch] = useState('');
  const [tyreForm, setTyreForm] = useState({ manufacturer: '', name: '', radius: 'R15', season: 'winter', vehicle_type: 'car', price: '', base_price: '', catalog_number: '', description: '' });
  const [tyreUploadFiles, setTyreUploadFiles] = useState<File[]>([]); 
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  
  // Excel
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [excelStartRow, setExcelStartRow] = useState(2);
  const [importingExcel, setImportingExcel] = useState(false);
  const [columnMapping, setColumnMapping] = useState({ catalog_number: 0, manufacturer: 1, title: 2, base_price: 4, price: 5 });

  // Other Tabs
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientHistory, setSelectedClientHistory] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [additionalServices, setAdditionalServices] = useState<{ name: string, price: string }[]>(ADDITIONAL_SERVICES);
  const [priceDataCars, setPriceDataCars] = useState<PriceRow[]>(PRICING_DATA_CARS);
  const [priceDataSUV, setPriceDataSUV] = useState<PriceRow[]>(PRICING_DATA_SUV);
  const [statsData, setStatsData] = useState({ totalOrders: 0, totalRevenue: 0, totalTyres: 0, totalBookings: 0 });
  const [errorMessage, setErrorMessage] = useState('');

  const showError = (msg: string) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(''), 6000); };

  // --- SCHEDULE DATE LOGIC (20:00 Turnover) ---
  useEffect(() => {
    const calculateDates = () => {
       const now = getKyivDateObj();
       const currentHour = now.getHours();
       
       const d1 = new Date(now);
       const d2 = new Date(now);

       if (currentHour >= 20) {
          d1.setDate(now.getDate() + 1);
          d2.setDate(now.getDate() + 2);
       } else {
          d2.setDate(now.getDate() + 1);
       }
       
       setDisplayDate1(getKyivDateString(d1));
       setDisplayDate2(getKyivDateString(d2));
    };

    calculateDates();
    const interval = setInterval(calculateDates, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'schedule' && displayDate1 && displayDate2) fetchSchedule();
    else if (activeTab === 'clients') fetchClients();
    else if (activeTab === 'gallery') fetchGallery();
    else if (activeTab === 'prices') fetchPrices();
    else if (activeTab === 'tyres') fetchTyres(0, true);
    else if (activeTab === 'orders') fetchTyreOrders();
    else if (activeTab === 'stats') fetchStats();
  }, [activeTab, displayDate1, displayDate2]);

  // --- SCHEDULE LOGIC ---
  const fetchSchedule = async () => {
    if (!displayDate1 || !displayDate2) return;
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .in('booking_date', [displayDate1, displayDate2])
      .order('start_time', { ascending: true });

    if (data) {
      setBookingsCol1(data.filter((b: any) => b.booking_date === displayDate1));
      setBookingsCol2(data.filter((b: any) => b.booking_date === displayDate2));
    }
  };

  const getDayTimeline = (date: string, bookings: any[]) => {
    const sortedBookings = [...bookings].sort((a, b) => timeToMins(a.start_time) - timeToMins(b.start_time));
    
    const timelineItems = [];
    let currentMins = WORK_START_HOUR * 60;
    const endOfDayMins = WORK_END_HOUR * 60;

    // Iterate through bookings
    sortedBookings.forEach((booking) => {
       const bStart = timeToMins(booking.start_time);
       const bEnd = bStart + booking.duration_minutes;

       // 1. Render Gap BEFORE booking if exists
       if (bStart > currentMins) {
          timelineItems.push(renderFreeBlock(currentMins, bStart, date));
       }

       // 2. Render Booking
       timelineItems.push(renderBookingBlock(booking, date));

       // Update cursor
       currentMins = Math.max(currentMins, bEnd);
    });

    // 3. Render Gap AFTER last booking until end of day
    if (currentMins < endOfDayMins) {
       timelineItems.push(renderFreeBlock(currentMins, endOfDayMins, date));
    }

    return timelineItems;
  };

  const renderFreeBlock = (startMins: number, endMins: number, date: string) => {
     const duration = endMins - startMins;
     const h = Math.floor(duration / 60);
     const m = duration % 60;
     const label = `${h > 0 ? h + ' год ' : ''}${m > 0 ? m + ' хв' : ''}`;
     const startTimeStr = minsToTime(startMins);
     const endTimeStr = minsToTime(endMins);

     return (
       <div 
         key={`free-${startMins}`}
         className="flex gap-2 mb-2 min-h-[50px] group"
       >
         <div className="w-16 flex-shrink-0 flex flex-col items-center pt-2">
            <span className="text-zinc-500 font-mono text-sm">{startTimeStr}</span>
            <div className="w-px h-full bg-zinc-800 my-1"></div>
         </div>
         <div 
           className="flex-grow border border-dashed border-zinc-700 rounded-xl flex items-center justify-between px-4 bg-zinc-900/30 hover:bg-[#FFC300]/5 hover:border-[#FFC300] transition-all cursor-pointer"
           onClick={() => openAddModal(date, startTimeStr)}
           onDragOver={(e) => e.preventDefault()}
           onDrop={(e) => handleDropOnGap(e, date, startTimeStr)}
         >
             <div className="text-zinc-500 text-sm group-hover:text-[#FFC300]">
                Вільний час: <span className="font-bold text-white">{startTimeStr} - {endTimeStr}</span>
                <span className="block text-xs opacity-50">({label})</span>
             </div>
             <button className="bg-zinc-800 text-zinc-400 p-2 rounded-full group-hover:bg-[#FFC300] group-hover:text-black transition-colors">
                <Plus size={20} />
             </button>
         </div>
       </div>
     );
  };

  const renderBookingBlock = (booking: any, date: string) => {
      const bEndMins = timeToMins(booking.start_time) + booking.duration_minutes;
      const isPast = date === getKyivDateString() && bEndMins < timeToMins(getKyivTimeString());

      return (
         <div key={booking.id} className="flex gap-2 mb-2">
            <div className="w-16 flex-shrink-0 pt-2 text-right">
               <span className={`font-mono text-sm font-bold ${booking.status === 'staff' ? 'text-blue-400' : 'text-[#FFC300]'}`}>
                  {booking.start_time}
               </span>
            </div>
            <div 
               draggable={!isPast}
               onDragStart={() => setDraggedBookingId(booking.id)}
               onClick={() => openEditModal(booking)}
               className={`
                 flex-grow relative p-3 rounded-xl border-l-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.01]
                 ${booking.status === 'staff' ? 'bg-zinc-800 border-blue-500' : 'bg-zinc-900 border-[#FFC300]'}
                 ${isPast ? 'opacity-50 grayscale pointer-events-none' : ''}
                 ${booking.is_edited ? 'ring-1 ring-red-500' : ''}
               `}
            >
               <div className="flex justify-between items-start">
                  <div>
                     <div className="font-bold text-white leading-tight text-lg">{booking.customer_name}</div>
                     <div className="text-sm text-zinc-400 font-mono flex items-center gap-2 mt-1">
                        <Phone size={12}/> {booking.customer_phone}
                        {booking.is_edited && <span className="text-red-500 text-[10px] uppercase font-bold border border-red-500 px-1 rounded">Змінено</span>}
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="text-zinc-300 font-bold text-sm">{booking.service_label}</div>
                     <div className="bg-black/40 px-2 py-0.5 rounded text-xs text-zinc-500 inline-block mt-1">{booking.radius}</div>
                     <div className="text-xs text-zinc-500 mt-1 font-mono">до {minsToTime(bEndMins)}</div>
                  </div>
               </div>
            </div>
         </div>
      );
  };

  // --- ACTIONS ---
  const handleDropOnGap = async (e: React.DragEvent, targetDate: string, newTime: string) => {
    e.preventDefault();
    if (!draggedBookingId) return;

    // Optimistic Update
    const booking = [...bookingsCol1, ...bookingsCol2].find(b => b.id === draggedBookingId);
    if (!booking) return;

    const { error } = await supabase
      .from('bookings')
      .update({ 
         booking_date: targetDate, 
         start_time: newTime,
         is_edited: true // Flag as edited
      })
      .eq('id', draggedBookingId);

    if (error) showError("Помилка переміщення: " + error.message);
    else fetchSchedule(); // Refresh
    
    setDraggedBookingId(null);
  };

  const openAddModal = (date: string, time: string) => {
     setBookingForm({
        id: null,
        name: '',
        phone: '',
        time: time,
        date: date,
        serviceId: BOOKING_SERVICES[0].id,
        radius: WHEEL_RADII[2],
        duration: 30
     });
     setShowEditModal(true);
  };

  const openEditModal = (b: any) => {
     setBookingForm({
        id: b.id,
        name: b.customer_name,
        phone: b.customer_phone,
        time: b.start_time,
        date: b.booking_date,
        serviceId: b.service_type || BOOKING_SERVICES[0].id,
        radius: b.radius || WHEEL_RADII[2],
        duration: b.duration_minutes || 30
     });
     setShowEditModal(true);
  };

  const handleSaveBooking = async () => {
    if (!bookingForm.name || !bookingForm.phone || !bookingForm.time) return;
    
    // Find label
    const srv = BOOKING_SERVICES.find(s => s.id === bookingForm.serviceId);
    const label = srv ? srv.label : 'Custom';
    
    const payload = {
       customer_name: bookingForm.name,
       customer_phone: bookingForm.phone,
       service_type: bookingForm.serviceId,
       service_label: label,
       radius: bookingForm.radius,
       booking_date: bookingForm.date,
       start_time: bookingForm.time,
       duration_minutes: srv ? srv.duration : bookingForm.duration,
       status: 'staff', // Always staff when edited/added here
       is_edited: !!bookingForm.id // If updating, mark as edited
    };

    if (bookingForm.id) {
       // Update
       await supabase.from('bookings').update(payload).eq('id', bookingForm.id);
    } else {
       // Insert
       await supabase.from('bookings').insert([payload]);
    }
    
    setShowEditModal(false);
    fetchSchedule();
  };
  
  const handleDeleteBooking = async () => {
     if (bookingForm.id) {
        await supabase.from('bookings').delete().eq('id', bookingForm.id);
        setShowEditModal(false);
        fetchSchedule();
     }
  };

  // --- STATS ---
  const fetchStats = async () => {
    try {
      const { count: ordersCount } = await supabase.from('tyre_orders').select('*', { count: 'exact', head: true });
      const { count: tyresCount } = await supabase.from('tyres').select('*', { count: 'exact', head: true });
      const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
      const { data: orders } = await supabase.from('tyre_orders').select('items');
      let rev = 0;
      orders?.forEach((o: any) => { if (o.items) o.items.forEach((i: any) => { rev += (parseFloat(i.price) * i.quantity); }); });
      setStatsData({ totalOrders: ordersCount || 0, totalTyres: tyresCount || 0, totalBookings: bookingCount || 0, totalRevenue: rev });
    } catch (e) { console.error(e); }
  };

  // --- CLIENTS & ARCHIVE ---
  const fetchClients = async () => {
    // Fetch ALL bookings to aggregate
    const { data } = await supabase.from('bookings').select('*').order('booking_date', { ascending: false });
    if (data) {
        setClients(data); // Store all raw bookings
    }
  };

  // Helper to get unique clients from all bookings for the list view
  const uniqueClients = React.useMemo(() => {
     const map = new Map();
     clients.forEach((c) => {
        if (!map.has(c.customer_phone)) {
           map.set(c.customer_phone, {
              ...c,
              total_visits: 0
           });
        }
        const entry = map.get(c.customer_phone);
        entry.total_visits += 1;
        // Keep latest date
        if (new Date(c.booking_date) > new Date(entry.booking_date)) {
           entry.booking_date = c.booking_date;
        }
     });
     
     let arr = Array.from(map.values());
     if (clientSearch.trim()) {
        arr = arr.filter(c => c.customer_phone.includes(clientSearch.trim()) || c.customer_name.toLowerCase().includes(clientSearch.toLowerCase()));
     }
     return arr;
  }, [clients, clientSearch]);

  const openClientHistory = (phone: string) => {
     const history = clients.filter(c => c.customer_phone === phone);
     setSelectedClientHistory(history);
     setShowHistoryModal(true);
  };
  
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const handleEditClientSave = async () => {
      if(!editingClient) return;
      // Update ALL bookings for this phone number to keep history intact or update phone
      // Logic: Update all records where phone matches the OLD phone
      const oldPhone = selectedClientHistory[0]?.customer_phone;
      if (oldPhone) {
         await supabase.from('bookings')
            .update({ customer_name: editingClient.customer_name, customer_phone: editingClient.customer_phone })
            .eq('customer_phone', oldPhone);
         
         setEditingClient(null);
         setShowHistoryModal(false);
         fetchClients(); // Refresh list
      }
  };

  const deleteFromHistory = async (id: number) => {
     const { error } = await supabase.from('bookings').delete().eq('id', id);
     if (!error) {
        // Update local state
        setClients(prev => prev.filter(c => c.id !== id));
        setSelectedClientHistory(prev => prev.filter(c => c.id !== id));
     } else {
        showError("Помилка видалення");
     }
  };

  // --- GALLERY ---
  const fetchGallery = async () => { const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false }); if (data) setGalleryImages(data); };
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    const file = e.target.files[0];
    const fileName = `gallery_${Date.now()}`;
    try {
      const { error: uploadError } = await supabase.storage.from('galery').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('galery').getPublicUrl(fileName);
      await supabase.from('gallery').insert([{ url: urlData.publicUrl, description: 'Uploaded via Admin' }]);
      fetchGallery();
    } catch (err: any) { showError(err.message); } finally { setUploading(false); }
  };
  const deleteGalleryImage = async (id: number, url: string) => { await supabase.from('gallery').delete().eq('id', id); fetchGallery(); };

  // --- PRICES ---
  const fetchPrices = async () => {
    try {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['prices_cars', 'prices_suv', 'prices_additional']);
      if (data) data.forEach((r: any) => {
         if (r.key === 'prices_additional') setAdditionalServices(JSON.parse(r.value));
         if (r.key === 'prices_cars') setPriceDataCars(JSON.parse(r.value));
         if (r.key === 'prices_suv') setPriceDataSUV(JSON.parse(r.value));
      });
    } catch (e) { console.error(e); }
  };
  const saveAllPrices = async () => {
       await supabase.from('settings').upsert({ key: 'prices_additional', value: JSON.stringify(additionalServices) });
       await supabase.from('settings').upsert({ key: 'prices_cars', value: JSON.stringify(priceDataCars) });
       await supabase.from('settings').upsert({ key: 'prices_suv', value: JSON.stringify(priceDataSUV) });
       showError("Всі ціни збережено успішно!");
  };

  // --- TYRE SHOP ---
  const fetchTyres = async (pageIdx: number, isRefresh = false) => {
    setLoadingTyres(true);
    try {
       const from = pageIdx * PAGE_SIZE;
       const to = from + PAGE_SIZE - 1;
       let query = supabase.from('tyres').select('*', { count: 'exact' });
       if (tyreSearch.trim().length > 0) query = query.or(`title.ilike.%${tyreSearch.trim()}%,catalog_number.ilike.%${tyreSearch.trim()}%,radius.ilike.%${tyreSearch.trim()}%`);
       if (tyreCategoryTab === 'winter') query = query.or('title.ilike.%winter%,title.ilike.%зима%,description.ilike.%winter%,description.ilike.%зима%');
       else if (tyreCategoryTab === 'summer') query = query.or('title.ilike.%summer%,title.ilike.%літо%,description.ilike.%summer%,description.ilike.%літо%');
       else if (tyreCategoryTab === 'cargo') query = query.or('title.ilike.%C%,radius.ilike.%C%'); 
       const { data, error } = await query.order('created_at', { ascending: false }).range(from, to);
       if (data) {
          if (isRefresh) { setTyres(data); setTyrePage(0); setSelectedTyreIds(new Set()); } 
          else { setTyres(prev => [...prev, ...data]); setTyrePage(pageIdx); }
          setHasMoreTyres(data.length === PAGE_SIZE);
       }
    } catch (e) { console.error(e); } finally { setLoadingTyres(false); }
  };
  
  const handleSaveTyre = async () => {
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of tyreUploadFiles) {
         const fileName = `tyre_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
         const { error } = await supabase.storage.from('galery').upload(fileName, file);
         if (!error) { const { data } = supabase.storage.from('galery').getPublicUrl(fileName); newUrls.push(data.publicUrl); }
      }
      const finalGallery = [...existingGallery, ...newUrls];
      const seasonLabel = tyreForm.season === 'winter' ? 'Winter' : tyreForm.season === 'summer' ? 'Summer' : 'All Season';
      const payload: any = {
        title: `${tyreForm.manufacturer} ${tyreForm.name} ${tyreForm.radius} ${seasonLabel}`,
        description: tyreForm.description || `Сезон: ${seasonLabel}.`,
        price: tyreForm.price.replace(',', '.'), base_price: tyreForm.base_price, manufacturer: tyreForm.manufacturer, catalog_number: tyreForm.catalog_number, radius: tyreForm.radius, image_url: finalGallery[0], gallery: finalGallery
      };
      if (editingTyreId) await supabase.from('tyres').update(payload).eq('id', editingTyreId);
      else await supabase.from('tyres').insert([payload]);
      fetchTyres(0, true); setShowAddTyreModal(false);
    } catch (err: any) { showError(err.message); } finally { setUploading(false); }
  };

  const processExcelImport = async () => {
    if (!excelFile) return;
    setImportingExcel(true);
    try {
        const rows = await readXlsxFile(excelFile);
        const dataToUpsert = [];
        for (let i = excelStartRow - 1; i < rows.length; i++) {
            const row = rows[i];
            const catNum = row[columnMapping.catalog_number]?.toString().trim() || '';
            const manufacturer = row[columnMapping.manufacturer]?.toString().trim() || '';
            const titleRaw = row[columnMapping.title]?.toString().trim() || '';
            const basePrice = row[columnMapping.base_price]?.toString().replace(/[^\d.,]/g, '').replace(',', '.') || '';
            const retailPrice = row[columnMapping.price]?.toString().replace(/[^\d.,]/g, '').replace(',', '.') || '';
            if (!titleRaw || (!retailPrice && !basePrice)) continue;
            let season = 'all-season';
            const lowerTitle = titleRaw.toLowerCase();
            if (lowerTitle.includes('winter') || lowerTitle.includes('зима') || lowerTitle.includes('ice')) season = 'winter';
            else if (lowerTitle.includes('summer') || lowerTitle.includes('літо')) season = 'summer';
            let radius = 'R15'; let isCargo = false;
            const radMatch = titleRaw.match(/R\d{2}[C]?/i);
            if (radMatch) { radius = radMatch[0].toUpperCase(); if (radius.includes('C')) isCargo = true; }
            dataToUpsert.push({
               catalog_number: catNum, manufacturer: manufacturer, title: manufacturer ? `${manufacturer} ${titleRaw}` : titleRaw,
               description: `Сезон: ${season}. ${isCargo ? 'Вантажні.' : ''}`, radius: radius,
               price: retailPrice ? Math.round(parseFloat(retailPrice)).toString() : '0', base_price: basePrice ? Math.round(parseFloat(basePrice)).toString() : '0',
            });
        }
        for (const item of dataToUpsert) {
            let existing = item.catalog_number ? (await supabase.from('tyres').select('id').eq('catalog_number', item.catalog_number).eq('title', item.title).maybeSingle()).data : null;
            if (existing) await supabase.from('tyres').update(item).eq('id', existing.id);
            else await supabase.from('tyres').insert([item]);
        }
        showError("Імпорт завершено!"); setShowExcelModal(false); fetchTyres(0, true);
    } catch (err: any) { showError("Помилка імпорту: " + err.message); } finally { setImportingExcel(false); }
  };

  const applyBulkMarkup = async () => {
    if (!bulkMarkup || selectedTyreIds.size === 0) return;
    setIsApplyingBulk(true);
    try {
        const { data: currentItems } = await supabase.from('tyres').select('id, price, base_price').in('id', Array.from(selectedTyreIds));
        if (currentItems) {
            for (const item of currentItems) {
                const base = item.base_price ? parseFloat(item.base_price) : parseFloat(item.price);
                if (!isNaN(base)) await supabase.from('tyres').update({ price: Math.round(base * (1 + parseFloat(bulkMarkup.replace(',', '.')) / 100)).toString() }).eq('id', item.id);
            }
            showError("Ціни оновлено!"); fetchTyres(0, true); setSelectedTyreIds(new Set()); setBulkMarkup('');
        }
    } catch (err: any) { showError(err.message); } finally { setIsApplyingBulk(false); }
  };

  // --- RENDER HELPERS ---
  const TablePriceEditor = ({ data, category }: { data: PriceRow[], category: 'cars' | 'suv' }) => (
     <div className="overflow-x-auto bg-black border border-zinc-700 rounded-lg p-2 mb-8">
        <table className="w-full text-xs md:text-sm text-left">
           <thead className="text-zinc-500 uppercase font-bold"><tr><th className="p-2">R</th><th className="p-2">Зняття/Вст</th><th className="p-2">Баланс</th><th className="p-2">Монтаж</th><th className="p-2 text-[#FFC300]">Сума (1)</th><th className="p-2 text-[#FFC300]">Сума (4)</th></tr></thead>
           <tbody className="divide-y divide-zinc-800">
              {data.map((row, idx) => (
                 <tr key={idx}>
                    <td className="p-2 text-[#FFC300] font-bold w-16">{row.radius}</td>
                    {['removeInstall','balancing','mounting','total1','total4'].map(f => (
                       <td key={f} className="p-2"><input value={(row as any)[f]} onChange={e => {
                          const n = category === 'cars' ? [...priceDataCars] : [...priceDataSUV]; (n as any)[idx][f] = e.target.value; category === 'cars' ? setPriceDataCars(n) : setPriceDataSUV(n);
                       }} className="w-16 bg-zinc-900 border border-zinc-700 rounded p-1 text-white text-center"/></td>
                    ))}
                 </tr>
              ))}
           </tbody>
        </table>
     </div>
  );
  
  const fetchTyreOrders = async () => { const { data } = await supabase.from('tyre_orders').select('*').order('created_at', { ascending: false }); if(data) setTyreOrders(data); };

  const formatDisplayDate = (dateStr: string) => {
     if (!dateStr) return '';
     const today = getKyivDateString();
     const tomorrow = getKyivDateString(new Date(new Date().setDate(new Date().getDate() + 1)));
     if (dateStr === today) return `Сьогодні (${dateStr})`;
     if (dateStr === tomorrow) return `Завтра (${dateStr})`;
     return dateStr;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      {errorMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-red-900/90 text-white px-6 py-3 rounded-full border border-red-500 animate-in fade-in slide-in-from-top-4 font-bold">{errorMessage}</div>}

      <header className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
           <h1 className="text-xl font-bold uppercase flex items-center gap-2"><Lock className="text-[#FFC300]"/> Admin Panel <span className="text-xs text-zinc-500 bg-black px-2 py-0.5 rounded">{mode === 'service' ? 'Сервіс (1234)' : 'Магазин (1994)'}</span></h1>
           <div className="flex bg-black rounded-lg p-1 overflow-x-auto">
              {mode === 'service' && ['schedule', 'clients', 'prices', 'gallery'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded font-bold text-sm uppercase ${activeTab === t ? 'bg-[#FFC300] text-black' : 'text-zinc-400'}`}>{t === 'schedule' ? 'Розклад' : t === 'clients' ? 'Клієнти' : t === 'prices' ? 'Ціни' : 'Галерея'}</button>
              ))}
              {mode === 'tyre' && ['tyres', 'orders', 'stats'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded font-bold text-sm uppercase ${activeTab === t ? 'bg-[#FFC300] text-black' : 'text-zinc-400'}`}>{t === 'tyres' ? 'Шини' : t === 'orders' ? 'Замовлення' : 'Статистика'}</button>
              ))}
              <button onClick={onLogout} className="px-4 py-2 text-zinc-500 hover:text-white ml-2">Вихід</button>
           </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
         {/* --- SCHEDULE (NEW) --- */}
         {activeTab === 'schedule' && (
           <div className="animate-in fade-in">
             <div className="flex items-center gap-2 mb-4 bg-blue-900/20 p-3 rounded-lg border border-blue-900/50">
               <Clock className="text-blue-400" size={20} />
               <span className="text-blue-200 font-bold">Час за Києвом: {getKyivTimeString()}</span>
               {new Date().getHours() >= 20 && <span className="text-orange-400 font-bold ml-2">(Вечірній режим: показано наступні дні)</span>}
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* COLUMN 1 */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[80vh]">
                   <div className="bg-black p-4 border-b border-zinc-800 flex justify-between items-center sticky top-0 z-20">
                      <div>
                        <h3 className="text-xl font-black text-white uppercase italic">{formatDisplayDate(displayDate1)}</h3>
                      </div>
                      <div className="bg-zinc-800 px-3 py-1 rounded-full text-xs font-bold text-zinc-400">
                        {bookingsCol1.length} записів
                      </div>
                   </div>
                   <div className="p-4 overflow-y-auto flex-grow bg-black/20 scrollbar-thin scrollbar-thumb-zinc-700">
                      {getDayTimeline(displayDate1, bookingsCol1)}
                   </div>
                </div>

                {/* COLUMN 2 */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[80vh]">
                   <div className="bg-black p-4 border-b border-zinc-800 flex justify-between items-center sticky top-0 z-20">
                      <div>
                        <h3 className="text-xl font-black text-zinc-300 uppercase italic">{formatDisplayDate(displayDate2)}</h3>
                      </div>
                      <div className="bg-zinc-800 px-3 py-1 rounded-full text-xs font-bold text-zinc-400">
                        {bookingsCol2.length} записів
                      </div>
                   </div>
                   <div className="p-4 overflow-y-auto flex-grow bg-black/20 scrollbar-thin scrollbar-thumb-zinc-700">
                      {getDayTimeline(displayDate2, bookingsCol2)}
                   </div>
                </div>
             </div>
           </div>
         )}

         {/* --- CLIENTS (Updated with History & Search) --- */}
         {activeTab === 'clients' && (
            <div className="animate-in fade-in">
               <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-2"><Users className="text-[#FFC300]"/> База Клієнтів</h3>
               <div className="mb-4 relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                     type="text" 
                     placeholder="Пошук за номером телефону..." 
                     value={clientSearch}
                     onChange={(e) => setClientSearch(e.target.value)}
                     className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-[#FFC300] text-white"
                  />
               </div>
               <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-black text-zinc-500 uppercase font-bold text-xs"><tr><th className="p-4">Ім'я</th><th className="p-4">Телефон</th><th className="p-4">Візитів</th><th className="p-4 text-right">Останній візит</th><th className="p-4"></th></tr></thead>
                     <tbody className="divide-y divide-zinc-800">
                        {uniqueClients.map((c, idx) => (
                           <tr key={idx} className="hover:bg-zinc-800/50 cursor-pointer group" onClick={() => openClientHistory(c.customer_phone)}>
                              <td className="p-4 font-bold text-white text-lg">{c.customer_name}</td>
                              <td className="p-4 font-mono text-[#FFC300] font-bold">{c.customer_phone}</td>
                              <td className="p-4 text-zinc-400 font-bold">{c.total_visits}</td>
                              <td className="p-4 text-right text-zinc-400">{c.booking_date}</td>
                              <td className="p-4 text-right"><History className="inline text-zinc-600 group-hover:text-[#FFC300]" size={18} /></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}
         
         {activeTab === 'gallery' && (
            <div className="animate-in fade-in">
               <div className="mb-6 flex justify-between items-center"><h3 className="text-xl font-bold">Галерея</h3><div className="relative"><button onClick={() => galleryInputRef.current?.click()} className="bg-[#FFC300] text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#e6b000]">{uploading ? <Loader2 className="animate-spin" /> : <Upload size={18}/>} Завантажити</button><input type="file" ref={galleryInputRef} onChange={handleGalleryUpload} className="hidden" accept="image/*" /></div></div>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{galleryImages.map(img => (<div key={img.id} className="relative group rounded-xl overflow-hidden aspect-square border border-zinc-800"><img src={img.url} className="w-full h-full object-cover" /><button onClick={() => deleteGalleryImage(img.id, img.url)} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100"><Trash2 size={20}/></button></div>))}</div>
            </div>
         )}

         {activeTab === 'prices' && (
            <div className="animate-in fade-in space-y-8">
               <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 sticky top-20 z-40 flex justify-between items-center mb-8 shadow-xl"><h3 className="text-2xl font-black text-white flex items-center gap-2"><Settings className="text-[#FFC300]"/> Прайси</h3><button onClick={saveAllPrices} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-500 flex items-center gap-2 shadow-lg"><Save size={20}/> Зберегти</button></div>
               <div><h4 className="text-lg font-bold text-white mb-4">Легкові</h4><TablePriceEditor data={priceDataCars} category="cars" /></div>
               <div><h4 className="text-lg font-bold text-white mb-4">Кросовери</h4><TablePriceEditor data={priceDataSUV} category="suv" /></div>
               <div><h4 className="text-lg font-bold text-white mb-4">Додаткові</h4><div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{additionalServices.map((service, idx) => (<div key={idx} className="flex gap-2"><input value={service.name} onChange={e => {const n=[...additionalServices]; n[idx].name=e.target.value; setAdditionalServices(n);}} className="bg-black border border-zinc-700 rounded p-2 text-white flex-grow"/><input value={service.price} onChange={e => {const n=[...additionalServices]; n[idx].price=e.target.value; setAdditionalServices(n);}} className="bg-black border border-zinc-700 rounded p-2 text-[#FFC300] w-24 font-bold text-center"/></div>))}</div></div></div>
            </div>
         )}

         {/* STATS, ORDERS, TYRES (Kept same logic) */}
         {activeTab === 'stats' && <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in"><div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Всього замовлень</h3><p className="text-4xl font-black text-white">{statsData.totalOrders}</p></div><div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Шини</h3><p className="text-4xl font-black text-[#FFC300]">{statsData.totalTyres}</p></div><div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Записів</h3><p className="text-4xl font-black text-white">{statsData.totalBookings}</p></div><div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 relative overflow-hidden"><h3 className="text-zinc-400 text-xs font-bold uppercase">Орієнтовний дохід</h3><p className="text-3xl font-black text-green-400">{statsData.totalRevenue.toLocaleString()} грн</p><DollarSign className="absolute -bottom-4 -right-4 text-green-900/20 w-32 h-32" /></div></div>}
         {activeTab === 'orders' && <div className="space-y-4 animate-in fade-in">{tyreOrders.map((order) => (<div key={order.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col gap-4"><div className="flex justify-between items-start"><div><h3 className="font-bold text-white text-lg">{order.customer_name}</h3><div className="text-[#FFC300] font-bold flex items-center gap-2"><Phone size={14}/> {order.customer_phone}</div></div><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${order.status === 'new' ? 'bg-green-600 text-white' : 'bg-zinc-700'}`}>{order.status}</span></div>{order.items && <div className="space-y-2">{order.items.map((item: any, idx: number) => (<div key={idx} className="flex justify-between items-center text-sm border-b border-zinc-800 pb-2"><span className="text-zinc-300">{item.title}</span><div className="flex gap-4"><span className="font-bold">{item.quantity} шт</span><span className="text-[#FFC300] font-mono">{item.price} грн</span></div></div>))}</div>}</div>))}</div>}
         {activeTab === 'tyres' && (
            <div className="animate-in fade-in">
               <div className="flex flex-col md:flex-row gap-4 justify-between mb-6">
                  <div className="flex gap-2 bg-black p-1 rounded-lg self-start overflow-x-auto max-w-full">{['all', 'winter', 'summer', 'cargo'].map(c => (<button key={c} onClick={() => { setTyreCategoryTab(c as any); fetchTyres(0, true); }} className={`px-3 py-1 rounded text-sm font-bold uppercase whitespace-nowrap ${tyreCategoryTab === c ? 'bg-white text-black' : 'text-zinc-500'}`}>{c}</button>))}</div>
                  <div className="relative flex-grow max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/><input type="text" placeholder="Пошук..." value={tyreSearch} onChange={e => setTyreSearch(e.target.value)} onKeyDown={e => e.key==='Enter' && fetchTyres(0,true)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 outline-none focus:border-[#FFC300]" /></div>
                  <div className="flex gap-2"><button onClick={() => fileInputRef.current?.click()} className="bg-zinc-800 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 border border-zinc-700 hover:bg-zinc-700"><FileSpreadsheet size={18}/> Імпорт</button><input type="file" ref={fileInputRef} onChange={e => {if(e.target.files?.[0]) {setExcelFile(e.target.files[0]); setShowExcelModal(true);}}} className="hidden" accept=".xlsx" /><button onClick={() => {setEditingTyreId(null); setTyreForm({ manufacturer: '', name: '', radius: 'R15', season: 'winter', vehicle_type: 'car', price: '', base_price: '', catalog_number: '', description: '' }); setExistingGallery([]); setTyreUploadFiles([]); setShowAddTyreModal(true);}} className="bg-[#FFC300] text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#e6b000]"><Plus size={18}/> Додати</button></div>
               </div>
               {selectedTyreIds.size > 0 && <div className="bg-[#FFC300] text-black p-3 rounded-xl flex items-center justify-between mb-4"><div className="font-bold flex items-center gap-2"><CheckSquare size={18}/> Обрано: {selectedTyreIds.size}</div><div className="flex items-center gap-2"><input type="text" value={bulkMarkup} onChange={e => setBulkMarkup(e.target.value)} placeholder="%" className="w-24 p-2 rounded bg-white border border-black/20 text-center font-bold" /><button onClick={applyBulkMarkup} disabled={isApplyingBulk} className="bg-black text-white px-4 py-2 rounded-lg font-bold">{isApplyingBulk ? '...' : 'Ок'}</button></div></div>}
               <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-black text-zinc-500 uppercase font-bold text-xs"><tr><th className="p-4 w-10"><button onClick={() => setSelectedTyreIds(selectedTyreIds.size===tyres.length ? new Set() : new Set(tyres.map(t=>t.id)))}>{selectedTyreIds.size===tyres.length ? <CheckSquare size={16}/> : <Square size={16}/>}</button></th><th className="p-4">Фото</th><th className="p-4">Код</th><th className="p-4">Назва</th><th className="p-4 text-center">R</th><th className="p-4 text-right">Ціна</th><th className="p-4 text-right">Дії</th></tr></thead><tbody className="divide-y divide-zinc-800">{tyres.map(t => (<tr key={t.id} className={`hover:bg-zinc-800/50 ${selectedTyreIds.has(t.id) ? 'bg-[#FFC300]/10' : ''}`}><td className="p-4"><button onClick={() => {const n=new Set(selectedTyreIds); if(n.has(t.id))n.delete(t.id); else n.add(t.id); setSelectedTyreIds(n);}}>{selectedTyreIds.has(t.id)?<CheckSquare size={16} className="text-[#FFC300]"/>:<Square size={16}/>}</button></td><td className="p-4 w-16"><div className="w-10 h-10 bg-black rounded overflow-hidden">{t.image_url ? <img src={t.image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-[10px]">NO</div>}</div></td><td className="p-4 text-zinc-400 font-mono text-xs">{t.catalog_number}</td><td className="p-4 font-bold max-w-[200px] truncate">{t.title}</td><td className="p-4 text-center text-[#FFC300] font-bold">{t.radius}</td><td className="p-4 text-right font-mono text-white">{t.price}</td><td className="p-4 text-right flex justify-end gap-2"><button onClick={() => { setEditingTyreId(t.id); setTyreForm({ manufacturer: t.manufacturer||'', name: t.title.replace(t.manufacturer||'','').trim(), radius: t.radius||'R15', season: t.description?.includes('winter')?'winter':t.description?.includes('summer')?'summer':'all-season', vehicle_type: t.radius?.includes('C')?'cargo':'car', price: t.price, base_price: t.base_price||'', catalog_number: t.catalog_number||'', description: t.description||'' }); setExistingGallery(t.gallery||(t.image_url?[t.image_url]:[])); setTyreUploadFiles([]); setShowAddTyreModal(true); }} className="p-2 bg-zinc-800 rounded hover:text-white"><Edit2 size={16}/></button><button onClick={() => {setBookingToDelete(t.id); setShowDeleteModal(true);}} className="p-2 bg-zinc-800 rounded hover:text-red-500"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
               {hasMoreTyres && <div className="mt-8 text-center pb-8"><button onClick={() => fetchTyres(tyrePage + 1, false)} disabled={loadingTyres} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-12 rounded-xl border border-zinc-700 flex items-center gap-2 mx-auto disabled:opacity-50">{loadingTyres ? <Loader2 className="animate-spin" /> : <ArrowDown size={20} />} Завантажити ще</button></div>}
            </div>
         )}
      </main>

      {/* CLIENT HISTORY MODAL */}
      {showHistoryModal && (
         <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
               <div className="flex justify-between items-center p-4 border-b border-zinc-800">
                  <div>
                     {editingClient ? (
                        <div className="flex gap-2">
                           <input value={editingClient.customer_name} onChange={e => setEditingClient({...editingClient, customer_name: e.target.value})} className="bg-black border border-zinc-700 p-1 rounded text-white" />
                           <input value={editingClient.customer_phone} onChange={e => setEditingClient({...editingClient, customer_phone: e.target.value})} className="bg-black border border-zinc-700 p-1 rounded text-[#FFC300]" />
                           <button onClick={handleEditClientSave} className="bg-green-600 text-white px-3 rounded">Ок</button>
                        </div>
                     ) : (
                        <>
                           <h3 className="text-xl font-bold text-white flex items-center gap-2">Архів записів <button onClick={() => setEditingClient({customer_name: selectedClientHistory[0]?.customer_name, customer_phone: selectedClientHistory[0]?.customer_phone})} className="text-zinc-500 hover:text-white"><Edit2 size={16}/></button></h3>
                           <p className="text-zinc-400 text-sm font-mono">{selectedClientHistory[0]?.customer_name} | {selectedClientHistory[0]?.customer_phone}</p>
                        </>
                     )}
                  </div>
                  <button onClick={() => {setShowHistoryModal(false); setEditingClient(null);}}><X className="text-zinc-500 hover:text-white"/></button>
               </div>
               <div className="flex-grow overflow-y-auto p-4">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-black text-zinc-500 uppercase font-bold text-xs sticky top-0"><tr><th className="p-3">Дата</th><th className="p-3">Час</th><th className="p-3">Послуга</th><th className="p-3 text-right"></th></tr></thead>
                     <tbody className="divide-y divide-zinc-800">
                        {selectedClientHistory.map(b => (
                           <tr key={b.id} className="hover:bg-zinc-800/30">
                              <td className="p-3 text-white">{b.booking_date}</td>
                              <td className="p-3 text-[#FFC300] font-bold">{b.start_time}</td>
                              <td className="p-3 text-zinc-300">{b.service_label} <span className="text-zinc-500">({b.radius})</span></td>
                              <td className="p-3 text-right">
                                 <button onClick={() => deleteFromHistory(b.id)} className="text-zinc-600 hover:text-red-500"><Trash2 size={16}/></button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      )}

      {/* EDIT BOOKING MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-bold text-white">{bookingForm.id ? 'Редагувати' : 'Новий'} запис</h3>
                 <button onClick={() => setShowEditModal(false)}><X className="text-zinc-500 hover:text-white"/></button>
              </div>
              <div className="space-y-4">
                 <input placeholder="Ім'я" value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-3 text-white"/>
                 <input placeholder="Телефон" value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-3 text-white"/>
                 <div className="grid grid-cols-2 gap-2">
                    <select value={bookingForm.serviceId} onChange={e => {
                       const s = BOOKING_SERVICES.find(srv => srv.id === e.target.value);
                       setBookingForm({...bookingForm, serviceId: e.target.value, duration: s ? s.duration : 30});
                    }} className="bg-black border border-zinc-700 rounded p-3 text-white text-sm">{BOOKING_SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                    <select value={bookingForm.radius} onChange={e => setBookingForm({...bookingForm, radius: e.target.value})} className="bg-black border border-zinc-700 rounded p-3 text-white text-sm">{WHEEL_RADII.map(r => <option key={r} value={r}>{r}</option>)}</select>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={bookingForm.date} onChange={e => setBookingForm({...bookingForm, date: e.target.value})} className="bg-black border border-zinc-700 rounded p-3 text-white" />
                    <input type="time" value={bookingForm.time} onChange={e => setBookingForm({...bookingForm, time: e.target.value})} className="bg-black border border-zinc-700 rounded p-3 text-white" />
                 </div>
                 <div className="flex gap-3 pt-2">
                    {bookingForm.id && <button onClick={handleDeleteBooking} className="p-3 bg-red-900/50 text-red-500 rounded-lg hover:bg-red-900"><Trash2/></button>}
                    <button onClick={handleSaveBooking} className="flex-grow bg-[#FFC300] text-black py-3 rounded-lg font-black hover:bg-[#e6b000]">ЗБЕРЕГТИ</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* EXCEL MODAL (Kept same) */}
      {showExcelModal && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col">
               <div className="flex justify-between items-center mb-4"><h3 className="text-2xl font-black text-white flex items-center gap-2"><FileSpreadsheet className="text-[#FFC300]" /> Імпорт Excel</h3><button onClick={() => setShowExcelModal(false)}><X className="text-zinc-500 hover:text-white"/></button></div>
               <div className="flex-grow overflow-auto border border-zinc-800 rounded-lg bg-black/30"><table className="w-full text-xs text-left whitespace-nowrap"><thead className="bg-zinc-800 text-zinc-400 sticky top-0"><tr><th className="p-2 border-r border-zinc-700 w-10">#</th>{Array.from({length: 10}).map((_, i) => (<th key={i} className={`p-2 border-r border-zinc-700 font-bold ${Object.values(columnMapping).includes(i) ? 'bg-[#FFC300]/20 text-[#FFC300]' : ''}`}>Col {String.fromCharCode(65 + i)}</th>))}</tr></thead><tbody className="text-zinc-300">{excelPreview.map((row, idx) => (<tr key={idx} className={idx + 1 < excelStartRow ? 'opacity-30' : ''}><td className="p-2 border-r border-zinc-800 bg-zinc-900 text-center font-mono">{idx + 1}</td>{row.slice(0, 10).map((cell: any, cIdx: number) => (<td key={cIdx} className="p-2 border-r border-zinc-800 border-b">{cell !== null ? cell.toString() : ''}</td>))}</tr>))}</tbody></table></div>
               <div className="mt-4 flex justify-end gap-4"><button onClick={() => setShowExcelModal(false)} className="px-6 py-3 rounded-xl font-bold bg-zinc-800 text-white">Скасувати</button><button onClick={processExcelImport} disabled={importingExcel} className="px-8 py-3 rounded-xl font-black bg-green-600 text-white">{importingExcel ? <Loader2 className="animate-spin" /> : <Save size={20} />} Імпорт</button></div>
            </div>
        </div>
      )}

      {/* TYRE ADD/EDIT MODAL (Kept same) */}
      {showAddTyreModal && (<div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]"><h3 className="text-xl font-bold text-white mb-4">{editingTyreId ? 'Редагувати' : 'Додати'} шину</h3><div className="space-y-4"><input placeholder="Назва" value={tyreForm.name} onChange={e => setTyreForm({...tyreForm, name: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-3 text-white"/><div className="grid grid-cols-2 gap-4"><input placeholder="Виробник" value={tyreForm.manufacturer} onChange={e => setTyreForm({...tyreForm, manufacturer: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-3 text-white"/><input placeholder="Каталог №" value={tyreForm.catalog_number} onChange={e => setTyreForm({...tyreForm, catalog_number: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-3 text-white"/></div><div className="grid grid-cols-3 gap-4"><input placeholder="R15" value={tyreForm.radius} onChange={e => setTyreForm({...tyreForm, radius: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-3 text-white"/><select value={tyreForm.season} onChange={e => setTyreForm({...tyreForm, season: e.target.value})} className="bg-black border border-zinc-700 rounded p-3 text-white"><option value="winter">Зима</option><option value="summer">Літо</option><option value="all-season">Всесезон</option></select><input placeholder="Ціна" value={tyreForm.price} onChange={e => setTyreForm({...tyreForm, price: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-3 text-white"/></div><div><label className="block text-sm font-bold text-zinc-400 mb-2">Фото</label><div className="flex flex-wrap gap-2 mb-2">{existingGallery.map((url, idx) => (<div key={idx} className="w-16 h-16 relative group"><img src={url} className="w-full h-full object-cover rounded"/><button onClick={() => setExistingGallery(prev => prev.filter(u => u !== url))} className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-full"><X size={12}/></button></div>))}</div><input type="file" multiple onChange={e => setTyreUploadFiles(Array.from(e.target.files || []))} className="w-full bg-black border border-zinc-700 rounded p-3 text-white"/></div><div className="flex gap-3 pt-4"><button onClick={() => setShowAddTyreModal(false)} className="flex-1 bg-zinc-800 py-3 rounded-lg font-bold">Скасувати</button><button onClick={handleSaveTyre} disabled={uploading} className="flex-1 bg-[#FFC300] text-black py-3 rounded-lg font-black">{uploading ? <Loader2 className="animate-spin mx-auto"/> : 'ЗБЕРЕГТИ'}</button></div></div></div></div>)}

      {/* Delete Modal Generic */}
      {showDeleteModal && (<div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-zinc-900 border border-red-900/50 p-6 rounded-2xl w-full max-w-sm text-center"><h3 className="text-xl font-bold text-white mb-4">Видалити запис?</h3><div className="flex gap-3"><button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-zinc-800 py-3 rounded-xl font-bold">Ні</button><button onClick={async () => { if (bookingToDelete) { if (activeTab === 'tyres') await supabase.from('tyres').delete().eq('id', bookingToDelete); else await supabase.from('bookings').delete().eq('id', bookingToDelete); setBookingToDelete(null); setShowDeleteModal(false); if (activeTab === 'tyres') fetchTyres(0, true); else fetchSchedule(); } }} className="flex-1 bg-red-600 py-3 rounded-xl font-bold">Так</button></div></div></div>)}
    </div>
  );
};

export default AdminPanel;
