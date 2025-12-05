
import React, { useState, useEffect, useRef } from 'react';
import { Lock, Trash2, Calendar, Users, Search, Plus, X, Image as ImageIcon, Settings, Upload, Save, Phone, AlertTriangle, DollarSign, Loader2, TrendingUp, ShoppingBag, FileSpreadsheet, CheckSquare, Square, Edit2, ArrowRight, ArrowLeft, ArrowDown, Clock, Move, History, Wand2, Percent, Printer, Filter, Flame, KeyRound, FileCheck, FileWarning, CheckCircle, Package, RotateCcw, ImagePlus, Eye, Menu, Folder, FolderOpen, Truck, Car, Mountain, Sparkles, HelpCircle, Layers } from 'lucide-react';
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

const timeToMins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const minsToTime = (m: number) => {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const min = (m % 60).toString().padStart(2, '0');
  return `${h}:${min}`;
};

const generateTimeOptions = (selectedDate?: string) => {
  const options = [];
  const todayStr = getKyivDateString();
  const isToday = selectedDate === todayStr;
  
  // Calculate current minutes if it's today
  let currentMins = -1;
  if (isToday) {
     const now = getKyivDateObj();
     currentMins = now.getHours() * 60 + now.getMinutes();
  }

  for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
    for (let m = 0; m < 60; m += 10) {
      // If it's today, skip times that have already passed
      if (isToday && (h * 60 + m) < currentMins) {
          continue;
      }
      options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return options;
};

// Helper to convert index to Excel column name (0->A, 1->B, etc.)
const getExcelColumnName = (index: number) => {
    let columnName = "";
    let dividend = index + 1;
    let modulo;

    while (dividend > 0) {
        modulo = (dividend - 1) % 26;
        columnName = String.fromCharCode(65 + modulo) + columnName;
        dividend = Math.floor((dividend - 1) / 26);
    }
    return columnName;
};

// --- TYPES FOR UPLOAD REPORT ---
interface UploadReportItem {
  fileName: string;
  status: 'success' | 'skipped' | 'error';
  message: string;
  productName?: string;
  previewUrl?: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout, mode }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'clients' | 'gallery' | 'prices' | 'settings' | 'tyres' | 'orders' | 'stats'>(
    mode === 'service' ? 'schedule' : 'tyres'
  );

  useEffect(() => {
     if (mode === 'service' && !['schedule', 'clients', 'gallery', 'prices', 'settings'].includes(activeTab)) {
        setActiveTab('schedule');
     } else if (mode === 'tyre' && !['tyres', 'orders', 'stats', 'settings'].includes(activeTab)) {
        setActiveTab('tyres');
     }
  }, [mode]);

  // --- SCHEDULE STATE ---
  const [displayDate1, setDisplayDate1] = useState('');
  const [displayDate2, setDisplayDate2] = useState('');
  const [bookingsCol1, setBookingsCol1] = useState<any[]>([]);
  const [bookingsCol2, setBookingsCol2] = useState<any[]>([]);
  const [draggedBookingId, setDraggedBookingId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<number | null>(null);
  const [bookingForm, setBookingForm] = useState({
    id: null as number | null,
    name: '', phone: '', time: '08:00', date: '',
    serviceId: BOOKING_SERVICES[0].id, radius: WHEEL_RADII[2], duration: 30
  });

  // --- TYRE SHOP STATE ---
  const [tyres, setTyres] = useState<TyreProduct[]>([]);
  const [tyrePage, setTyrePage] = useState(0);
  
  // Category / Folder State
  const [tyreCategoryTab, setTyreCategoryTab] = useState<'all' | 'car' | 'cargo' | 'suv' | 'hot'>('all');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState({ all: 0, car: 0, cargo: 0, suv: 0, hot: 0 });

  const [hasMoreTyres, setHasMoreTyres] = useState(true);
  const [loadingTyres, setLoadingTyres] = useState(false);
  const [tyreOrders, setTyreOrders] = useState<TyreOrder[]>([]);
  const [showAddTyreModal, setShowAddTyreModal] = useState(false);
  const [editingTyreId, setEditingTyreId] = useState<number | null>(null);
  const [selectedTyreIds, setSelectedTyreIds] = useState<Set<number>>(new Set());
  
  // Bulk Actions
  const [bulkMarkup, setBulkMarkup] = useState('');
  const [bulkCategory, setBulkCategory] = useState<'car' | 'suv' | 'cargo' | ''>(''); // New Bulk Category State
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const smartUploadInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [tyreSearch, setTyreSearch] = useState('');
  
  // Form State
  const [tyreForm, setTyreForm] = useState({ 
      title: '', // ADDED TITLE FIELD FOR DIRECT EDITING
      manufacturer: '', 
      name: '', // Used only for parsing/display if needed, but Title is primary
      radius: 'R15', 
      season: 'winter', 
      vehicle_type: 'car' as 'car' | 'cargo' | 'suv', 
      price: '', 
      base_price: '', 
      catalog_number: '', 
      description: '', 
      is_hot: false 
  });
  
  const [tyreUploadFiles, setTyreUploadFiles] = useState<File[]>([]); 
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  
  // Stock Stats (Kept in state logic but hidden from UI as requested)
  const [stockStats, setStockStats] = useState({ total: 0, inStock: 0, outStock: 0 });

  // Smart Upload Report State
  const [uploadReport, setUploadReport] = useState<UploadReportItem[]>([]);
  const [showUploadReport, setShowUploadReport] = useState(false);

  // Excel
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelStartRow, setExcelStartRow] = useState(2);
  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [importingExcel, setImportingExcel] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  // Added optional mappings: radius, season, vehicle_type
  const [columnMapping, setColumnMapping] = useState<{ [key: string]: number }>({ catalog_number: 0, manufacturer: 1, title: 2, base_price: 4, price: 5 });
  const [markMissingOutOfStock, setMarkMissingOutOfStock] = useState(false);

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
  
  // Security / Settings
  const [adminPin, setAdminPin] = useState('');
  const [tyrePin, setTyrePin] = useState('');
  const [statsData, setStatsData] = useState({ totalOrders: 0, totalRevenue: 0, totalTyres: 0, totalBookings: 0 });
  const [errorMessage, setErrorMessage] = useState('');

  // Custom Confirmation Modal State (To replace window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showError = (msg: string) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(''), 6000); };
  const closeConfirmModal = () => setConfirmModal(null);

  // --- SCHEDULE DATE LOGIC ---
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

  // --- SEPARATED EFFECTS FOR DATA FETCHING ---
  
  // 1. Schedule fetches when dates or tab changes
  useEffect(() => {
    if (activeTab === 'schedule' && displayDate1 && displayDate2) {
      fetchSchedule();
    }
  }, [activeTab, displayDate1, displayDate2]);

  // 2. General tabs fetches
  useEffect(() => {
    if (activeTab === 'clients') fetchClients();
    else if (activeTab === 'gallery') fetchGallery();
    else if (activeTab === 'prices' || activeTab === 'settings') fetchPrices(); 
    else if (activeTab === 'orders') fetchTyreOrders();
    else if (activeTab === 'stats') fetchStats();
  }, [activeTab]);

  // 3. Tyre fetches - depend on activeTab AND tyreCategoryTab
  useEffect(() => {
    if (activeTab === 'tyres') {
        setTyres([]); // Clear list visually to show category change
        fetchTyres(0, true); 
        fetchStockStats(); 
        fetchCategoryCounts(); 
    }
  }, [activeTab, tyreCategoryTab]); // This ensures category switch triggers fetch

  // --- SCHEDULE LOGIC ---
  const fetchSchedule = async () => {
    if (!displayDate1 || !displayDate2) return;
    const { data } = await supabase.from('bookings').select('*').in('booking_date', [displayDate1, displayDate2]).order('start_time', { ascending: true });
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
    sortedBookings.forEach((booking) => {
       const bStart = timeToMins(booking.start_time);
       const bEnd = bStart + booking.duration_minutes;
       if (bStart > currentMins) timelineItems.push(renderFreeBlock(currentMins, bStart, date));
       timelineItems.push(renderBookingBlock(booking, date));
       currentMins = Math.max(currentMins, bEnd);
    });
    if (currentMins < endOfDayMins) timelineItems.push(renderFreeBlock(currentMins, endOfDayMins, date));
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
       <div key={`free-${startMins}`} className="flex gap-2 mb-2 min-h-[50px] group">
         <div className="w-14 flex-shrink-0 flex flex-col items-center pt-2"><span className="text-zinc-500 font-mono text-sm">{startTimeStr}</span><div className="w-px h-full bg-zinc-800 my-1"></div></div>
         <div className="flex-grow border border-dashed border-zinc-700 rounded-xl flex items-center justify-between px-4 bg-zinc-900/30 hover:bg-[#FFC300]/5 hover:border-[#FFC300] transition-all cursor-pointer relative" onClick={() => openAddModal(date, startTimeStr)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropOnGap(e, date, startTimeStr)}>
             <div className="text-zinc-500 text-sm group-hover:text-[#FFC300]">Вільний час: <span className="font-bold text-white">{startTimeStr} - {endTimeStr}</span><span className="block text-xs opacity-50">({label})</span></div>
             <button className="bg-zinc-800 text-zinc-400 p-2 rounded-full group-hover:bg-[#FFC300] group-hover:text-black transition-colors z-10"><Plus size={20} /></button>
         </div>
       </div>
     );
  };

  const renderBookingBlock = (booking: any, date: string) => {
      const bEndMins = timeToMins(booking.start_time) + booking.duration_minutes;
      const isPast = date === getKyivDateString() && bEndMins < timeToMins(getKyivTimeString());
      return (
         <div key={booking.id} className="flex gap-2 mb-2">
            <div className="w-14 flex-shrink-0 pt-2 text-right"><span className={`font-mono text-sm font-bold ${booking.status === 'staff' ? 'text-blue-400' : 'text-[#FFC300]'}`}>{booking.start_time}</span></div>
            <div draggable={!isPast} onDragStart={() => setDraggedBookingId(booking.id)} onClick={() => openEditModal(booking)} className={`flex-grow relative p-3 rounded-xl border-l-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.01] ${booking.status === 'staff' ? 'bg-zinc-800 border-blue-500' : 'bg-zinc-900 border-[#FFC300]'} ${isPast ? 'opacity-50 grayscale pointer-events-none' : ''} ${booking.is_edited ? 'ring-1 ring-red-500' : ''}`}>
               <div className="flex justify-between items-start">
                  <div><div className="font-bold text-white leading-tight text-lg">{booking.customer_name}</div><div className="text-sm text-zinc-400 font-mono flex items-center gap-2 mt-1"><Phone size={12}/> {booking.customer_phone}{booking.is_edited && <span className="text-red-500 text-[10px] uppercase font-bold border border-red-500 px-1 rounded">Змінено</span>}</div></div>
                  <div className="text-right"><div className="text-zinc-300 font-bold text-sm">{booking.service_label}</div><div className="bg-black/40 px-2 py-0.5 rounded text-xs text-zinc-500 inline-block mt-1">{booking.radius}</div><div className="text-xs text-zinc-500 mt-1 font-mono">до {minsToTime(bEndMins)}</div></div>
               </div>
            </div>
         </div>
      );
  };

  const handleDropOnGap = async (e: React.DragEvent, targetDate: string, newTime: string) => {
    e.preventDefault();
    if (!draggedBookingId) return;
    const { error } = await supabase.from('bookings').update({ booking_date: targetDate, start_time: newTime, is_edited: true }).eq('id', draggedBookingId);
    if (error) showError("Помилка переміщення: " + error.message);
    else fetchSchedule();
    setDraggedBookingId(null);
  };

  const openAddModal = (date: string, time?: string) => { 
      // Intelligent time selection: if adding manually without clicking on a specific slot,
      // and it's today, try to pick the first available time instead of hardcoded 08:00
      let initialTime = time || '08:00';
      
      if (!time && date === getKyivDateString()) {
         const available = generateTimeOptions(date);
         if (available.length > 0) initialTime = available[0];
      }

      setBookingForm({ id: null, name: '', phone: '', time: initialTime, date: date, serviceId: BOOKING_SERVICES[0].id, radius: WHEEL_RADII[2], duration: 30 }); 
      setShowEditModal(true); 
  };
  const openEditModal = (b: any) => { setBookingForm({ id: b.id, name: b.customer_name, phone: b.customer_phone, time: b.start_time, date: b.booking_date, serviceId: b.service_type || BOOKING_SERVICES[0].id, radius: b.radius || WHEEL_RADII[2], duration: b.duration_minutes || 30 }); setShowEditModal(true); };

  const handleSaveBooking = async () => {
    if (!bookingForm.name || !bookingForm.phone || !bookingForm.time) return;
    const srv = BOOKING_SERVICES.find(s => s.id === bookingForm.serviceId);
    const payload = { customer_name: bookingForm.name, customer_phone: bookingForm.phone, service_type: bookingForm.serviceId, service_label: srv ? srv.label : 'Custom', radius: bookingForm.radius, booking_date: bookingForm.date, start_time: bookingForm.time, duration_minutes: srv ? srv.duration : bookingForm.duration, status: 'staff', is_edited: !!bookingForm.id };
    if (bookingForm.id) await supabase.from('bookings').update(payload).eq('id', bookingForm.id);
    else await supabase.from('bookings').insert([payload]);
    setShowEditModal(false); fetchSchedule();
  };
  
  const handleDeleteBooking = async () => { if (bookingForm.id) { await supabase.from('bookings').delete().eq('id', bookingForm.id); setShowEditModal(false); fetchSchedule(); } };

  const openEditTyreModal = (t: TyreProduct) => {
    try {
      setEditingTyreId(t.id);
      
      const manufacturer = t.manufacturer || '';
      const title = t.title || '';
      // Safe string replacement attempt for display, but main editing is done via 'title' field now
      const name = manufacturer ? title.replace(manufacturer, '').trim() : title;
      
      // Determine season safely
      let season = t.season || 'all-season';
      if (!t.season) {
          const desc = (t.description || '').toLowerCase();
          if (desc.includes('winter') || desc.includes('зима')) season = 'winter';
          else if (desc.includes('summer') || desc.includes('літо')) season = 'summer';
      }
      
      // Determine vehicle type safely
      let vehicleType = 'car';
      if (t.vehicle_type) {
          vehicleType = t.vehicle_type;
      } else {
          // Fallback logic
          const radius = (t.radius || '').toUpperCase();
          if (radius.includes('C')) vehicleType = 'cargo';
      }

      setTyreForm({ 
        title: title, // SET TITLE EXPLICITLY
        manufacturer, 
        name, 
        radius: t.radius || 'R15', 
        season: season, 
        vehicle_type: vehicleType as any, 
        price: String(t.price || ''), 
        base_price: String(t.base_price || ''), 
        catalog_number: t.catalog_number || '', 
        description: t.description || '', 
        is_hot: !!t.is_hot 
      });
      
      let gallery = t.gallery || [];
      if (gallery.length === 0 && t.image_url) {
          gallery = [t.image_url];
      }
      setExistingGallery(gallery);
      
      setTyreUploadFiles([]);
      setShowAddTyreModal(true);
    } catch (error: any) {
      console.error("Error opening edit modal:", error);
      showError("Помилка відкриття редагування: " + error.message);
    }
  };

  // --- STATS ---
  const fetchStats = async () => {
    try {
      const { count: ordersCount } = await supabase.from('tyre_orders').select('*', { count: 'exact', head: true });
      const { count: tyresCount } = await supabase.from('tyres').select('*', { count: 'exact', head: true });
      const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
      
      const { data: orders } = await supabase.from('tyre_orders').select('items');
      // Fetch title for fallback matching
      const { data: allTyres } = await supabase.from('tyres').select('id, base_price, title');
      
      const basePriceMap = new Map();
      const titleMap = new Map();

      const normalize = (s: string) => s ? String(s).trim().toLowerCase() : '';

      allTyres?.forEach(t => {
          basePriceMap.set(t.id, t.base_price);
          if (t.title) titleMap.set(normalize(t.title), t.base_price);
      });

      let profit = 0;
      
      const parseVal = (v: any) => {
         if(!v) return 0;
         const s = String(v).replace(/\s/g, '').replace(',', '.');
         return parseFloat(s) || 0;
      };

      orders?.forEach((o: any) => { 
          if (o.items && Array.isArray(o.items)) {
              o.items.forEach((i: any) => { 
                  const sellPrice = parseVal(i.price);
                  let basePriceVal = i.base_price; // Check item snapshot first

                  // If snapshot missing, check ID map
                  if (!basePriceVal && i.id) {
                      basePriceVal = basePriceMap.get(i.id);
                  }

                  // If still missing, check Title map (fallback for re-imported items)
                  if (!basePriceVal && i.title) {
                      basePriceVal = titleMap.get(normalize(i.title));
                  }

                  const basePrice = parseVal(basePriceVal);
                  const qty = i.quantity || 1;
                  
                  const margin = sellPrice - basePrice;
                  profit += margin * qty; 
              }); 
          }
      });
      
      setStatsData({ totalOrders: ordersCount || 0, totalTyres: tyresCount || 0, totalBookings: bookingCount || 0, totalRevenue: profit });
    } catch (e) { console.error(e); }
  };

  // --- CLIENTS ---
  const fetchClients = async () => { const { data } = await supabase.from('bookings').select('*').order('booking_date', { ascending: false }); if (data) setClients(data); };
  const uniqueClients = React.useMemo(() => {
     const map = new Map();
     clients.forEach((c) => {
        if (!map.has(c.customer_phone)) map.set(c.customer_phone, { ...c, total_visits: 0 });
        const entry = map.get(c.customer_phone);
        entry.total_visits += 1;
        if (new Date(c.booking_date) > new Date(entry.booking_date)) entry.booking_date = c.booking_date;
     });
     let arr = Array.from(map.values());
     if (clientSearch.trim()) arr = arr.filter(c => c.customer_phone.includes(clientSearch.trim()) || c.customer_name.toLowerCase().includes(clientSearch.toLowerCase()));
     return arr;
  }, [clients, clientSearch]);

  const openClientHistory = (phone: string) => { setSelectedClientHistory(clients.filter(c => c.customer_phone === phone)); setShowHistoryModal(true); };
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const handleEditClientSave = async () => { if(!editingClient) return; const oldPhone = selectedClientHistory[0]?.customer_phone; if (oldPhone) { await supabase.from('bookings').update({ customer_name: editingClient.customer_name, customer_phone: editingClient.customer_phone }).eq('customer_phone', oldPhone); setEditingClient(null); setShowHistoryModal(false); fetchClients(); } };
  const deleteFromHistory = async (id: number) => { const { error } = await supabase.from('bookings').delete().eq('id', id); if (!error) { setClients(prev => prev.filter(c => c.id !== id)); setSelectedClientHistory(prev => prev.filter(c => c.id !== id)); } else showError("Помилка видалення"); };

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

  // --- PRICES & SETTINGS ---
  const fetchPrices = async () => {
    try {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['prices_cars', 'prices_suv', 'prices_additional', 'admin_pin', 'tyre_admin_pin']);
      if (data) data.forEach((r: any) => {
         if (r.key === 'prices_additional') setAdditionalServices(JSON.parse(r.value));
         if (r.key === 'prices_cars') setPriceDataCars(JSON.parse(r.value));
         if (r.key === 'prices_suv') setPriceDataSUV(JSON.parse(r.value));
         if (r.key === 'admin_pin') setAdminPin(r.value);
         if (r.key === 'tyre_admin_pin') setTyrePin(r.value);
      });
    } catch (e) { console.error(e); }
  };

  const applyPriceMarkup = (percent: number) => {
     const factor = 1 + (percent / 100);
     const updateRow = (row: PriceRow): PriceRow => {
        if (row.isSurcharge) return row;
        const r = Math.round(parseFloat(row.removeInstall) * factor);
        const b = Math.round(parseFloat(row.balancing) * factor);
        const m = Math.round(parseFloat(row.mounting) * factor);
        return { ...row, removeInstall: r.toString(), balancing: b.toString(), mounting: m.toString(), total1: (r + b + m).toString(), total4: ((r + b + m) * 4).toString() };
     };
     setPriceDataCars(prev => prev.map(updateRow));
     setPriceDataSUV(prev => prev.map(updateRow));
     showError(`Застосовано націнку ${percent > 0 ? '+' : ''}${percent}%`);
  };

  const saveAllPrices = async () => {
       await supabase.from('settings').upsert({ key: 'prices_additional', value: JSON.stringify(additionalServices) });
       await supabase.from('settings').upsert({ key: 'prices_cars', value: JSON.stringify(priceDataCars) });
       await supabase.from('settings').upsert({ key: 'prices_suv', value: JSON.stringify(priceDataSUV) });
       if (adminPin) await supabase.from('settings').upsert({ key: 'admin_pin', value: adminPin });
       if (tyrePin) await supabase.from('settings').upsert({ key: 'tyre_admin_pin', value: tyrePin });
       showError("Всі налаштування та ціни збережено!");
  };

  const handlePrint = () => window.print();

  // --- TYRE SHOP & STATS ---
  const fetchStockStats = async () => {
     try {
       const { count: total } = await supabase.from('tyres').select('*', { count: 'exact', head: true });
       // Use try/catch specifically for the filter query which might fail if schema is old
       try {
           const { count: inStock } = await supabase.from('tyres').select('*', { count: 'exact', head: true }).neq('in_stock', false);
           const outStock = (total || 0) - (inStock || 0);
           setStockStats({ total: total || 0, inStock: inStock || 0, outStock: outStock || 0 });
       } catch (err) {
           console.warn("Stock filter failed (schema mismatch likely)", err);
           setStockStats({ total: total || 0, inStock: 0, outStock: 0 });
       }
     } catch (e) {
       console.error("Fetch stats failed", e);
     }
  };
  
  // NEW: Fetch Counts per category with proper logic
  const fetchCategoryCounts = async () => {
    try {
        const base = supabase.from('tyres').select('*', { count: 'exact', head: true });
        
        // Wrap complex queries in individual try/catches to prevent one failure (e.g. missing vehicle_type) from blocking UI
        const getAll = base.then(r => r.count).catch(() => 0);
        
        const getCar = supabase.from('tyres').select('*', { count: 'exact', head: true })
                .or('vehicle_type.eq.car,vehicle_type.is.null')
                .neq('vehicle_type', 'cargo')
                .neq('vehicle_type', 'suv')
                .not('radius', 'ilike', '%C%') 
                .then(r => r.count).catch(() => 0);

        const getCargo = supabase.from('tyres').select('*', { count: 'exact', head: true })
                .or('vehicle_type.eq.cargo,radius.ilike.%C%')
                .then(r => r.count).catch(() => 0);

        const getSuv = supabase.from('tyres').select('*', { count: 'exact', head: true })
                .eq('vehicle_type', 'suv')
                .then(r => r.count).catch(() => 0);

        const getHot = supabase.from('tyres').select('*', { count: 'exact', head: true })
                .eq('is_hot', true)
                .then(r => r.count).catch(() => 0);

        const [all, car, cargo, suv, hot] = await Promise.all([getAll, getCar, getCargo, getSuv, getHot]);

        setCategoryCounts({ 
            all: all || 0, 
            car: car || 0, 
            cargo: cargo || 0, 
            suv: suv || 0, 
            hot: hot || 0 
        });
    } catch (e) { console.error("Category counts error", e); }
  };

  const handleResetStock = async () => {
     setConfirmModal({
        isOpen: true,
        title: "Скинути склад",
        message: "Ви впевнені? Це зробить ВСІ товари 'В наявності'.",
        onConfirm: async () => {
             try {
                const { data } = await supabase.from('tyres').select('id').eq('in_stock', false);
                if (data && data.length > 0) {
                   const chunkSize = 50;
                   for (let i = 0; i < data.length; i += chunkSize) {
                      const chunk = data.slice(i, i + chunkSize).map(d => d.id);
                      await supabase.from('tyres').update({ in_stock: true }).in('id', chunk);
                   }
                }
                showError("Всі товари тепер в наявності!");
                fetchStockStats();
                fetchCategoryCounts();
             } catch (e: any) { showError(e.message); }
             closeConfirmModal();
        }
     });
  };

  const handleAutoCategorize = async () => {
    setConfirmModal({
        isOpen: true,
        title: "Авто-сортування",
        message: "Ви впевнені? Це автоматично розсортує ВСІ існуючі товари по папках (Легкові/Вантажні/SUV) на основі їх назви та радіусу. Це може зайняти деякий час.",
        onConfirm: async () => {
            try {
                showError("Завантаження та аналіз бази товарів...");
                
                // 1. Fetch all items (paginate to be safe)
                let allTyres: any[] = [];
                let from = 0;
                const step = 1000;
                
                while(true) {
                    const { data, error } = await supabase.from('tyres').select('id, title, radius, vehicle_type').range(from, from + step - 1);
                    if (error) throw error;
                    if (!data || data.length === 0) break;
                    allTyres.push(...data);
                    if (data.length < step) break;
                    from += step;
                }

                // 2. Analyze
                const toUpdate: any[] = [];
                let carCount = 0;
                let cargoCount = 0;
                let suvCount = 0;
                
                for (const t of allTyres) {
                    const title = (t.title || '').toUpperCase();
                    const radiusStr = (t.radius || '').toUpperCase();
                    
                    let newType = 'car'; // Default

                    // IMPROVED LOGIC
                    // Check for 'C' suffix in the title (e.g. R15C) even if radius column is just "R15"
                    const radiusRegex = /R\d{2}C/i;
                    const hasC_in_Title = radiusRegex.test(title);
                    const hasC_in_Radius = radiusStr.includes('C');
                    
                    const isCargoKeyword = title.includes('CARGO') || title.includes('BUS') || title.includes('LT') || title.includes('TRANS') || title.includes('VAN');

                    const isCargo = hasC_in_Title || hasC_in_Radius || isCargoKeyword;
                    
                    const isSuv = !isCargo && (title.includes('SUV') || title.includes('4X4') || title.includes('JEEP') || title.includes('OFF-ROAD') || title.includes('AWD') || title.includes('CR-V') || title.includes('RAV4') || title.includes('PRADO') || title.includes('LAND CRUISER'));

                    if (isCargo) { newType = 'cargo'; cargoCount++; }
                    else if (isSuv) { newType = 'suv'; suvCount++; }
                    else { carCount++; }

                    // Only update if changed or null
                    if (t.vehicle_type !== newType) {
                        toUpdate.push({ id: t.id, vehicle_type: newType });
                    }
                }

                // 3. Batch Update - FORCE UPDATE via Loop for maximum reliability
                if (toUpdate.length > 0) {
                    const total = toUpdate.length;
                    showError(`Знайдено змін: ${total}. Оновлення...`);
                    
                    // Chunking for UI responsiveness
                    const batchSize = 50;
                    for (let i = 0; i < total; i += batchSize) {
                        const chunk = toUpdate.slice(i, i + batchSize);
                        await Promise.all(chunk.map((item: any) => 
                            supabase.from('tyres').update({ vehicle_type: item.vehicle_type }).eq('id', item.id)
                        ));
                    }
                    showError(`Успішно оновлено ${total} товарів! (Легкові: ${carCount}, Вантажні: ${cargoCount}, SUV: ${suvCount})`);
                } else {
                    showError(`Аналіз завершено. Змін не знайдено. (Легкові: ${carCount}, Вантажні: ${cargoCount}, SUV: ${suvCount})`);
                }

                fetchStockStats();
                fetchCategoryCounts();
                fetchTyres(0, true);

            } catch (e: any) {
                console.error(e);
                showError("Помилка (можливо відсутня колонка vehicle_type в базі): " + e.message);
            }
            closeConfirmModal();
        }
    });
  };

  const fetchTyres = async (pageIdx: number, isRefresh = false) => {
    setLoadingTyres(true);
    try {
       const from = pageIdx * PAGE_SIZE;
       const to = from + PAGE_SIZE - 1;
       let query = supabase.from('tyres').select('*', { count: 'exact' });
       if (tyreSearch.trim().length > 0) query = query.or(`title.ilike.%${tyreSearch.trim()}%,catalog_number.ilike.%${tyreSearch.trim()}%,radius.ilike.%${tyreSearch.trim()}%`);
       
       // STRICT FOLDER LOGIC (Categories)
       if (tyreCategoryTab === 'car') {
           // Improved Logic:
           // 1. Explicit 'car'
           // 2. OR Null (Legacy items)
           // 3. EXCLUDE explicit 'cargo' or 'suv'
           // 4. EXCLUDE if radius contains 'C' (likely cargo)
           query = query.or('vehicle_type.eq.car,vehicle_type.is.null')
                        .neq('vehicle_type', 'cargo')
                        .neq('vehicle_type', 'suv')
                        .not('radius', 'ilike', '%C%');
       } else if (tyreCategoryTab === 'cargo') {
           // CARGO: Include explicit 'cargo' OR (radius has 'C')
           query = query.or('vehicle_type.eq.cargo,radius.ilike.%C%'); 
       } else if (tyreCategoryTab === 'suv') {
           // SUV: Explicitly marked as SUV
           query = query.eq('vehicle_type', 'suv');
       } else if (tyreCategoryTab === 'hot') {
           query = query.eq('is_hot', true);
       }
       // 'all' doesn't apply strict filters, just shows everything

       query = query.order('created_at', { ascending: false });
       
       const { data, error } = await query.range(from, to);
       
       if (error) throw error;

       if (data) {
          if (isRefresh) { setTyres(data); setTyrePage(0); setSelectedTyreIds(new Set()); } 
          else { setTyres(prev => [...prev, ...data]); setTyrePage(pageIdx); }
          setHasMoreTyres(data.length === PAGE_SIZE);
       }
    } catch (e: any) { 
        console.error(e);
        if (isRefresh) setTyres([]); // Clear list on error
        showError("Помилка завантаження: " + e.message);
    } finally { setLoadingTyres(false); }
  };
  
  const handleSaveTyre = async () => {
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const fileItem of tyreUploadFiles) {
         const file = fileItem as File;
         const fileName = `tyre_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
         const { error } = await supabase.storage.from('galery').upload(fileName, file);
         if (!error) { const { data } = supabase.storage.from('galery').getPublicUrl(fileName); newUrls.push(data.publicUrl); }
      }
      const finalGallery = [...existingGallery, ...newUrls];
      const seasonLabel = tyreForm.season === 'winter' ? 'Winter' : tyreForm.season === 'summer' ? 'Summer' : 'All Season';
      
      const cleanPrice = Math.round(parseFloat(tyreForm.price.replace(/[^\d.]/g, '')) || 0).toString();
      const cleanBasePrice = Math.round(parseFloat(tyreForm.base_price.replace(/[^\d.]/g, '')) || 0).toString();

      // IMPORTANT: Use Title as the primary source of truth if editing
      // If title is empty (new item), construct it.
      let finalTitle = tyreForm.title;
      if (!finalTitle || finalTitle.trim() === '') {
          finalTitle = `${tyreForm.manufacturer} ${tyreForm.name} ${tyreForm.radius} ${seasonLabel}`;
      }

      const payload: any = {
        title: finalTitle,
        description: tyreForm.description || `Сезон: ${seasonLabel}.`,
        price: cleanPrice, 
        base_price: cleanBasePrice, 
        manufacturer: tyreForm.manufacturer, 
        catalog_number: tyreForm.catalog_number, 
        radius: tyreForm.radius, 
        season: tyreForm.season,
        vehicle_type: tyreForm.vehicle_type, // SAVE VEHICLE TYPE
        image_url: finalGallery[0], 
        gallery: finalGallery, 
        is_hot: tyreForm.is_hot 
      };
      
      try {
          if (editingTyreId) await supabase.from('tyres').update(payload).eq('id', editingTyreId).throwOnError();
          else await supabase.from('tyres').insert([payload]).throwOnError();
      } catch (dbError: any) {
          // Fallback logic: Catch missing column errors (PGRST102/204 or 400 Bad Request)
          if (dbError.code === '400' || dbError.code === 'PGRST102' || dbError.code === 'PGRST204' || dbError.message?.includes('column')) {
              console.warn("Retrying save without 'season' and 'vehicle_type' (Columns likely missing)");
              
              const fallbackPayload = { ...payload };
              delete fallbackPayload.vehicle_type; 
              delete fallbackPayload.season;
              
              if (editingTyreId) await supabase.from('tyres').update(fallbackPayload).eq('id', editingTyreId);
              else await supabase.from('tyres').insert([fallbackPayload]);
              
              showError("УВАГА: Товар збережено, АЛЕ Категорія та Сезон не оновились. Запустіть SQL-скрипт оновлення бази!");
          } else {
              throw dbError;
          }
      }
      
      fetchTyres(0, true); 
      fetchStockStats(); 
      fetchCategoryCounts();
      setShowAddTyreModal(false);
    } catch (err: any) { 
        console.error(err);
        showError(err.message); 
    } finally { setUploading(false); }
  };

  const toggleHotStatus = async (id: number, current: boolean) => {
     const { error } = await supabase.from('tyres').update({ is_hot: !current }).eq('id', id);
     if (!error) {
        setTyres(prev => prev.map(t => t.id === id ? { ...t, is_hot: !current } : t));
        fetchCategoryCounts(); // update hot count
     } else {
        showError("Помилка оновлення статусу HOT");
     }
  };

  // --- SMART UPLOAD with REPORT & FUZZY MATCHING ---
  const handleSmartImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    setUploadReport([]);
    setShowUploadReport(true);
    
    try {
       const { data: allTyres } = await supabase.from('tyres').select('id, title, catalog_number, image_url, gallery');
       if (!allTyres) throw new Error("Не вдалося отримати список шин");

       const files = Array.from(e.target.files);
       const report: UploadReportItem[] = [];
       const tyreMap = new Map();
       
       const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

       allTyres.forEach(t => {
           if (t.catalog_number) {
               tyreMap.set(normalize(t.catalog_number), t);
           }
       });

       const BATCH_SIZE = 3; 
       for (let i = 0; i < files.length; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (file: File) => {
             const previewUrl = URL.createObjectURL(file);
             const nameWithoutExt = file.name.split('.').slice(0, -1).join('.');
             const normalizedName = normalize(nameWithoutExt);
             const match = tyreMap.get(normalizedName);
             if (match) {
                try {
                    const fileName = `smart_${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name.replace(/\s/g, '')}`;
                    const { error } = await supabase.storage.from('galery').upload(fileName, file);
                    if (!error) {
                       const { data: urlData } = supabase.storage.from('galery').getPublicUrl(fileName);
                       const newUrl = urlData.publicUrl;
                       const currentGallery = match.gallery || [];
                       const updates: any = { gallery: [...currentGallery, newUrl] };
                       if (!match.image_url) updates.image_url = newUrl; 
                       await supabase.from('tyres').update(updates).eq('id', match.id);
                       report.push({ fileName: file.name, status: 'success', message: 'Завантажено', productName: match.title, previewUrl });
                    } else {
                       report.push({ fileName: file.name, status: 'error', message: 'Помилка завантаження', previewUrl });
                    }
                } catch (e: any) {
                    report.push({ fileName: file.name, status: 'error', message: e.message, previewUrl });
                }
             } else {
                report.push({ fileName: file.name, status: 'skipped', message: `Товар не знайдено (код: ${nameWithoutExt})`, previewUrl });
             }
          }));
          setUploadReport([...report]);
       }
       fetchTyres(0, true);
    } catch (err: any) {
       showError(err.message);
    } finally {
       setUploading(false);
       if(smartUploadInputRef.current) smartUploadInputRef.current.value = '';
    }
  };

  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     setExcelFile(file);
     setShowExcelModal(true);
     setExcelPreview([]);
     setImportStatus(''); // Reset status
     
     try {
        const rows = await readXlsxFile(file);
        setExcelPreview(rows.slice(0, 20)); // Preview first 20 rows
     } catch (e) {
        console.error("Error reading excel for preview", e);
        showError("Помилка читання файлу для попереднього перегляду");
     }
  };

  const processExcelImport = async () => {
    if (!excelFile) {
        showError("Файл не вибрано!");
        return;
    }
    setImportingExcel(true);
    setImportStatus("Зчитування та обробка файлу...");

    try {
        const rows = await readXlsxFile(excelFile);
        if (!rows || rows.length < excelStartRow) {
            throw new Error("Файл порожній або некоректний формат.");
        }

        setImportStatus("Завантаження поточної бази (для порівняння)...");
        let allDbTyres: any[] = [];
        let from = 0;
        let step = 1000;
        while(true) {
            const { data, error } = await supabase.from('tyres').select('id, catalog_number, price, base_price').range(from, from + step - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allDbTyres = [...allDbTyres, ...data];
            if (data.length < step) break;
            from += step;
        }

        const dbMap = new Map();
        const normalize = (val: any) => String(val).trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        allDbTyres.forEach(t => {
            if(t.catalog_number) dbMap.set(normalize(t.catalog_number), t);
        });

        setImportStatus("Аналіз даних...");
        const toInsert: any[] = [];
        const toUpdate: any[] = [];
        const seenIds = new Set<number>();
        const processedCats = new Set<string>(); // To handle duplicates within the file

        for (let i = excelStartRow - 1; i < rows.length; i++) {
            const row = rows[i];
            const getValue = (colIndex: number) => {
               const val = row[colIndex];
               return val !== null && val !== undefined ? String(val).trim() : '';
            };
            
            const catNum = getValue(columnMapping.catalog_number);
            if (!catNum) continue;

            const normalizedCat = normalize(catNum);
            
            // Skip if we've already processed this catalog number in this file (prevent duplicate inserts/updates)
            if (processedCats.has(normalizedCat)) continue;
            processedCats.add(normalizedCat);
            
            const manufacturer = getValue(columnMapping.manufacturer);
            const titleRaw = getValue(columnMapping.title);
            
            const rawBasePrice = getValue(columnMapping.base_price).replace(/,/g, '.').replace(/[^\d.]/g, '');
            const rawRetailPrice = getValue(columnMapping.price).replace(/,/g, '.').replace(/[^\d.]/g, '');
            
            const basePrice = rawBasePrice ? Math.round(parseFloat(rawBasePrice)).toString() : '0';
            const retailPrice = rawRetailPrice ? Math.round(parseFloat(rawRetailPrice)).toString() : '0';

            // Logic for season/type
            let season = 'all-season';
            const lowerTitle = titleRaw.toLowerCase();
            if (lowerTitle.includes('winter') || lowerTitle.includes('зима') || lowerTitle.includes('ice')) season = 'winter';
            else if (lowerTitle.includes('summer') || lowerTitle.includes('літо')) season = 'summer';
            
            let radius = 'R15'; let isCargo = false;
            const radMatch = titleRaw.match(/R\d{2}[C]?/i);
            if (radMatch) { radius = radMatch[0].toUpperCase(); if (radius.includes('C')) isCargo = true; }

            // Auto-detect vehicle type
            let vehicleType: 'car' | 'cargo' | 'suv' = 'car';
            if (isCargo) {
                vehicleType = 'cargo';
            } else if (lowerTitle.includes('suv') || lowerTitle.includes('jeep') || lowerTitle.includes('4x4')) {
                vehicleType = 'suv';
            }

            const newItem = { 
                catalog_number: catNum, 
                manufacturer: manufacturer, 
                title: manufacturer ? `${manufacturer} ${titleRaw}` : titleRaw, 
                description: `Сезон: ${season}. ${isCargo ? 'Вантажні.' : ''}`, 
                radius: radius, 
                price: retailPrice, 
                base_price: basePrice, 
                in_stock: true,
                vehicle_type: vehicleType 
            };

            const existing = dbMap.get(normalizedCat);

            if (existing) {
                seenIds.add(existing.id);
                toUpdate.push({ ...newItem, id: existing.id });
            } else {
                toInsert.push(newItem);
            }
        }

        const batchSize = 50;

        // INSERTS
        if (toInsert.length > 0) {
            for (let i = 0; i < toInsert.length; i += batchSize) {
                setImportStatus(`Додавання нових товарів: ${Math.min(i + batchSize, toInsert.length)} з ${toInsert.length}`);
                const chunk = toInsert.slice(i, i + batchSize);
                const { error } = await supabase.from('tyres').insert(chunk);
                if (error) {
                    console.error("Insert error chunk", error);
                    showError(`Помилка додавання: ${error.message}`);
                }
            }
        }

        // UPDATES
        if (toUpdate.length > 0) {
            let processedUpdates = 0;
            for (let i = 0; i < toUpdate.length; i += batchSize) {
                setImportStatus(`Оновлення цін та наявності: ${Math.min(i + batchSize, toUpdate.length)} з ${toUpdate.length}`);
                const chunk = toUpdate.slice(i, i + batchSize);
                
                // Using Promise.all for parallel updates is safer than bulk upsert if upsert is causing [object Object] errors due to constraints
                const results = await Promise.all(chunk.map((item: any) => 
                    supabase.from('tyres').update(item).eq('id', item.id)
                ));
                
                // Check for errors in results
                const err = results.find(r => r.error);
                if (err && err.error) {
                     console.error("Update error", err.error);
                     showError(`Помилка оновлення: ${err.error.message}`);
                }
            }
        }

        // DELETE MISSING
        if (markMissingOutOfStock) {
           const idsToDelete = allDbTyres.filter(t => !seenIds.has(t.id)).map(t => t.id);
           if (idsToDelete.length > 0) {
               setImportStatus(`Видалення відсутніх товарів: ${idsToDelete.length}...`);
               for (let i = 0; i < idsToDelete.length; i += batchSize) {
                   const chunk = idsToDelete.slice(i, i + batchSize);
                   const { error } = await supabase.from('tyres').delete().in('id', chunk);
                   if (error) showError(`Помилка видалення: ${error.message}`);
               }
           }
        }

        showError(`Операцію завершено! Додано: ${toInsert.length}, Оновлено: ${toUpdate.length}`); 
        setShowExcelModal(false); 
        fetchTyres(0, true); 
        fetchStockStats();
        fetchCategoryCounts();
    } catch (err: any) { 
        console.error(err);
        showError("Помилка імпорту: " + err.message); 
    } finally { 
        setImportingExcel(false); 
        setImportStatus('');
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const applyBulkMarkup = async () => { /* Kept same logic */
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
  
  // NEW: Bulk Category Change
  const applyBulkCategory = async () => {
    if (!bulkCategory || selectedTyreIds.size === 0) return;
    
    setConfirmModal({
        isOpen: true,
        title: "Масова зміна категорії",
        message: `Перенести ${selectedTyreIds.size} товарів у категорію "${bulkCategory.toUpperCase()}"?`,
        onConfirm: async () => {
             setIsApplyingBulk(true);
             try {
                 const ids = Array.from(selectedTyreIds);
                 const { error } = await supabase.from('tyres').update({ vehicle_type: bulkCategory }).in('id', ids);
                 
                 if (error) throw error;
                 
                 showError(`Успішно оновлено категорію для ${ids.length} товарів!`);
                 fetchTyres(0, true);
                 fetchCategoryCounts();
                 fetchStockStats();
                 setSelectedTyreIds(new Set());
                 setBulkCategory('');
             } catch (err: any) {
                 showError("Помилка масового оновлення: " + err.message);
             } finally {
                 setIsApplyingBulk(false);
             }
             closeConfirmModal();
        }
    });
  };

  const TablePriceEditor = ({ data, category }: { data: PriceRow[], category: 'cars' | 'suv' }) => (
     <div className="overflow-x-auto bg-black border border-zinc-700 rounded-lg p-2 mb-8"><table className="w-full text-xs md:text-sm text-left"><thead className="text-zinc-500 uppercase font-bold"><tr><th className="p-2">R</th><th className="p-2">Зняття/Вст</th><th className="p-2">Баланс</th><th className="p-2">Монтаж</th><th className="p-2 text-[#FFC300]">Сума (1)</th><th className="p-2 text-[#FFC300]">Сума (4)</th></tr></thead><tbody className="divide-y divide-zinc-800">{data.map((row, idx) => (<tr key={idx}><td className="p-2 text-[#FFC300] font-bold w-16">{row.radius}</td>{['removeInstall','balancing','mounting','total1','total4'].map(f => (<td key={f} className="p-2"><input value={(row as any)[f]} onChange={e => { const n = category === 'cars' ? [...priceDataCars] : [...priceDataSUV]; (n as any)[idx][f] = e.target.value; if (!row.isSurcharge) { const r = parseFloat(n[idx].removeInstall) || 0; const b = parseFloat(n[idx].balancing) || 0; const m = parseFloat(n[idx].mounting) || 0; n[idx].total1 = (r+b+m).toString(); n[idx].total4 = ((r+b+m)*4).toString(); } category === 'cars' ? setPriceDataCars(n) : setPriceDataSUV(n); }} className="w-16 bg-zinc-900 border border-zinc-700 rounded p-1 text-white text-center"/></td>))}</tr>))}</tbody></table></div>
  );
  
  const fetchTyreOrders = async () => { const { data } = await supabase.from('tyre_orders').select('*').order('created_at', { ascending: false }); if(data) setTyreOrders(data); };
  const formatDisplayDate = (dateStr: string) => { if (!dateStr) return ''; const today = getKyivDateString(); const tomorrow = getKyivDateString(new Date(new Date().setDate(new Date().getDate() + 1))); if (dateStr === today) return `Сьогодні (${dateStr})`; if (dateStr === tomorrow) return `Завтра (${dateStr})`; return dateStr; }
  const timeOptions = generateTimeOptions();

  const maxPreviewCols = excelPreview.length > 0 ? Math.max(...excelPreview.map(r => r.length)) : 0;

  const renderCategoryName = () => {
      switch(tyreCategoryTab) {
          case 'car': return `Легкові Шини (${categoryCounts.car})`;
          case 'cargo': return `Вантажні (C) (${categoryCounts.cargo})`;
          case 'suv': return `Позашляховики (${categoryCounts.suv})`;
          case 'hot': return `HOT Знижки (${categoryCounts.hot})`;
          default: return `Всі Товари (${categoryCounts.all})`;
      }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      
      {/* HIDDEN PRINT AREA */}
      <style>{`@media print { body * { visibility: hidden; } #print-area, #print-area * { visibility: visible; } #print-area { position: absolute; left: 0; top: 0; width: 100%; color: black; background: white; z-index: 9999; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; } th, td { border: 1px solid #000; padding: 5px; text-align: center; } th { background: #eee; font-weight: bold; } h2 { text-align: center; margin-bottom: 20px; text-transform: uppercase; font-size: 18px; } h3 { font-size: 14px; margin-top: 15px; margin-bottom: 5px; font-weight: bold; text-transform: uppercase; } }`}</style>
      <div id="print-area" className="hidden"><h2>Прайс-лист Послуг Шиномонтажу</h2><h3>Легкові Авто</h3><table><thead><tr><th>Радіус</th><th>Зняття/Вст</th><th>Баланс</th><th>Монтаж</th><th>Сума (1)</th><th>Сума (4)</th></tr></thead><tbody>{priceDataCars.map((r, i) => (<tr key={i}><td>R{r.radius}</td><td>{r.removeInstall}</td><td>{r.balancing}</td><td>{r.mounting}</td><td>{r.total1}</td><td>{r.total4}</td></tr>))}</tbody></table><h3>Кросовери / Буси</h3><table><thead><tr><th>Радіус</th><th>Зняття/Вст</th><th>Баланс</th><th>Монтаж</th><th>Сума (1)</th><th>Сума (4)</th></tr></thead><tbody>{priceDataSUV.map((r, i) => (<tr key={i}><td>R{r.radius}</td><td>{r.removeInstall}</td><td>{r.balancing}</td><td>{r.mounting}</td><td>{r.total1}</td><td>{r.total4}</td></tr>))}</tbody></table><h3>Додаткові послуги</h3><table><thead><tr><th>Послуга</th><th>Ціна</th></tr></thead><tbody>{additionalServices.map((s, i) => (<tr key={i}><td style={{textAlign: 'left'}}>{s.name}</td><td>{s.price}</td></tr>))}</tbody></table></div>

      {errorMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-red-900/90 text-white px-6 py-3 rounded-full border border-red-500 animate-in fade-in slide-in-from-top-4 font-bold">{errorMessage}</div>}

      <header className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-50 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
           <h1 className="text-xl font-bold uppercase flex items-center gap-2"><Lock className="text-[#FFC300]"/> Admin Panel <span className="text-xs text-zinc-500 bg-black px-2 py-0.5 rounded">{mode === 'service' ? 'Сервіс (1234)' : 'Магазин (1994)'}</span></h1>
           <div className="flex bg-black rounded-lg p-1 overflow-x-auto">
              {mode === 'service' && ['schedule', 'clients', 'prices', 'gallery', 'settings'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded font-bold text-sm uppercase ${activeTab === t ? 'bg-[#FFC300] text-black' : 'text-zinc-400'}`}>{t === 'schedule' ? 'Розклад' : t === 'clients' ? 'Клієнти' : t === 'prices' ? 'Прайс' : t === 'settings' ? 'Налашт.' : 'Галерея'}</button>
              ))}
              {mode === 'tyre' && ['tyres', 'orders', 'stats', 'settings'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded font-bold text-sm uppercase ${activeTab === t ? 'bg-[#FFC300] text-black' : 'text-zinc-400'}`}>{t === 'tyres' ? 'Шини' : t === 'orders' ? 'Замовлення' : t === 'settings' ? 'Налашт.' : 'Стат.'}</button>
              ))}
              <button onClick={onLogout} className="px-4 py-2 text-zinc-500 hover:text-white ml-2">Вихід</button>
           </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 print:hidden">
         {/* --- SCHEDULE --- */}
         {activeTab === 'schedule' && (
           <div className="animate-in fade-in">
             <div className="flex items-center gap-2 mb-4 bg-blue-900/20 p-3 rounded-lg border border-blue-900/50"><Clock className="text-blue-400" size={20} /><span className="text-blue-200 font-bold">Час за Києвом: {getKyivTimeString()}</span>{new Date().getHours() >= 20 && <span className="text-orange-400 font-bold ml-2">(Вечірній режим: показано наступні дні)</span>}</div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[80vh]"><div className="bg-black p-4 border-b border-zinc-800 flex justify-between items-center sticky top-0 z-20"><div><h3 className="text-xl font-black text-white uppercase italic">{formatDisplayDate(displayDate1)}</h3></div><div className="flex gap-2"><button onClick={() => openAddModal(displayDate1)} className="bg-[#FFC300] text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#e6b000] flex items-center gap-1"><Plus size={14}/> Записати вручну</button><div className="bg-zinc-800 px-3 py-1 rounded-full text-xs font-bold text-zinc-400 flex items-center">{bookingsCol1.length} записів</div></div></div><div className="p-4 overflow-y-auto flex-grow bg-black/20 scrollbar-thin scrollbar-thumb-zinc-700">{getDayTimeline(displayDate1, bookingsCol1)}</div></div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[80vh]"><div className="bg-black p-4 border-b border-zinc-800 flex justify-between items-center sticky top-0 z-20"><div><h3 className="text-xl font-black text-zinc-300 uppercase italic">{formatDisplayDate(displayDate2)}</h3></div><div className="flex gap-2"><button onClick={() => openAddModal(displayDate2)} className="bg-[#FFC300] text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#e6b000] flex items-center gap-1"><Plus size={14}/> Записати вручну</button><div className="bg-zinc-800 px-3 py-1 rounded-full text-xs font-bold text-zinc-400 flex items-center">{bookingsCol2.length} записів</div></div></div><div className="p-4 overflow-y-auto flex-grow bg-black/20 scrollbar-thin scrollbar-thumb-zinc-700">{getDayTimeline(displayDate2, bookingsCol2)}</div></div>
             </div>
           </div>
         )}

         {activeTab === 'clients' && (
            <div className="animate-in fade-in">
               <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-2"><Users className="text-[#FFC300]"/> База Клієнтів</h3>
               <div className="mb-4 relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input type="text" placeholder="Пошук за номером телефону..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-[#FFC300] text-white"/></div>
               <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl"><table className="w-full text-left text-sm"><thead className="bg-black text-zinc-500 uppercase font-bold text-xs"><tr><th className="p-4">Ім'я</th><th className="p-4">Телефон</th><th className="p-4">Візитів</th><th className="p-4 text-right">Останній візит</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-zinc-800">{uniqueClients.map((c, idx) => (<tr key={idx} className="hover:bg-zinc-800/50 cursor-pointer group" onClick={() => openClientHistory(c.customer_phone)}><td className="p-4 font-bold text-white text-lg">{c.customer_name}</td><td className="p-4 font-mono text-[#FFC300] font-bold">{c.customer_phone}</td><td className="p-4 text-zinc-400 font-bold">{c.total_visits}</td><td className="p-4 text-right text-zinc-400">{c.booking_date}</td><td className="p-4 text-right"><History className="inline text-zinc-600 group-hover:text-[#FFC300]" size={18} /></td></tr>))}</tbody></table></div>
            </div>
         )}
         
         {activeTab === 'gallery' && (
            <div className="animate-in fade-in">
               <div className="mb-6 flex justify-between items-center"><h3 className="text-xl font-bold">Галерея</h3><div className="relative"><button onClick={() => galleryInputRef.current?.click()} className="bg-[#FFC300] text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#e6b000]">{uploading ? <Loader2 className="animate-spin" /> : <Upload size={18}/>} Завантажити</button><input type="file" ref={galleryInputRef} onChange={handleGalleryUpload} className="hidden" accept="image/*" /></div></div>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{galleryImages.map(img => (<div key={img.id} className="relative group rounded-xl overflow-hidden aspect-square border border-zinc-800"><img src={img.url} className="w-full h-full object-cover" /><button onClick={() => deleteGalleryImage(img.id, img.url)} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100"><Trash2 size={20}/></button></div>))}</div>
            </div>
         )}

         {/* SETTINGS TAB */}
         {activeTab === 'settings' && (
            <div className="animate-in fade-in max-w-2xl mx-auto space-y-8">
               <h3 className="text-2xl font-black text-white flex items-center gap-2 mb-6"><Settings className="text-[#FFC300]"/> Глобальні Налаштування</h3>
               
               {/* PIN MANAGEMENT - HIGHLIGHTED */}
               <div className="bg-red-900/10 p-6 rounded-2xl border border-red-900/50 relative shadow-2xl">
                  <div className="absolute top-4 right-4 text-red-500 opacity-20"><KeyRound size={64}/></div>
                  <h4 className="text-red-400 text-lg font-black uppercase mb-4 flex items-center gap-2"><KeyRound size={24}/> Зміна Паролів (PIN)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                     <div>
                        <label className="block text-sm text-zinc-300 font-bold mb-2">PIN Сервіс (Розклад)</label>
                        <input type="text" value={adminPin} onChange={e => setAdminPin(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white font-mono font-bold text-xl focus:border-[#FFC300] outline-none text-center" placeholder="1234" />
                     </div>
                     <div>
                        <label className="block text-sm text-zinc-300 font-bold mb-2">PIN Магазин (Шини)</label>
                        <input type="text" value={tyrePin} onChange={e => setTyrePin(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white font-mono font-bold text-xl focus:border-[#FFC300] outline-none text-center" placeholder="1994" />
                     </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                     <button onClick={saveAllPrices} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2">
                        <Save size={20} /> Зберегти нові паролі
                     </button>
                  </div>
               </div>

               <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                  <h4 className="text-white text-lg font-bold mb-4">Інші дії</h4>
                  <div className="flex flex-col md:flex-row gap-4 flex-wrap">
                     <button onClick={handleResetStock} className="flex-1 bg-blue-900/30 text-blue-200 px-6 py-3 rounded-xl font-bold border border-blue-900/50 hover:bg-blue-900/50 flex items-center justify-center gap-2 min-w-[200px]"><RotateCcw size={20}/> Скинути склад (Всі в наявності)</button>
                     <button onClick={handleAutoCategorize} className="flex-1 bg-orange-900/30 text-orange-200 px-6 py-3 rounded-xl font-bold border border-orange-900/50 hover:bg-orange-900/50 flex items-center justify-center gap-2 min-w-[200px]"><Sparkles size={20}/> Авто-сортування категорій</button>
                     <button onClick={handlePrint} className="flex-1 bg-zinc-800 text-white px-6 py-3 rounded-xl font-bold border border-zinc-700 hover:bg-zinc-700 flex items-center justify-center gap-2 min-w-[200px]"><Printer size={20}/> Друк Прайс-листа</button>
                     <button onClick={saveAllPrices} className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-500 flex items-center justify-center gap-2 shadow-lg min-w-[200px]"><Save size={20}/> Зберегти все</button>
                  </div>
               </div>
            </div>
         )}

         {activeTab === 'prices' && (
            <div className="animate-in fade-in space-y-8">
               <div className="flex justify-between items-center mb-4"><h3 className="text-2xl font-black text-white flex items-center gap-2">Редагування цін</h3><button onClick={saveAllPrices} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-500 flex items-center gap-2 shadow-lg"><Save size={20}/> Зберегти</button></div>
               <div className="flex flex-wrap items-center gap-2 bg-black/50 p-3 rounded-lg border border-zinc-800 mb-4"><span className="text-zinc-400 text-xs font-bold uppercase mr-2 flex items-center gap-1"><Percent size={14}/> Швидка націнка:</span>{[2.5, 5, 10].map(p => (<React.Fragment key={p}><button onClick={() => applyPriceMarkup(p)} className="px-3 py-1 bg-zinc-800 hover:bg-[#FFC300] hover:text-black rounded text-xs font-bold transition-colors">+{p}%</button><button onClick={() => applyPriceMarkup(-p)} className="px-3 py-1 bg-zinc-800 hover:bg-red-500 hover:text-white rounded text-xs font-bold transition-colors">-{p}%</button></React.Fragment>))}</div>
               <div><h4 className="text-lg font-bold text-white mb-4">Легкові</h4><TablePriceEditor data={priceDataCars} category="cars" /></div>
               <div><h4 className="text-lg font-bold text-white mb-4">Кросовери</h4><TablePriceEditor data={priceDataSUV} category="suv" /></div>
               <div><h4 className="text-lg font-bold text-white mb-4">Додаткові</h4><div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{additionalServices.map((service, idx) => (<div key={idx} className="flex gap-2"><input value={service.name} onChange={e => {const n=[...additionalServices]; n[idx].name=e.target.value; setAdditionalServices(n);}} className="bg-black border border-zinc-700 rounded p-2 text-white flex-grow"/><input value={service.price} onChange={e => {const n=[...additionalServices]; n[idx].price=e.target.value; setAdditionalServices(n);}} className="bg-black border border-zinc-700 rounded p-2 text-[#FFC300] w-24 font-bold text-center"/></div>))}</div></div></div>
            </div>
         )}

         {/* STATS, ORDERS, TYRES */}
         {activeTab === 'stats' && <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in"><div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Всього замовлень</h3><p className="text-4xl font-black text-white">{statsData.totalOrders}</p></div><div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Шини</h3><p className="text-4xl font-black text-[#FFC300]">{statsData.totalTyres}</p></div><div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Записів</h3><p className="text-4xl font-black text-white">{statsData.totalBookings}</p></div><div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 relative overflow-hidden"><h3 className="text-zinc-400 text-xs font-bold uppercase">Чистий дохід (Прибуток)</h3><p className="text-3xl font-black text-green-400">{statsData.totalRevenue.toLocaleString()} грн</p><DollarSign className="absolute -bottom-4 -right-4 text-green-900/20 w-32 h-32" /></div></div>}
         {activeTab === 'orders' && <div className="space-y-4 animate-in fade-in">{tyreOrders.map((order) => (<div key={order.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col gap-4"><div className="flex justify-between items-start"><div><h3 className="font-bold text-white text-lg">{order.customer_name}</h3><div className="text-[#FFC300] font-bold flex items-center gap-2"><Phone size={14}/> {order.customer_phone}</div></div><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${order.status === 'new' ? 'bg-green-600 text-white' : 'bg-zinc-700'}`}>{order.status}</span></div>{order.items && <div className="space-y-2">{order.items.map((item: any, idx: number) => (<div key={idx} className="flex justify-between items-center text-sm border-b border-zinc-800 pb-2"><span className="text-zinc-300">{item.title}</span><div className="flex gap-4"><span className="font-bold">{item.quantity} шт</span><span className="text-[#FFC300] font-mono">{item.price} грн</span></div></div>))}</div>}</div>))}</div>}
         {activeTab === 'tyres' && (
            <div className="animate-in fade-in">
               
               {/* Controls Bar */}
               <div className="flex flex-col md:flex-row gap-4 justify-between mb-6">
                  
                  {/* HAMBURGER MENU FOR CATEGORIES */}
                  <div className="relative">
                     <button 
                        onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                        className="bg-zinc-800 text-white font-bold px-4 py-3 rounded-lg flex items-center gap-2 border border-zinc-700 hover:bg-zinc-700 transition-colors"
                     >
                        <Menu size={20} className="text-[#FFC300]"/>
                        <span className="uppercase tracking-wide text-sm">{renderCategoryName()}</span>
                     </button>
                     
                     {showCategoryMenu && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                           <div className="p-2 bg-black/50 border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase px-4 py-2">Категорії (Папки)</div>
                           <button onClick={() => { setTyreCategoryTab('all'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 transition-colors border-b border-zinc-800/50">
                              <FolderOpen size={18} className="text-zinc-400"/> Всі Товари <span className="ml-auto bg-zinc-800 text-xs px-2 py-0.5 rounded-full text-zinc-400">{categoryCounts.all}</span>
                           </button>
                           <button onClick={() => { setTyreCategoryTab('car'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 transition-colors border-b border-zinc-800/50">
                              <Car size={18} className="text-blue-400"/> Легкові <span className="ml-auto bg-blue-900/50 text-xs px-2 py-0.5 rounded-full text-blue-200">{categoryCounts.car}</span>
                           </button>
                           <button onClick={() => { setTyreCategoryTab('cargo'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 transition-colors border-b border-zinc-800/50">
                              <Truck size={18} className="text-purple-400"/> Вантажні (C) <span className="ml-auto bg-purple-900/50 text-xs px-2 py-0.5 rounded-full text-purple-200">{categoryCounts.cargo}</span>
                           </button>
                           <button onClick={() => { setTyreCategoryTab('suv'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 transition-colors border-b border-zinc-800/50">
                              <Mountain size={18} className="text-green-400"/> Позашляховики <span className="ml-auto bg-green-900/50 text-xs px-2 py-0.5 rounded-full text-green-200">{categoryCounts.suv}</span>
                           </button>
                           <button onClick={() => { setTyreCategoryTab('hot'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 transition-colors">
                              <Flame size={18} className="text-orange-500"/> HOT Знижки <span className="ml-auto bg-orange-900/50 text-xs px-2 py-0.5 rounded-full text-orange-200">{categoryCounts.hot}</span>
                           </button>
                        </div>
                     )}
                  </div>

                  <div className="relative flex-grow max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/><input type="text" placeholder="Пошук шин..." value={tyreSearch} onChange={e => setTyreSearch(e.target.value)} onKeyDown={e => e.key==='Enter' && fetchTyres(0,true)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 outline-none focus:border-[#FFC300] text-lg font-bold" /></div>
                  <div className="flex gap-2 flex-wrap">
                     <button onClick={() => smartUploadInputRef.current?.click()} className="bg-blue-900 text-blue-200 font-bold px-3 py-2 rounded-lg flex items-center gap-2 border border-blue-800 hover:bg-blue-800 text-xs md:text-sm whitespace-nowrap"><Wand2 size={16}/> Розумне фото</button><input type="file" ref={smartUploadInputRef} onChange={handleSmartImageUpload} className="hidden" multiple accept="image/*" />
                     <button onClick={() => fileInputRef.current?.click()} className="bg-zinc-800 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 border border-zinc-700 hover:bg-zinc-700"><FileSpreadsheet size={18}/></button><input type="file" ref={fileInputRef} onChange={handleExcelFileSelect} className="hidden" accept=".xlsx" />
                     <button onClick={() => {setEditingTyreId(null); setTyreForm({ title: '', manufacturer: '', name: '', radius: 'R15', season: 'winter', vehicle_type: 'car', price: '', base_price: '', catalog_number: '', description: '', is_hot: false }); setExistingGallery([]); setTyreUploadFiles([]); setShowAddTyreModal(true);}} className="bg-[#FFC300] text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#e6b000]"><Plus size={18}/> Додати</button>
                  </div>
               </div>
               
               {/* BULK ACTIONS BAR */}
               {selectedTyreIds.size > 0 && (
                  <div className="bg-white/10 p-3 rounded-xl flex flex-col md:flex-row items-center justify-between mb-4 gap-4 border border-zinc-700">
                     <div className="font-bold flex items-center gap-2 text-white"><CheckSquare size={18} className="text-[#FFC300]"/> Обрано: {selectedTyreIds.size}</div>
                     
                     <div className="flex flex-wrap items-center gap-4">
                        {/* Bulk Price */}
                        <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-lg border border-zinc-700">
                           <span className="text-xs font-bold text-zinc-400 pl-2">Націнка:</span>
                           <input type="text" value={bulkMarkup} onChange={e => setBulkMarkup(e.target.value)} placeholder="%" className="w-12 p-1 rounded bg-zinc-800 text-white text-center font-bold outline-none border border-zinc-600 focus:border-[#FFC300]" />
                           <button onClick={applyBulkMarkup} disabled={isApplyingBulk || !bulkMarkup} className="bg-[#FFC300] text-black px-3 py-1 rounded font-bold text-sm disabled:opacity-50 hover:bg-[#e6b000]">OK</button>
                        </div>

                        {/* Bulk Category */}
                        <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-lg border border-zinc-700">
                           <span className="text-xs font-bold text-zinc-400 pl-2 flex items-center gap-1"><Layers size={14}/> Категорія:</span>
                           <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value as any)} className="bg-zinc-800 text-white text-sm p-1 rounded outline-none border border-zinc-600 focus:border-[#FFC300] cursor-pointer w-32">
                              <option value="">Оберіть...</option>
                              <option value="car">Легкові</option>
                              <option value="suv">SUV / 4x4</option>
                              <option value="cargo">Вантажні</option>
                           </select>
                           <button onClick={applyBulkCategory} disabled={isApplyingBulk || !bulkCategory} className="bg-blue-600 text-white px-3 py-1 rounded font-bold text-sm disabled:opacity-50 hover:bg-blue-500">OK</button>
                        </div>
                     </div>
                  </div>
               )}
               
               <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto min-h-[500px] shadow-2xl">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-black text-zinc-500 uppercase font-bold text-xs sticky top-0 z-10 shadow-lg">
                        <tr>
                           <th className="p-4 w-10"><button onClick={() => setSelectedTyreIds(selectedTyreIds.size===tyres.length ? new Set() : new Set(tyres.map(t=>t.id)))}>{selectedTyreIds.size===tyres.length ? <CheckSquare size={16}/> : <Square size={16}/>}</button></th>
                           <th className="p-4 w-24">Фото</th>
                           <th className="p-4">Товар (Інфо)</th>
                           <th className="p-4 text-center">Радіус</th>
                           <th className="p-4 text-right">Ціна</th>
                           <th className="p-4 text-right w-24">Дії</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-zinc-800">
                        {tyres.map(t => (
                           <tr key={t.id} className={`group hover:bg-zinc-900 transition-colors ${selectedTyreIds.has(t.id) ? 'bg-[#FFC300]/5' : ''}`}>
                              {/* CHECKBOX */}
                              <td className="p-4 align-middle">
                                 <button onClick={() => {const n=new Set(selectedTyreIds); if(n.has(t.id))n.delete(t.id); else n.add(t.id); setSelectedTyreIds(n);}} className="text-zinc-600 hover:text-white transition-colors">
                                    {selectedTyreIds.has(t.id) ? <CheckSquare size={18} className="text-[#FFC300]"/> : <Square size={18}/>}
                                 </button>
                              </td>
                              
                              {/* COMPACT IMAGE */}
                              <td className="p-2 align-middle">
                                 <div className="w-16 h-16 bg-black rounded-lg relative group/img cursor-pointer border border-zinc-800 overflow-hidden">
                                    {t.image_url ? (
                                       <img 
                                          src={t.image_url} 
                                          className="w-full h-full object-cover transition-transform duration-200 group-hover/img:scale-110 origin-center" 
                                       />
                                    ) : (
                                       <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-700">NO</div>
                                    )}
                                    {/* HOVER ZOOM POPUP */}
                                    {t.image_url && (
                                       <div className="hidden group-hover/img:block absolute top-0 left-full ml-2 w-48 h-48 bg-black rounded-xl border-2 border-[#FFC300] z-50 shadow-2xl overflow-hidden pointer-events-none">
                                          <img src={t.image_url} className="w-full h-full object-cover" />
                                       </div>
                                    )}
                                 </div>
                              </td>
                              
                              {/* MERGED INFO COLUMN (Title, Code, Badges) */}
                              <td className="p-4 align-middle">
                                 <div className="font-bold text-white text-base leading-tight mb-1.5">{t.title}</div>
                                 
                                 <div className="flex flex-wrap items-center gap-2">
                                    {/* Catalog Number Badge */}
                                    {t.catalog_number && (
                                       <span className="text-xs font-mono text-zinc-400 bg-black/50 px-1.5 py-0.5 rounded border border-zinc-800">
                                          {t.catalog_number}
                                       </span>
                                    )}

                                    {/* Category Icon */}
                                    {t.vehicle_type === 'cargo' && <span title="Вантажні" className="text-purple-400 flex items-center gap-1 text-[10px] uppercase font-bold bg-purple-900/20 px-1.5 py-0.5 rounded"><Truck size={12}/> Вант.</span>}
                                    {t.vehicle_type === 'suv' && <span title="SUV" className="text-green-400 flex items-center gap-1 text-[10px] uppercase font-bold bg-green-900/20 px-1.5 py-0.5 rounded"><Mountain size={12}/> SUV</span>}
                                    {t.vehicle_type === 'car' && <span title="Легкові" className="text-blue-400 flex items-center gap-1 text-[10px] uppercase font-bold bg-blue-900/20 px-1.5 py-0.5 rounded"><Car size={12}/> Легк.</span>}

                                    {/* Hot Button */}
                                    <button onClick={() => toggleHotStatus(t.id, !!t.is_hot)} className={`flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded transition-colors ${t.is_hot ? 'bg-orange-600 text-white shadow-orange-500/20 shadow-lg' : 'bg-zinc-800 text-zinc-600 hover:bg-zinc-700 hover:text-zinc-400'}`}>
                                       <Flame size={10} className={t.is_hot ? 'fill-white' : ''}/> HOT
                                    </button>
                                 </div>
                              </td>
                              
                              {/* RADIUS */}
                              <td className="p-4 text-center align-middle">
                                 <span className="text-[#FFC300] font-black text-lg block">{t.radius}</span>
                                 <span className="text-[10px] text-zinc-500 uppercase">{t.season === 'winter' ? 'Зима' : t.season === 'summer' ? 'Літо' : 'Всесез.'}</span>
                              </td>

                              {/* PRICE */}
                              <td className="p-4 text-right align-middle">
                                 <div className="font-mono text-white font-bold text-lg">{t.price}</div>
                                 {t.base_price && parseFloat(t.base_price) > 0 && (
                                    <div className="text-[10px] text-zinc-600 line-through font-mono mt-0.5" title="Базова ціна">{t.base_price}</div>
                                 )}
                              </td>

                              {/* ACTIONS */}
                              <td className="p-4 text-right align-middle">
                                 <div className="flex justify-end gap-1">
                                    <button onClick={() => openEditTyreModal(t)} className="p-2 bg-zinc-800 rounded-lg hover:bg-blue-900/30 hover:text-blue-400 transition-colors"><Edit2 size={16}/></button>
                                    <button onClick={() => {setBookingToDelete(t.id); setShowDeleteModal(true);}} className="p-2 bg-zinc-800 rounded-lg hover:bg-red-900/30 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               
               {hasMoreTyres && <div className="mt-8 text-center pb-8"><button onClick={() => fetchTyres(tyrePage + 1, false)} disabled={loadingTyres} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-12 rounded-xl border border-zinc-700 flex items-center gap-2 mx-auto disabled:opacity-50">{loadingTyres ? <Loader2 className="animate-spin" /> : <ArrowDown size={20} />} Завантажити ще</button></div>}
            </div>
         )}

         {/* --- MODALS SECTION --- */}
         
         {/* Edit Booking Modal */}
         {showEditModal && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-bold text-white flex items-center gap-2">{bookingForm.id ? <><Edit2 className="text-[#FFC300]"/> Редагувати запис</> : <><Plus className="text-[#FFC300]"/> Новий запис</>}</h3>
                     <button onClick={() => setShowEditModal(false)}><X className="text-zinc-500 hover:text-white"/></button>
                  </div>
                  
                  <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Дата та Час</label>
                        <div className="flex gap-2">
                           <input type="date" value={bookingForm.date} onChange={e => setBookingForm({...bookingForm, date: e.target.value})} className="bg-black border border-zinc-700 rounded-lg p-3 text-white flex-grow font-bold"/>
                           <select value={bookingForm.time} onChange={e => setBookingForm({...bookingForm, time: e.target.value})} className="bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold">
                              {generateTimeOptions(bookingForm.date).map(t => <option key={t} value={t}>{t}</option>)}
                           </select>
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Клієнт</label>
                        <input type="text" placeholder="Ім'я" value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white mb-2"/>
                        <input type="tel" placeholder="Телефон" value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono"/>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Послуга</label>
                        <select value={bookingForm.serviceId} onChange={e => { const s = BOOKING_SERVICES.find(srv => srv.id === e.target.value); setBookingForm({...bookingForm, serviceId: e.target.value, duration: s ? s.duration : 30}); }} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white mb-2">
                           {BOOKING_SERVICES.map(s => <option key={s.id} value={s.id}>{s.label} ({s.duration} хв)</option>)}
                        </select>
                        <div className="flex gap-2">
                           <select value={bookingForm.radius} onChange={e => setBookingForm({...bookingForm, radius: e.target.value})} className="bg-black border border-zinc-700 rounded-lg p-3 text-white flex-grow font-bold text-center">
                              {WHEEL_RADII.map(r => <option key={r} value={r}>{r}</option>)}
                           </select>
                           <input type="number" value={bookingForm.duration} onChange={e => setBookingForm({...bookingForm, duration: parseInt(e.target.value)})} className="bg-black border border-zinc-700 rounded-lg p-3 text-white w-20 text-center" title="Тривалість (хв)" />
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                     {bookingForm.id && <button onClick={handleDeleteBooking} className="bg-red-900/30 text-red-200 border border-red-900/50 p-3 rounded-xl flex-grow font-bold hover:bg-red-900/50 flex justify-center items-center gap-2"><Trash2 size={18}/> Видалити</button>}
                     <button onClick={handleSaveBooking} className="bg-[#FFC300] text-black p-3 rounded-xl flex-grow font-bold hover:bg-[#e6b000] flex justify-center items-center gap-2"><Save size={18}/> Зберегти</button>
                  </div>
               </div>
            </div>
         )}

         {/* Add/Edit Tyre Modal */}
         {showAddTyreModal && (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-2xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-2xl font-bold text-white flex items-center gap-2">{editingTyreId ? <><Edit2 className="text-[#FFC300]"/> Редагування товару</> : <><Plus className="text-[#FFC300]"/> Додати товар</>}</h3>
                     <button onClick={() => setShowAddTyreModal(false)}><X className="text-zinc-500 hover:text-white"/></button>
                  </div>
                  
                  <div className="mb-4">
                     <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase text-[#FFC300]">Повна назва товару (Головне поле)</label>
                     <input type="text" value={tyreForm.title} onChange={e => setTyreForm({...tyreForm, title: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none font-bold text-lg" placeholder="Наприклад: Michelin Pilot Sport 4 205/55 R16"/>
                     <p className="text-[10px] text-zinc-500 mt-1">Це саме те, що побачить клієнт. Якщо заповнено, поля "Виробник" та "Модель" використовуються тільки для пошуку.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Виробник</label>
                        <input type="text" value={tyreForm.manufacturer} onChange={e => setTyreForm({...tyreForm, manufacturer: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none" placeholder="Michelin"/>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Категорія (Папка)</label>
                        <select value={tyreForm.vehicle_type} onChange={e => setTyreForm({...tyreForm, vehicle_type: e.target.value as any})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none cursor-pointer">
                           <option value="car">🚗 Легкові</option>
                           <option value="cargo">🚚 Вантажні (C)</option>
                           <option value="suv">🏔️ Позашляховики (SUV)</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Сезонність</label>
                        <select value={tyreForm.season} onChange={e => setTyreForm({...tyreForm, season: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none cursor-pointer">
                           <option value="winter">❄️ Зима</option>
                           <option value="summer">☀️ Літо</option>
                           <option value="all-season">🌤️ Всесезон</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Радіус (напр. R15)</label>
                        <input type="text" value={tyreForm.radius} onChange={e => setTyreForm({...tyreForm, radius: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none" placeholder="R15"/>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Каталожний номер</label>
                        <input type="text" value={tyreForm.catalog_number} onChange={e => setTyreForm({...tyreForm, catalog_number: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none font-mono"/>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase text-[#FFC300]">Ціна (Роздріб)</label>
                        <input type="text" value={tyreForm.price} onChange={e => setTyreForm({...tyreForm, price: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none font-bold text-lg"/>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Базова ціна (Закуп)</label>
                        <input type="text" value={tyreForm.base_price} onChange={e => setTyreForm({...tyreForm, base_price: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none font-mono"/>
                     </div>
                  </div>
                  
                  <div className="mb-4">
                     <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Опис</label>
                     <textarea value={tyreForm.description} onChange={e => setTyreForm({...tyreForm, description: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#FFC300] outline-none h-24" placeholder="Детальний опис товару..."/>
                  </div>
                  
                  <div className="mb-6">
                     <label className="flex items-center gap-3 cursor-pointer bg-black border border-zinc-700 p-3 rounded-lg hover:border-[#FFC300] transition-colors w-max">
                        <input type="checkbox" checked={tyreForm.is_hot} onChange={e => setTyreForm({...tyreForm, is_hot: e.target.checked})} className="w-5 h-5 rounded border-zinc-600 bg-zinc-900 text-[#FFC300] focus:ring-0 focus:ring-offset-0" />
                        <span className="text-white font-bold flex items-center gap-2"><Flame size={18} className={tyreForm.is_hot ? "text-orange-500 fill-orange-500" : "text-zinc-600"}/> HOT Пропозиція (Розпродаж)</span>
                     </label>
                  </div>

                  {/* Gallery Section */}
                  <div className="mb-6 bg-black/30 p-4 rounded-xl border border-zinc-800">
                     <label className="block text-sm font-bold text-zinc-400 mb-3 flex items-center gap-2"><ImageIcon size={16}/> Фотографії товару</label>
                     <div className="flex flex-wrap gap-3">
                        {existingGallery.map((url, i) => (
                           <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-zinc-700 group shadow-lg">
                              <img src={url} className="w-full h-full object-cover"/>
                              <button onClick={() => setExistingGallery(g => g.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><X size={14}/></button>
                           </div>
                        ))}
                        <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-[#FFC300] hover:text-[#FFC300] text-zinc-500 transition-all bg-black/50 hover:bg-black">
                           <Plus size={28}/>
                           <span className="text-[10px] uppercase font-bold mt-1">Додати</span>
                           <input type="file" multiple accept="image/*" onChange={e => e.target.files && setTyreUploadFiles(prev => [...prev, ...Array.from(e.target.files!)])} className="hidden"/>
                        </label>
                     </div>
                     {tyreUploadFiles.length > 0 && (
                        <div className="mt-3 text-xs bg-blue-900/20 text-blue-300 p-2 rounded border border-blue-900/50 flex items-center gap-2">
                           <Loader2 size={12} className="animate-spin"/> Обрано нових файлів для завантаження: {tyreUploadFiles.length}
                        </div>
                     )}
                  </div>

                  <button onClick={handleSaveTyre} disabled={uploading} className="w-full bg-[#FFC300] text-black font-black text-lg py-4 rounded-xl hover:bg-[#e6b000] flex justify-center items-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100">
                     {uploading ? <Loader2 className="animate-spin"/> : <Save size={20}/>} Зберегти Товар
                  </button>
               </div>
            </div>
         )}

         {/* Delete Confirmation Modal */}
         {showDeleteModal && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl">
                  <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-900/50">
                     <AlertTriangle size={32} className="text-red-500"/>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Видалити товар?</h3>
                  <p className="text-zinc-400 mb-8">Цю дію неможливо скасувати. Товар буде видалено з бази даних назавжди.</p>
                  <div className="flex gap-3">
                     <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold hover:bg-zinc-700 transition-colors">Скасувати</button>
                     <button onClick={async () => {
                        if (bookingToDelete) {
                           await supabase.from('tyres').delete().eq('id', bookingToDelete);
                           fetchTyres(0, true);
                           fetchStockStats();
                           fetchCategoryCounts();
                           setShowDeleteModal(false);
                           setBookingToDelete(null);
                        }
                     }} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20">Видалити</button>
                  </div>
               </div>
            </div>
         )}

         {/* NEW: Custom Confirmation Modal */}
         {confirmModal && confirmModal.isOpen && (
            <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
                <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl">
                    <div className="w-16 h-16 bg-[#FFC300]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#FFC300]/50">
                        <HelpCircle size={32} className="text-[#FFC300]"/>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">{confirmModal.title}</h3>
                    <p className="text-zinc-400 mb-8">{confirmModal.message}</p>
                    <div className="flex gap-3">
                        <button onClick={closeConfirmModal} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold hover:bg-zinc-700 transition-colors">Скасувати</button>
                        <button onClick={confirmModal.onConfirm} className="flex-1 py-3 bg-[#FFC300] text-black rounded-xl font-bold hover:bg-[#e6b000] transition-colors shadow-lg">Підтвердити</button>
                    </div>
                </div>
            </div>
         )}

         {/* Upload Report Modal */}
         {showUploadReport && (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xl font-bold text-white flex items-center gap-2"><Wand2 className="text-blue-400"/> Звіт Розумного Фото</h3>
                     <button onClick={() => setShowUploadReport(false)}><X className="text-zinc-500 hover:text-white"/></button>
                  </div>
                  <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                     {uploading && <div className="text-center py-4 text-zinc-400 flex flex-col items-center"><Loader2 className="animate-spin mb-2 text-[#FFC300]" size={32}/> Обробка фотографій...</div>}
                     {uploadReport.map((item, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border flex items-center gap-3 ${item.status === 'success' ? 'bg-green-900/10 border-green-900/30' : item.status === 'skipped' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-red-900/10 border-red-900/30'}`}>
                           {item.previewUrl && <img src={item.previewUrl} className="w-10 h-10 object-cover rounded border border-zinc-700" />}
                           <div className="flex-grow min-w-0">
                              <div className="text-xs font-mono text-zinc-500 truncate">{item.fileName}</div>
                              <div className={`text-sm font-bold truncate ${item.status === 'success' ? 'text-green-400' : item.status === 'error' ? 'text-red-400' : 'text-zinc-300'}`}>{item.message}</div>
                              {item.productName && <div className="text-xs text-zinc-400 truncate">→ {item.productName}</div>}
                           </div>
                           <div className="text-xl">
                              {item.status === 'success' ? <CheckCircle className="text-green-500" size={20}/> : item.status === 'error' ? <AlertTriangle className="text-red-500" size={20}/> : <span className="text-zinc-600 font-bold text-xs">SKIP</span>}
                           </div>
                        </div>
                     ))}
                  </div>
                  <button onClick={() => setShowUploadReport(false)} className="mt-4 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl">Закрити</button>
               </div>
            </div>
         )}

         {/* Excel Import Modal */}
         {showExcelModal && (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                  
                  {/* TOP HEADER & CONTROLS */}
                  <div className="bg-black p-4 border-b border-zinc-800">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-black text-white flex items-center gap-2 uppercase italic"><FileSpreadsheet className="text-[#FFC300]"/> Імпорт з Excel</h3>
                        <button onClick={() => setShowExcelModal(false)} className="text-zinc-500 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors"><X size={24}/></button>
                     </div>

                     <div className="flex flex-col md:flex-row gap-6 items-end justify-between">
                        <div className="flex gap-6 items-end">
                           <div className="flex flex-col gap-1">
                              <label className="text-xs font-bold text-zinc-400 uppercase">Почати з рядка</label>
                              <div className="flex items-center bg-zinc-800 rounded-lg p-1 border border-zinc-700">
                                 <input type="number" value={excelStartRow} onChange={e => setExcelStartRow(parseInt(e.target.value) || 1)} className="w-16 bg-transparent text-white font-bold text-center outline-none" min="1" />
                              </div>
                           </div>

                           <label className="flex items-center gap-3 cursor-pointer bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-700 hover:border-red-500/50 transition-colors h-full">
                              <input type="checkbox" checked={markMissingOutOfStock} onChange={e => setMarkMissingOutOfStock(e.target.checked)} className="w-5 h-5 rounded border-zinc-600 bg-black text-red-500 focus:ring-0 focus:ring-offset-0" />
                              <span className="text-sm font-bold text-zinc-300">Видалити товари, яких немає в файлі? <span className="block text-[10px] text-zinc-500 font-normal">Синхронізація прайсу</span></span>
                           </label>
                        </div>

                        <button onClick={processExcelImport} disabled={importingExcel} className="bg-green-600 hover:bg-green-500 text-white font-black py-3 px-8 rounded-xl shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50 disabled:scale-100">
                           {importingExcel ? <Loader2 className="animate-spin"/> : <Upload size={20}/>} ЗАВАНТАЖИТИ В БАЗУ
                        </button>
                     </div>
                  </div>

                  {/* PREVIEW TABLE */}
                  <div className="flex-grow overflow-auto bg-zinc-900 relative">
                     {excelPreview.length > 0 ? (
                        <table className="w-full text-xs text-left border-collapse">
                           <thead className="sticky top-0 z-20 shadow-xl">
                              {/* Row 1: Column Letters */}
                              <tr className="bg-zinc-950 text-zinc-500 font-mono text-center">
                                 <th className="p-2 border-b border-r border-zinc-800 w-10 bg-zinc-950 sticky left-0 z-30">#</th>
                                 {Array.from({length: maxPreviewCols}).map((_, i) => (
                                    <th key={i} className="p-2 border-b border-r border-zinc-800 min-w-[150px] font-bold text-[#FFC300]">
                                       {getExcelColumnName(i)}
                                    </th>
                                 ))}
                              </tr>
                              {/* Row 2: Selectors */}
                              <tr className="bg-black border-b border-zinc-800">
                                 <th className="p-2 border-r border-zinc-800 bg-black sticky left-0 z-30"></th>
                                 {Array.from({length: maxPreviewCols}).map((_, colIndex) => {
                                    // Reverse lookup: find which field is mapped to this column index
                                    const mappedField = Object.keys(columnMapping).find(key => columnMapping[key] === colIndex) || "";
                                    
                                    return (
                                       <th key={colIndex} className="p-2 border-r border-zinc-800">
                                          <select 
                                             value={mappedField} 
                                             onChange={(e) => {
                                                const newField = e.target.value;
                                                const newMapping = { ...columnMapping };
                                                
                                                // Clear existing mapping for this column if exists
                                                const fieldPointingHere = Object.keys(newMapping).find(k => newMapping[k] === colIndex);
                                                if (fieldPointingHere) delete newMapping[fieldPointingHere];
                                                
                                                if (newField !== "") {
                                                   newMapping[newField] = colIndex;
                                                }
                                                setColumnMapping(newMapping);
                                             }} 
                                             className={`w-full bg-zinc-900 border text-xs font-bold rounded p-1.5 outline-none cursor-pointer uppercase ${mappedField ? 'border-[#FFC300] text-[#FFC300]' : 'border-zinc-700 text-zinc-500'}`}
                                          >
                                             <option value="">-- Не імпортувати --</option>
                                             <option value="catalog_number" className="font-bold text-white">★ Артикул (Код)</option>
                                             <option value="title" className="font-bold text-white">★ Назва товару</option>
                                             <option value="manufacturer">Виробник</option>
                                             <option value="price" className="font-bold text-green-400">Ціна (Роздріб)</option>
                                             <option value="base_price">Ціна (Закуп)</option>
                                             <option value="radius">Радіус (R)</option>
                                             <option value="season">Сезон</option>
                                             <option value="vehicle_type">Тип авто</option>
                                          </select>
                                       </th>
                                    );
                                 })}
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-zinc-800 font-mono text-zinc-300 bg-zinc-900">
                              {excelPreview.map((row, idx) => {
                                 const rowNum = idx + 1;
                                 const isIgnored = rowNum < excelStartRow;
                                 return (
                                    <tr key={idx} className={isIgnored ? 'opacity-30 bg-red-900/5' : 'hover:bg-zinc-800'}>
                                       <td className={`p-2 border-r border-zinc-800 text-center font-bold sticky left-0 z-10 ${isIgnored ? 'bg-zinc-900 text-red-500' : 'bg-zinc-900 text-zinc-500'}`}>{rowNum}</td>
                                       {row.map((cell: any, cIdx: number) => {
                                          const isMapped = Object.values(columnMapping).includes(cIdx);
                                          return (
                                             <td key={cIdx} className={`p-2 border-r border-zinc-800 truncate max-w-[200px] ${isMapped && !isIgnored ? 'text-white' : ''} ${!isMapped ? 'opacity-50' : ''}`}>
                                                {cell !== null && cell !== undefined ? String(cell) : ''}
                                             </td>
                                          );
                                       })}
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                           <Loader2 className="animate-spin" size={48}/>
                           <p>Зчитування файлу...</p>
                        </div>
                     )}
                  </div>
                  {importStatus && <div className="text-center font-mono text-sm text-black font-bold bg-[#FFC300] p-2 border-t border-[#e6b000]">{importStatus}</div>}
               </div>
            </div>
         )}

         {/* Client History Modal */}
         {showHistoryModal && (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                     <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2"><History className="text-[#FFC300]"/> Історія Клієнта</h3>
                        {selectedClientHistory.length > 0 && (
                           <div className="flex items-center gap-2 mt-1">
                              {editingClient ? (
                                 <div className="flex gap-2">
                                    <input value={editingClient.customer_name} onChange={e => setEditingClient({...editingClient, customer_name: e.target.value})} className="bg-black border border-zinc-700 rounded px-2 py-1 text-white"/>
                                    <input value={editingClient.customer_phone} onChange={e => setEditingClient({...editingClient, customer_phone: e.target.value})} className="bg-black border border-zinc-700 rounded px-2 py-1 text-white font-mono"/>
                                    <button onClick={handleEditClientSave} className="bg-green-600 text-white px-3 rounded font-bold">OK</button>
                                    <button onClick={() => setEditingClient(null)} className="bg-zinc-800 text-white px-3 rounded">X</button>
                                 </div>
                              ) : (
                                 <>
                                    <span className="text-zinc-400">{selectedClientHistory[0].customer_name}</span>
                                    <span className="text-zinc-500 font-mono">{selectedClientHistory[0].customer_phone}</span>
                                    <button onClick={() => setEditingClient(selectedClientHistory[0])} className="text-blue-400 hover:text-white"><Edit2 size={14}/></button>
                                 </>
                              )}
                           </div>
                        )}
                     </div>
                     <button onClick={() => setShowHistoryModal(false)}><X className="text-zinc-500 hover:text-white"/></button>
                  </div>
                  
                  <div className="space-y-3">
                     {selectedClientHistory.map(item => (
                        <div key={item.id} className="bg-black/50 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                           <div>
                              <div className="text-[#FFC300] font-bold text-lg">{item.booking_date} <span className="text-sm text-zinc-500 font-normal">({item.start_time})</span></div>
                              <div className="text-white font-bold">{item.service_label} <span className="text-zinc-500 font-normal">| {item.radius} | {item.duration_minutes} хв</span></div>
                           </div>
                           <button onClick={() => deleteFromHistory(item.id)} className="p-2 bg-zinc-800 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-900/20 transition-colors"><Trash2 size={18}/></button>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         )}

      </main>
    </div>
  );
};

export default AdminPanel;
