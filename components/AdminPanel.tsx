
import React, { useState, useEffect, useRef } from 'react';
import { Lock, Trash2, Calendar, Users, Search, Plus, X, Image as ImageIcon, Settings, Upload, Save, Phone, AlertTriangle, DollarSign, Loader2, TrendingUp, ShoppingBag, FileSpreadsheet, CheckSquare, Square, Edit2, ArrowRight, ArrowLeft, ArrowDown, Clock, Move, History, Wand2, Percent, Printer, Filter, Flame, KeyRound, FileCheck, FileWarning, CheckCircle, Package, RotateCcw, ImagePlus, Eye, Menu, Folder, FolderOpen, Truck, Car, Mountain, Sparkles, HelpCircle, FileUp, ChevronDown, Copy, ArrowUpDown, Tag, ClipboardList, Lightbulb, FileText, Ban } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { BOOKING_SERVICES, WHEEL_RADII, WORK_START_HOUR, WORK_END_HOUR, PRICING_DATA_CARS, PRICING_DATA_SUV, ADDITIONAL_SERVICES, PriceRow } from '../constants';
import { TyreProduct, TyreOrder, Article } from '../types';
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

const generateTimeOptions = () => {
  const options = [];
  for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
    for (let m = 0; m < 60; m += 10) {
      options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return options;
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
  const [activeTab, setActiveTab] = useState<'schedule' | 'clients' | 'gallery' | 'prices' | 'settings' | 'tyres' | 'orders' | 'stats' | 'articles'>(
    mode === 'service' ? 'schedule' : 'tyres'
  );

  useEffect(() => {
     if (mode === 'service' && !['schedule', 'clients', 'gallery', 'prices'].includes(activeTab)) {
        setActiveTab('schedule');
     } else if (mode === 'tyre' && !['tyres', 'orders', 'stats', 'settings', 'articles'].includes(activeTab)) {
        setActiveTab('tyres');
     }
  }, [mode]);

  // --- CONFIRMATION DIALOG STATE ---
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ isOpen: false, title: '', message: '', action: () => {} });

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
  const [tyreCategoryTab, setTyreCategoryTab] = useState<'all' | 'car' | 'cargo' | 'suv' | 'hot' | 'out_of_stock'>('all');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState({ all: 0, car: 0, cargo: 0, suv: 0, hot: 0, out: 0 });
  
  // Sorting with Photos
  const [tyreSort, setTyreSort] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'with_photo' | 'no_photo'>('newest');

  const [hasMoreTyres, setHasMoreTyres] = useState(true);
  const [loadingTyres, setLoadingTyres] = useState(false);
  const [tyreOrders, setTyreOrders] = useState<TyreOrder[]>([]);
  
  // Order Editing State
  const [editingOrder, setEditingOrder] = useState<TyreOrder | null>(null);
  const [showOrderEditModal, setShowOrderEditModal] = useState(false);

  // --- ARTICLES STATE ---
  const [articles, setArticles] = useState<Article[]>([]);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [articleForm, setArticleForm] = useState({ title: '', content: '', image: null as File | null, image_url: '' });

  const [showAddTyreModal, setShowAddTyreModal] = useState(false);
  const [editingTyreId, setEditingTyreId] = useState<number | null>(null);
  const [selectedTyreIds, setSelectedTyreIds] = useState<Set<number>>(new Set());
  const [bulkMarkup, setBulkMarkup] = useState('');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const smartUploadInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const articleImageRef = useRef<HTMLInputElement>(null);
  const [tyreSearch, setTyreSearch] = useState('');
  
  // Form State
  const [tyreForm, setTyreForm] = useState({ 
      manufacturer: '', 
      name: '', 
      radius: 'R15', 
      season: 'winter', 
      vehicle_type: 'car' as 'car' | 'cargo' | 'suv', // Added vehicle_type
      price: '', 
      old_price: '', // NEW: Old Price for discount
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
  // New: Mapping logic where Key is Column Index, Value is Field Name
  const [excelColumnMap, setExcelColumnMap] = useState<Record<number, string>>({});

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

  const showError = (msg: string) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(''), 6000); };

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
    else if (activeTab === 'articles') fetchArticles();
  }, [activeTab]);

  // 3. Tyre fetches - depend on activeTab AND tyreCategoryTab AND tyreSort
  useEffect(() => {
    if (activeTab === 'tyres') {
        setTyres([]); // Clear list visually to show category change
        fetchTyres(0, true); 
        fetchStockStats(); 
        fetchCategoryCounts(); 
    }
  }, [activeTab, tyreCategoryTab, tyreSort]); 

  // --- ARTICLES LOGIC ---
  const fetchArticles = async () => {
    const { data } = await supabase.from('articles').select('*').order('created_at', { ascending: false });
    if (data) setArticles(data);
  };

  const openArticleModal = (article: Article | null = null) => {
    setEditingArticle(article);
    setArticleForm({
      title: article ? article.title : '',
      content: article ? article.content : '',
      image: null,
      image_url: article ? (article.image_url || '') : ''
    });
    setShowArticleModal(true);
  };

  const handleSaveArticle = async () => {
    if (!articleForm.title || !articleForm.content) return;
    setUploading(true);
    try {
      let finalImageUrl = articleForm.image_url;
      
      if (articleForm.image) {
        const file = articleForm.image;
        const fileName = `article_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const { error } = await supabase.storage.from('galery').upload(fileName, file);
        if (!error) { 
          const { data } = supabase.storage.from('galery').getPublicUrl(fileName); 
          finalImageUrl = data.publicUrl; 
        }
      }

      const payload = { title: articleForm.title, content: articleForm.content, image_url: finalImageUrl };
      
      if (editingArticle) {
        await supabase.from('articles').update(payload).eq('id', editingArticle.id);
      } else {
        await supabase.from('articles').insert([payload]);
      }
      
      setShowArticleModal(false);
      fetchArticles();
    } catch (e: any) {
      showError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteArticle = async (id: number) => {
    if (confirm("Видалити статтю?")) {
      await supabase.from('articles').delete().eq('id', id);
      fetchArticles();
    }
  };

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
       
       // Gap before booking
       if (bStart > currentMins) {
           timelineItems.push(renderFreeBlock(currentMins, bStart, date));
       }
       
       // The booking itself
       timelineItems.push(renderBookingBlock(booking, date));
       
       currentMins = Math.max(currentMins, bEnd);
    });
    
    // Remaining time after last booking
    if (currentMins < endOfDayMins) {
        timelineItems.push(renderFreeBlock(currentMins, endOfDayMins, date));
    }
    
    return (
        <div className="p-3 h-full overflow-y-auto bg-zinc-950/50 scrollbar-thin scrollbar-thumb-zinc-700">
            {/* GRID LAYOUT: BRICKS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {timelineItems}
            </div>
        </div>
    );
  };

  const renderFreeBlock = (startMins: number, endMins: number, date: string) => {
     const duration = endMins - startMins;
     const startTimeStr = minsToTime(startMins);
     
     const isSmallGap = duration < 20;

     return (
       <div 
         key={`free-${startMins}`} 
         className={`
            relative group border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/40 
            hover:bg-[#FFC300]/10 hover:border-[#FFC300] transition-all cursor-pointer 
            flex flex-col items-center justify-center text-center p-2 min-h-[100px]
            ${isSmallGap ? 'opacity-50 hover:opacity-100' : ''}
         `}
         onClick={() => openAddModal(date, startTimeStr)}
         onDragOver={(e) => e.preventDefault()} 
         onDrop={(e) => handleDropOnGap(e, date, startTimeStr)}
       >
         <div className="text-[#FFC300] font-mono font-black text-lg mb-1">
            {startTimeStr}
         </div>
         <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-2">
            Вільний час
         </div>
         <div className="text-zinc-600 text-xs font-bold bg-zinc-900/50 px-2 py-1 rounded-full group-hover:text-[#FFC300] transition-colors">
            {duration} хв
         </div>
         
         <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <div className="bg-[#FFC300] text-black rounded-full p-1 shadow-lg">
                <Plus size={14} />
             </div>
         </div>
       </div>
     );
  };

  const renderBookingBlock = (booking: any, date: string) => {
      const bEndMins = timeToMins(booking.start_time) + booking.duration_minutes;
      
      let bgColor = "bg-zinc-800"; 
      let borderClass = "border-l-4 border-green-500";
      let statusIcon = null;

      if (booking.status === 'staff') {
          bgColor = "bg-zinc-800";
          borderClass = "border-l-4 border-[#FFC300]";
      } else if (booking.is_edited) {
          bgColor = "bg-red-900/20";
          borderClass = "border-l-4 border-red-500";
          statusIcon = <AlertTriangle size={12} className="text-red-500" />;
      }

      return (
         <div 
            key={booking.id} 
            draggable
            onDragStart={() => setDraggedBookingId(booking.id)}
            onClick={() => openEditModal(booking)}
            className={`
                relative p-3 rounded-xl shadow-lg cursor-grab active:cursor-grabbing 
                transition-all hover:scale-[1.03] hover:shadow-xl hover:z-10 
                flex flex-col justify-between min-h-[120px] overflow-hidden
                ${bgColor} ${borderClass} border-y border-r border-zinc-700/50
            `}
         >
            <div className="flex justify-between items-start mb-2">
               <div className="font-mono font-black text-xl text-white tracking-tight">
                  {booking.start_time}
               </div>
               <div className="text-xs font-mono text-zinc-500 pt-1">
                  {minsToTime(bEndMins)}
               </div>
            </div>
            
            <div className="flex-grow">
                <div className="font-bold text-sm text-zinc-100 leading-tight mb-1 line-clamp-2">
                    {booking.customer_name}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                    <Phone size={10} /> {booking.customer_phone}
                </div>
            </div>
            
            <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/5">
                <div className="text-[10px] font-bold text-zinc-300 truncate max-w-[60%]">
                    {booking.service_label}
                </div>
                <div className="flex items-center gap-1">
                    {statusIcon}
                    <div className="bg-[#FFC300] text-black px-1.5 py-0.5 rounded text-[10px] font-black">
                        {booking.radius}
                    </div>
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

  const openAddModal = (date: string, time?: string) => { setBookingForm({ id: null, name: '', phone: '', time: time || '08:00', date: date, serviceId: BOOKING_SERVICES[0].id, radius: WHEEL_RADII[2], duration: 30 }); setShowEditModal(true); };
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

  const handleDeleteTyre = async () => {
    if (bookingToDelete) {
        await supabase.from('tyres').delete().eq('id', bookingToDelete);
        setBookingToDelete(null);
        setShowDeleteModal(false);
        fetchTyres(0, true);
    }
  };

  // ORDER HANDLERS
  const handleSaveOrder = async () => {
    if (!editingOrder) return;
    const { error } = await supabase.from('tyre_orders').update({
        customer_name: editingOrder.customer_name,
        customer_phone: editingOrder.customer_phone,
        status: editingOrder.status,
        delivery_city: editingOrder.delivery_city,
        delivery_warehouse: editingOrder.delivery_warehouse,
    }).eq('id', editingOrder.id);

    if (error) {
        showError("Помилка оновлення: " + error.message);
    } else {
        setShowOrderEditModal(false);
        fetchTyreOrders();
    }
  };

  const handleDeleteOrderRecord = async () => {
    if (!editingOrder) return;
    await supabase.from('tyre_orders').delete().eq('id', editingOrder.id);
    setShowOrderEditModal(false);
    fetchTyreOrders();
  };

  const openEditTyreModal = (t: TyreProduct) => {
    try {
      setEditingTyreId(t.id);
      
      const manufacturer = t.manufacturer || '';
      const title = t.title || '';
      const name = manufacturer ? title.replace(manufacturer, '').trim() : title;
      
      let season = 'all-season';
      const desc = (t.description || '').toLowerCase();
      if (desc.includes('winter') || desc.includes('зима')) season = 'winter';
      else if (desc.includes('summer') || desc.includes('літо')) season = 'summer';
      
      let vehicleType = 'car';
      if (t.vehicle_type) {
          vehicleType = t.vehicle_type;
      } else {
          const radius = (t.radius || '').toUpperCase();
          if (radius.includes('C')) vehicleType = 'cargo';
      }

      setTyreForm({ 
        manufacturer, 
        name, 
        radius: t.radius || 'R15', 
        season: season, 
        vehicle_type: vehicleType as any, 
        price: String(t.price || ''), 
        old_price: String(t.old_price || ''), 
        base_price: String(t.base_price || ''), 
        catalog_number: t.catalog_number || '', 
        description: t.description || '', 
        is_hot: !!t.is_hot 
      });
      
      let gallery = t.gallery || [];
      if (gallery.length === 0 && t.image_url) {
          gallery = [t.image_url];
      }
      
      const uniqueGallery = Array.from(new Set(gallery));
      setExistingGallery(uniqueGallery);
      
      setTyreUploadFiles([]);
      setShowAddTyreModal(true);
    } catch (error: any) {
      console.error("Error opening edit modal:", error);
      showError("Помилка відкриття редагування: " + error.message);
    }
  };

  const applyDiscountPreset = () => {
      const current = parseFloat(tyreForm.price);
      if (!isNaN(current) && current > 0) {
          const old = current;
          const newP = Math.round(old * 0.95);
          setTyreForm(prev => ({ ...prev, old_price: old.toString(), price: newP.toString(), is_hot: true }));
      }
  };

  const fetchStats = async () => {
    try {
      const { count: ordersCount } = await supabase.from('tyre_orders').select('*', { count: 'exact', head: true });
      const { count: tyresCount } = await supabase.from('tyres').select('*', { count: 'exact', head: true });
      const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
      
      const { data: orders } = await supabase.from('tyre_orders').select('items');
      const { data: allTyres } = await supabase.from('tyres').select('id, base_price');
      
      const basePriceMap = new Map();
      allTyres?.forEach(t => basePriceMap.set(t.id, t.base_price)); 

      let profit = 0;
      
      const parseVal = (v: any) => {
         if(!v) return 0;
         const s = String(v).replace(/\s/g, '').replace(',', '.');
         return parseFloat(s) || 0;
      };

      orders?.forEach((o: any) => { 
          if (o.items) o.items.forEach((i: any) => { 
              const sellPrice = parseVal(i.price);
              const basePrice = parseVal(i.base_price) || parseVal(basePriceMap.get(i.id)); 
              
              const qty = i.quantity || 1;
              const margin = sellPrice - basePrice;
              
              profit += margin * qty; 
          }); 
      });
      
      setStatsData({ totalOrders: ordersCount || 0, totalTyres: tyresCount || 0, totalBookings: bookingCount || 0, totalRevenue: profit });
    } catch (e) { console.error(e); }
  };

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
  
  const handleDeleteClient = (phone: string) => {
      setConfirmDialog({
          isOpen: true,
          title: "Видалити клієнта",
          message: `Ви впевнені, що хочете видалити клієнта з телефоном ${phone}? Це призведе до видалення ВСІЄЇ історії його відвідувань.`,
          action: async () => {
              const { error } = await supabase.from('bookings').delete().eq('customer_phone', phone);
              if (error) {
                  showError("Помилка видалення: " + error.message);
              } else {
                  fetchClients();
                  showError("Клієнта та його історію видалено.");
              }
          }
      });
  };

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

  const fetchStockStats = async () => {
     const { count: total } = await supabase.from('tyres').select('*', { count: 'exact', head: true });
     const { count: inStock } = await supabase.from('tyres').select('*', { count: 'exact', head: true }).neq('in_stock', false);
     const outStock = (total || 0) - (inStock || 0);
     setStockStats({ total: total || 0, inStock: inStock || 0, outStock: outStock || 0 });
  };
  
  const fetchCategoryCounts = async () => {
    try {
        const base = supabase.from('tyres').select('*', { count: 'exact', head: true });
        
        const [all, car, cargo, suv, hot, out] = await Promise.all([
            base.then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).or('vehicle_type.eq.car,vehicle_type.is.null').neq('vehicle_type', 'cargo').neq('vehicle_type', 'suv').not('radius', 'ilike', '%C%').neq('in_stock', false).then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).or('vehicle_type.eq.cargo,radius.ilike.%C%').neq('in_stock', false).then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('vehicle_type', 'suv').neq('in_stock', false).then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('is_hot', true).neq('in_stock', false).then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('in_stock', false).then(r => r.count)
        ]);

        setCategoryCounts({ 
            all: all || 0, 
            car: car || 0, 
            cargo: cargo || 0, 
            suv: suv || 0, 
            hot: hot || 0,
            out: out || 0
        });
    } catch (e) { console.error("Category counts error", e); }
  };

  const processResetStock = async () => {
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
  };

  const handleResetStockClick = () => {
      setConfirmDialog({
          isOpen: true,
          title: "Скинути склад",
          message: "Ви впевнені? Це зробить ВСІ товари 'В наявності'.",
          action: processResetStock
      });
  };

  const processAutoCategorize = async () => {
    try {
        showError("Завантаження та аналіз бази товарів...");
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

        const toUpdate: any[] = [];
        let carCount = 0;
        let cargoCount = 0;
        let suvCount = 0;
        
        for (const t of allTyres) {
            const title = (t.title || '').toUpperCase();
            const radiusStr = (t.radius || '').toUpperCase();
            let newType = 'car'; 

            const radiusRegex = /R\d{2}C/i;
            const hasC_in_Title = radiusRegex.test(title);
            const hasC_in_Radius = radiusStr.includes('C');
            const isCargoKeyword = title.includes('CARGO') || title.includes('BUS') || title.includes('LT') || title.includes('TRANS') || title.includes('VAN');
            const isCargo = hasC_in_Title || hasC_in_Radius || isCargoKeyword;
            const isSuv = !isCargo && (title.includes('SUV') || title.includes('4X4') || title.includes('JEEP') || title.includes('OFF-ROAD') || title.includes('AWD') || title.includes('CR-V') || title.includes('RAV4') || title.includes('PRADO') || title.includes('LAND CRUISER'));

            if (isCargo) { newType = 'cargo'; cargoCount++; }
            else if (isSuv) { newType = 'suv'; suvCount++; }
            else { carCount++; }

            if (t.vehicle_type !== newType) {
                toUpdate.push({ id: t.id, vehicle_type: newType });
            }
        }

        if (toUpdate.length > 0) {
            const total = toUpdate.length;
            showError(`Знайдено змін: ${total}. Оновлення...`);
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
        showError("Помилка: " + e.message);
    }
  };

  const handleAutoCategorizeClick = () => {
      setConfirmDialog({
          isOpen: true,
          title: "Авто-сортування категорій",
          message: "Ви впевнені? Це автоматично розсортує ВСІ існуючі товари по папках (Легкові/Вантажні/SUV) на основі їх назви та радіусу. Це може зайняти деякий час.",
          action: processAutoCategorize
      });
  };

  const processSmartPhotoSort = async () => {
    setUploading(true);
    showError("Аналіз бази даних... Це може зайняти хвилину.");
    
    try {
        let allTyres: any[] = [];
        let from = 0;
        const step = 1000;
        
        while(true) {
            const { data, error } = await supabase.from('tyres').select('id, title, manufacturer, image_url, gallery').range(from, from + step - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allTyres.push(...data);
            if (data.length < step) break;
            from += step;
        }

        const getModelSignature = (t: any) => {
            let s = t.title.toUpperCase();
            let manufacturer = t.manufacturer ? t.manufacturer.toUpperCase() : '';
            if (!manufacturer) {
               const match = s.match(/\(([^)]+)\)/);
               if (match) manufacturer = match[1].trim();
            }
            if (!manufacturer) {
                const firstWord = s.split(' ')[0];
                if (firstWord && isNaN(parseInt(firstWord)) && firstWord.length > 2) {
                    manufacturer = firstWord;
                }
            }
            if (manufacturer) {
                s = s.replace(manufacturer, '');
            }
            s = s.replace(/\(.*\)/, '');
            s = s.replace(/\b\d{3}[\/\s]\d{2}[\s]?[Z]?R\d{2}[C]?\b/gi, '');
            s = s.replace(/\bR\d{2}[C]?\b/gi, '');
            s = s.replace(/\b\d{2,3}[A-Z]\b/gi, '');
            s = s.replace(/\b(XL|SUV|CARGO|LT|M\+S|TUBELESS|TUBE|ZR|RF|FR)\b/gi, '');
            const model = s.replace(/[^A-Z0-9]/g, '').trim();
            if (manufacturer && model.length > 1) {
               return `${manufacturer}_${model}`;
            }
            return null;
        };

        const photoSource: Record<string, { image_url: string, gallery: string[] }> = {};
        allTyres.forEach(t => {
            if (t.image_url) {
                const sig = getModelSignature(t);
                if (sig && !photoSource[sig]) {
                    const rawGallery = t.gallery || [];
                    const uniqueGallery = Array.from(new Set<string>(rawGallery));
                    if (t.image_url && !uniqueGallery.includes(t.image_url)) {
                       uniqueGallery.unshift(t.image_url);
                    }
                    photoSource[sig] = { image_url: t.image_url, gallery: uniqueGallery };
                }
            }
        });

        const toUpdate: any[] = [];
        allTyres.forEach(t => {
            if (!t.image_url) {
                const sig = getModelSignature(t);
                if (sig && photoSource[sig]) {
                    toUpdate.push({
                        id: t.id,
                        image_url: photoSource[sig].image_url,
                        gallery: photoSource[sig].gallery
                    });
                }
            }
        });

        if (toUpdate.length === 0) {
            showError(`Перевірено ${allTyres.length} товарів. Схожих пар без фото не знайдено.`);
        } else {
            showError(`Знайдено ${toUpdate.length} товарів для оновлення. Зберігаємо...`);
            const batchSize = 50;
            for (let i = 0; i < toUpdate.length; i += batchSize) {
                const chunk = toUpdate.slice(i, i + batchSize);
                await Promise.all(chunk.map((item: any) => 
                    supabase.from('tyres').update({ image_url: item.image_url, gallery: item.gallery }).eq('id', item.id)
                ));
            }
            showError(`Успішно оновлено ${toUpdate.length} товарів!`);
            fetchTyres(0, true);
        }

    } catch (e: any) {
        console.error(e);
        showError("Помилка: " + e.message);
    } finally {
        setUploading(false);
    }
  };

  const handleSmartPhotoSortClick = () => {
      setConfirmDialog({
          isOpen: true,
          title: "Авто-фото (Дублі)",
          message: "Це автоматично копіює фото для товарів з однаковою Моделлю та Виробником (наприклад, з R17 на R14). Продовжити?",
          action: processSmartPhotoSort
      });
  };

  const fetchTyres = async (pageIdx: number, isRefresh = false) => {
    setLoadingTyres(true);
    try {
       const from = pageIdx * PAGE_SIZE;
       const to = from + PAGE_SIZE - 1;
       let query = supabase.from('tyres').select('*', { count: 'exact' });
       if (tyreSearch.trim().length > 0) query = query.or(`title.ilike.%${tyreSearch.trim()}%,catalog_number.ilike.%${tyreSearch.trim()}%,radius.ilike.%${tyreSearch.trim()}%`);
       
       if (tyreCategoryTab === 'car') {
           query = query.or('vehicle_type.eq.car,vehicle_type.is.null').neq('vehicle_type', 'cargo').neq('vehicle_type', 'suv').not('radius', 'ilike', '%C%').neq('in_stock', false);
       } else if (tyreCategoryTab === 'cargo') {
           query = query.or('vehicle_type.eq.cargo,radius.ilike.%C%').neq('in_stock', false); 
       } else if (tyreCategoryTab === 'suv') {
           query = query.eq('vehicle_type', 'suv').neq('in_stock', false);
       } else if (tyreCategoryTab === 'hot') {
           query = query.eq('is_hot', true).neq('in_stock', false);
       } else if (tyreCategoryTab === 'out_of_stock') {
           query = query.eq('in_stock', false);
       } else {
           query = query.neq('in_stock', false); // Default 'all' shows only in_stock
       }

       // Sorting Logic
       if (tyreSort === 'newest') {
           query = query.order('created_at', { ascending: false });
       } else if (tyreSort === 'oldest') {
           query = query.order('created_at', { ascending: true });
       } else if (tyreSort === 'price_asc') {
           query = query.order('price', { ascending: true });
       } else if (tyreSort === 'price_desc') {
           query = query.order('price', { ascending: false });
       } else if (tyreSort === 'with_photo') {
           query = query.order('image_url', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
       } else if (tyreSort === 'no_photo') {
           query = query.order('image_url', { ascending: true, nullsFirst: true }).order('created_at', { ascending: false });
       }
       
       const { data, error } = await query.range(from, to);
       if (error) throw error;

       if (data) {
          if (isRefresh) { setTyres(data); setTyrePage(0); setSelectedTyreIds(new Set()); } 
          else { setTyres(prev => [...prev, ...data]); setTyrePage(pageIdx); }
          setHasMoreTyres(data.length === PAGE_SIZE);
       }
    } catch (e: any) { 
        console.error(e);
        if (isRefresh) setTyres([]); 
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
      
      const finalGallery = Array.from(new Set([...existingGallery, ...newUrls]));
      const seasonLabel = tyreForm.season === 'winter' ? 'Winter' : tyreForm.season === 'summer' ? 'Summer' : 'All Season';
      
      const cleanPrice = Math.round(parseFloat(tyreForm.price.replace(/[^\d.]/g, '')) || 0).toString();
      const cleanOldPrice = tyreForm.old_price ? Math.round(parseFloat(tyreForm.old_price.replace(/[^\d.]/g, '')) || 0).toString() : null;
      const cleanBasePrice = Math.round(parseFloat(tyreForm.base_price.replace(/[^\d.]/g, '')) || 0).toString();

      const payload: any = {
        title: `${tyreForm.manufacturer} ${tyreForm.name} ${tyreForm.radius} ${seasonLabel}`,
        description: tyreForm.description || `Сезон: ${seasonLabel}.`,
        price: cleanPrice, 
        old_price: cleanOldPrice,
        base_price: cleanBasePrice, 
        manufacturer: tyreForm.manufacturer, 
        catalog_number: tyreForm.catalog_number, 
        radius: tyreForm.radius, 
        season: tyreForm.season,
        vehicle_type: tyreForm.vehicle_type, 
        image_url: finalGallery[0], 
        gallery: finalGallery, 
        is_hot: tyreForm.is_hot 
      };
      if (editingTyreId) await supabase.from('tyres').update(payload).eq('id', editingTyreId);
      else await supabase.from('tyres').insert([payload]);
      
      fetchTyres(0, true); 
      fetchStockStats(); 
      fetchCategoryCounts();
      setShowAddTyreModal(false);
    } catch (err: any) { showError(err.message); } finally { setUploading(false); }
  };

  const toggleHotStatus = async (id: number, current: boolean) => {
     const { error } = await supabase.from('tyres').update({ is_hot: !current }).eq('id', id);
     if (!error) {
        setTyres(prev => prev.map(t => t.id === id ? { ...t, is_hot: !current } : t));
        fetchCategoryCounts();
     } else {
        showError("Помилка оновлення статусу HOT");
     }
  };

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
                       if (!currentGallery.includes(newUrl)) {
                           const updates: any = { gallery: [...currentGallery, newUrl] };
                           if (!match.image_url) updates.image_url = newUrl; 
                           await supabase.from('tyres').update(updates).eq('id', match.id);
                           report.push({ fileName: file.name, status: 'success', message: 'Завантажено', productName: match.title, previewUrl });
                       } else {
                           report.push({ fileName: file.name, status: 'skipped', message: 'Вже існує', productName: match.title, previewUrl });
                       }
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

  const autoMapColumns = (headers: string[]) => {
    const newMap: Record<number, string> = {};
    headers.forEach((header, index) => {
       const h = header.toLowerCase().trim();
       if (h.includes('код') || h.includes('артикул') || h.includes('catalog')) newMap[index] = 'catalog_number';
       else if (h.includes('ціна') || h.includes('price') || h.includes('роздріб')) newMap[index] = 'price';
       else if (h.includes('закуп') || h.includes('base') || h.includes('вхід')) newMap[index] = 'base_price';
       else if (h.includes('назва') || h.includes('name') || h.includes('title') || h.includes('модель')) newMap[index] = 'title';
       else if (h.includes('бренд') || h.includes('виробник') || h.includes('manufacturer')) newMap[index] = 'manufacturer';
       else if (h.includes('радіус') || h.includes('radius') || h === 'r') newMap[index] = 'radius';
       else if (h.includes('сезон') || h.includes('season')) newMap[index] = 'season';
    });
    setExcelColumnMap(newMap);
  };

  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     setExcelFile(file);
     setShowExcelModal(true);
     setExcelPreview([]);
     setImportStatus('');
     setExcelColumnMap({});
     
     try {
        const rows = await readXlsxFile(file);
        setExcelPreview(rows.slice(0, 20));
        if (rows.length > 0) {
            autoMapColumns(rows[0].map(String));
        }
     } catch (e) {
        console.error("Error reading excel for preview", e);
        showError("Помилка читання файлу для попереднього перегляду");
     }
  };

  const handleExcelDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setExcelFile(file);
      setShowExcelModal(true);
      setExcelPreview([]);
      setImportStatus('');
      setExcelColumnMap({});
      try {
        const rows = await readXlsxFile(file);
        setExcelPreview(rows.slice(0, 20));
        if (rows.length > 0) {
            autoMapColumns(rows[0].map(String));
        }
      } catch (err) {
        showError("Помилка читання файлу");
      }
    }
  };

  const processSmartExcelImport = async () => {
    if (!excelFile) {
        showError("Файл не вибрано!");
        return;
    }
    setImportingExcel(true);
    setImportStatus("Зчитування та обробка файлу...");

    try {
        const mapValues = Object.values(excelColumnMap);
        if (!mapValues.includes('catalog_number')) {
            throw new Error("Не обрано колонку 'АРТИКУЛ'. Це обов'язкове поле для синхронізації.");
        }
        if (!mapValues.includes('price')) {
             throw new Error("Не обрано колонку 'ЦІНА'.");
        }

        const rows = (await readXlsxFile(excelFile)) as any[];
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
        const processedCats = new Set<string>();

        const fieldToColIndex: Record<string, number> = {};
        Object.entries(excelColumnMap).forEach(([idx, field]) => {
            if (field !== 'ignore') fieldToColIndex[String(field)] = parseInt(idx);
        });

        for (let i = excelStartRow - 1; i < rows.length; i++) {
            const row = rows[i] as any;
            const getValue = (fieldName: string) => {
                const idx = fieldToColIndex[fieldName];
                if (idx === undefined) return '';
                const val = row[idx];
                return val !== null && val !== undefined ? String(val).trim() : '';
            };
            
            const catNum = getValue('catalog_number');
            if (!catNum) continue;

            const normalizedCat = normalize(catNum);
            
            if (processedCats.has(normalizedCat)) continue;
            processedCats.add(normalizedCat);
            
            const manufacturer = getValue('manufacturer');
            const titleRaw = getValue('title');
            
            const rawBasePrice = getValue('base_price').replace(/,/g, '.').replace(/[^\d.]/g, '');
            const rawRetailPrice = getValue('price').replace(/,/g, '.').replace(/[^\d.]/g, '');
            
            const basePrice = rawBasePrice ? Math.round(parseFloat(rawBasePrice)).toString() : '0';
            const retailPrice = rawRetailPrice ? Math.round(parseFloat(rawRetailPrice)).toString() : '0';

            const existing = dbMap.get(normalizedCat);

            if (existing) {
                toUpdate.push({ 
                    id: existing.id,
                    price: retailPrice,
                    base_price: basePrice,
                    in_stock: true 
                });
            } else {
                let season = getValue('season') || 'all-season';
                if (!getValue('season')) {
                    const lowerTitle = titleRaw.toLowerCase();
                    if (lowerTitle.includes('winter') || lowerTitle.includes('зима') || lowerTitle.includes('ice')) season = 'winter';
                    else if (lowerTitle.includes('summer') || lowerTitle.includes('літо')) season = 'summer';
                }
                
                let radius = getValue('radius') || 'R15'; 
                let isCargo = false;

                const radMatch = titleRaw.match(/R\d{2}[C]?/i);
                if (radMatch) { 
                    const detectedR = radMatch[0].toUpperCase();
                    if (!getValue('radius')) radius = detectedR;
                    if (detectedR.includes('C')) isCargo = true;
                }
                if (radius.toUpperCase().includes('C')) isCargo = true;

                let vehicleType: 'car' | 'cargo' | 'suv' = 'car';
                const lowerTitle = titleRaw.toLowerCase();
                if (isCargo) {
                    vehicleType = 'cargo';
                } else if (lowerTitle.includes('suv') || lowerTitle.includes('jeep') || lowerTitle.includes('4x4')) {
                    vehicleType = 'suv';
                }

                toInsert.push({ 
                    catalog_number: catNum, 
                    manufacturer: manufacturer, 
                    title: manufacturer ? `${manufacturer} ${titleRaw}` : titleRaw, 
                    description: `Сезон: ${season}. ${isCargo ? 'Вантажні.' : ''}`, 
                    radius: radius, 
                    price: retailPrice, 
                    base_price: basePrice, 
                    in_stock: true,
                    vehicle_type: vehicleType 
                });
            }
        }

        const batchSize = 50;

        if (toInsert.length > 0) {
            for (let i = 0; i < toInsert.length; i += batchSize) {
                setImportStatus(`Створення нових карток: ${Math.min(i + batchSize, toInsert.length)} з ${toInsert.length}`);
                const chunk = toInsert.slice(i, i + batchSize);
                await supabase.from('tyres').insert(chunk);
            }
        }

        if (toUpdate.length > 0) {
            for (let i = 0; i < toUpdate.length; i += batchSize) {
                setImportStatus(`Оновлення цін: ${Math.min(i + batchSize, toUpdate.length)} з ${toUpdate.length}`);
                const chunk = toUpdate.slice(i, i + batchSize);
                await Promise.all(chunk.map((item: any) => 
                    supabase.from('tyres').update(item).eq('id', item.id)
                ));
            }
        }

        showError(`Розумне завантаження завершено! Створено: ${toInsert.length}, Оновлено цін: ${toUpdate.length}`); 
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

  const processBulkPriceUpdate = async (percent: number) => {
      setIsApplyingBulk(true);
      try {
          const factor = 1 + (percent / 100);
          const updateItem = async (item: any) => {
              const currentPrice = parseFloat(item.price);
              if (!isNaN(currentPrice)) {
                  const newPrice = Math.round(currentPrice * factor).toString();
                  await supabase.from('tyres').update({ price: newPrice }).eq('id', item.id);
              }
          };

          if (selectedTyreIds.size > 0) {
              // Update selected only
              const { data: items } = await supabase.from('tyres').select('id, price').in('id', Array.from(selectedTyreIds));
              if (items) {
                  for (const item of items) await updateItem(item);
                  showError(`Оновлено цін: ${items.length}`);
              }
          } else {
              // Update ALL matching current filters
              // We need to fetch IDs based on current filter state
              let query = supabase.from('tyres').select('id, price');
              // Re-apply filters from fetchTyres logic (simplified)
              if (tyreSearch.trim().length > 0) query = query.or(`title.ilike.%${tyreSearch.trim()}%,catalog_number.ilike.%${tyreSearch.trim()}%,radius.ilike.%${tyreSearch.trim()}%`);
              
              if (tyreCategoryTab === 'car') query = query.or('vehicle_type.eq.car,vehicle_type.is.null').neq('vehicle_type', 'cargo').neq('vehicle_type', 'suv').not('radius', 'ilike', '%C%').neq('in_stock', false);
              else if (tyreCategoryTab === 'cargo') query = query.or('vehicle_type.eq.cargo,radius.ilike.%C%').neq('in_stock', false);
              else if (tyreCategoryTab === 'suv') query = query.eq('vehicle_type', 'suv').neq('in_stock', false);
              else if (tyreCategoryTab === 'hot') query = query.eq('is_hot', true).neq('in_stock', false);
              else if (tyreCategoryTab === 'out_of_stock') query = query.eq('in_stock', false);
              else query = query.neq('in_stock', false);

              const { data: allItems } = await query;
              
              if (allItems && allItems.length > 0) {
                  // Confirm massive update if > 10 items
                  if (allItems.length > 10 && !confirm(`Ви збираєтесь змінити ціни для ${allItems.length} товарів. Продовжити?`)) {
                      setIsApplyingBulk(false);
                      return;
                  }
                  
                  const BATCH = 50;
                  for (let i = 0; i < allItems.length; i += BATCH) {
                      const chunk = allItems.slice(i, i + BATCH);
                      await Promise.all(chunk.map(updateItem));
                  }
                  showError(`Масово оновлено ${allItems.length} товарів.`);
              } else {
                  showError("Немає товарів для оновлення за поточними фільтрами.");
              }
          }
          
          fetchTyres(0, true);
          setSelectedTyreIds(new Set());
          setBulkMarkup('');
      } catch (e: any) {
          showError("Помилка: " + e.message);
      } finally {
          setIsApplyingBulk(false);
      }
  };

  const handleBulkPriceUpdate = (multiplier: number) => {
      if (!bulkMarkup) {
          showError("Введіть відсоток!");
          return;
      }
      const val = parseFloat(bulkMarkup.replace(',', '.'));
      if (isNaN(val)) return;
      processBulkPriceUpdate(val * multiplier);
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
          case 'out_of_stock': return `Немає в наявності (${categoryCounts.out})`;
          default: return `Всі Товари (${categoryCounts.all})`;
      }
  };

  const getStatusColor = (s: string) => {
    switch(s) {
        case 'new': return 'bg-green-600 text-white';
        case 'confirmed': return 'bg-blue-600 text-white';
        case 'shipped': return 'bg-purple-600 text-white';
        case 'completed': return 'bg-zinc-600 text-zinc-300';
        case 'cancelled': return 'bg-red-900/50 text-red-400 border border-red-900';
        default: return 'bg-zinc-700 text-zinc-300';
    }
  }

  const getStatusLabel = (s: string) => {
    switch(s) {
        case 'new': return 'Нове';
        case 'confirmed': return 'Підтверджено';
        case 'shipped': return 'Відправлено';
        case 'completed': return 'Виконано';
        case 'cancelled': return 'Скасовано';
        default: return s
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 pb-32">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black italic text-white flex items-center gap-2 uppercase"><Lock className="text-[#FFC300]" /> Панель керування</h1>
            <p className="text-zinc-500 text-sm font-mono mt-1">Режим: {mode === 'service' ? 'СЕРВІС (Графік)' : 'МАГАЗИН (Склад)'}</p>
          </div>
          <button onClick={onLogout} className="bg-zinc-800 text-white px-6 py-2 rounded-xl font-bold border border-zinc-700 hover:bg-red-900/50 hover:border-red-500 transition-colors flex items-center gap-2">
             <X size={16} /> Вихід
          </button>
       </div>

       {/* Tabs */}
       <div className="flex flex-wrap gap-2 mb-8 bg-zinc-900/50 p-2 rounded-xl border border-zinc-800">
          {['schedule', 'clients', 'gallery', 'prices', 'settings', 'tyres', 'orders', 'stats', 'articles'].map(tab => {
             if (mode === 'service' && !['schedule', 'clients', 'gallery', 'prices'].includes(tab)) return null;
             if (mode === 'tyre' && !['tyres', 'orders', 'stats', 'settings', 'articles'].includes(tab)) return null;
             
             const labels: any = { schedule: 'Графік', clients: 'Клієнти', gallery: 'Галерея', prices: 'Ціни', settings: 'Налаштування', tyres: 'Товари', orders: 'Замовлення', stats: 'Статистика', articles: 'Статті' };
             
             return (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab as any)}
                 className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === tab ? 'bg-[#FFC300] text-black shadow-lg' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
               >
                 {labels[tab] || tab}
               </button>
             );
          })}
       </div>

       {/* CONTENT */}
       <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6 min-h-[500px] relative">
          
          {/* SCHEDULE */}
          {activeTab === 'schedule' && (
             <div className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                   <h2 className="text-xl font-bold text-white flex items-center gap-2"><Calendar className="text-[#FFC300]" /> Графік запису</h2>
                   <button onClick={() => openAddModal(displayDate1)} className="bg-[#FFC300] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#e6b000]"><Plus size={18}/> Додати запис</button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-grow">
                    <div className="bg-black/30 rounded-xl border border-zinc-800 flex flex-col overflow-hidden h-[600px]">
                       <div className="p-3 bg-zinc-800/80 border-b border-zinc-700 font-bold text-[#FFC300] text-center">{displayDate1}</div>
                       {getDayTimeline(displayDate1, bookingsCol1)}
                    </div>
                    <div className="bg-black/30 rounded-xl border border-zinc-800 flex flex-col overflow-hidden h-[600px]">
                       <div className="p-3 bg-zinc-800/80 border-b border-zinc-700 font-bold text-zinc-300 text-center">{displayDate2}</div>
                       {getDayTimeline(displayDate2, bookingsCol2)}
                    </div>
                </div>
             </div>
          )}

          {/* TYRES */}
          {activeTab === 'tyres' && (
             <div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                   <div className="flex items-center gap-2">
                      <ShoppingBag className="text-[#FFC300]" size={24} />
                      <h2 className="text-xl font-bold text-white">Склад Шин ({stockStats.total} шт)</h2>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={handleSmartPhotoSortClick} className="bg-zinc-800 text-white px-3 py-2 rounded-lg text-sm font-bold border border-zinc-700 hover:border-[#FFC300]">Auto Photo</button>
                      <button onClick={handleAutoCategorizeClick} className="bg-zinc-800 text-white px-3 py-2 rounded-lg text-sm font-bold border border-zinc-700 hover:border-[#FFC300]">Auto Category</button>
                      <button onClick={() => setShowAddTyreModal(true)} className="bg-[#FFC300] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#e6b000]"><Plus size={18}/> Додати товар</button>
                   </div>
                </div>
                
                {/* Search & Categories */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                   <input type="text" placeholder="Пошук..." value={tyreSearch} onChange={e => setTyreSearch(e.target.value)} className="bg-black border border-zinc-700 rounded-lg p-3 text-white w-full md:w-64" />
                   <div className="flex gap-2 overflow-x-auto pb-2">
                      {['all', 'car', 'cargo', 'suv', 'hot', 'out_of_stock'].map(cat => (
                         <button key={cat} onClick={() => setTyreCategoryTab(cat as any)} className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap border ${tyreCategoryTab === cat ? 'bg-zinc-800 border-[#FFC300] text-[#FFC300]' : 'bg-black border-zinc-800 text-zinc-400'}`}>
                            {cat.toUpperCase()} ({ (categoryCounts as any)[cat === 'out_of_stock' ? 'out' : cat] })
                         </button>
                      ))}
                   </div>
                </div>

                {/* Tyres List */}
                <div className="space-y-2">
                   {tyres.map(tyre => (
                      <div key={tyre.id} className="bg-black/50 border border-zinc-800 p-3 rounded-xl flex items-center gap-4 hover:border-zinc-600 transition-colors">
                         <div className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                            {tyre.image_url ? <img src={tyre.image_url} className="w-full h-full object-cover" alt=""/> : <ImageIcon className="w-full h-full p-3 text-zinc-600"/>}
                         </div>
                         <div className="flex-grow">
                            <div className="font-bold text-white text-sm">{tyre.title}</div>
                            <div className="text-zinc-500 text-xs font-mono">{tyre.radius} | {tyre.price} грн {tyre.in_stock === false && <span className="text-red-500 font-bold ml-2">НЕМАЄ</span>}</div>
                         </div>
                         <button onClick={() => openEditTyreModal(tyre)} className="p-2 hover:bg-zinc-800 rounded-lg text-blue-400"><Edit2 size={18}/></button>
                         <button onClick={() => { setBookingToDelete(tyre.id); setShowDeleteModal(true); }} className="p-2 hover:bg-zinc-800 rounded-lg text-red-400"><Trash2 size={18}/></button>
                      </div>
                   ))}
                   {hasMoreTyres && <button onClick={() => fetchTyres(tyrePage + 1)} className="w-full py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl mt-4 hover:text-white">Завантажити ще...</button>}
                </div>
             </div>
          )}

          {/* OTHER TABS PLACEHOLDER */}
          {!['schedule', 'tyres'].includes(activeTab) && (
             <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                <Settings size={48} className="mb-4 opacity-20" />
                <p>Розділ {activeTab} доступний, але інтерфейс спрощено для відновлення.</p>
             </div>
          )}
          
       </div>

       {/* MODALS */}
       {showEditModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
             <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold text-white mb-4">{bookingForm.id ? 'Редагувати' : 'Новий запис'}</h3>
                <div className="space-y-3">
                   <input type="text" placeholder="Ім'я" value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white" />
                   <input type="tel" placeholder="Телефон" value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white" />
                   <div className="flex gap-2">
                      <input type="date" value={bookingForm.date} onChange={e => setBookingForm({...bookingForm, date: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white" />
                      <input type="time" value={bookingForm.time} onChange={e => setBookingForm({...bookingForm, time: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white" />
                   </div>
                   <select value={bookingForm.serviceId} onChange={e => setBookingForm({...bookingForm, serviceId: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white">
                      {BOOKING_SERVICES.map(s => <option key={s.id} value={s.id}>{s.label} ({s.duration} хв)</option>)}
                   </select>
                </div>
                <div className="flex gap-2 mt-6">
                   <button onClick={() => setShowEditModal(false)} className="flex-1 bg-zinc-800 text-white py-3 rounded-lg font-bold">Скасувати</button>
                   <button onClick={handleSaveBooking} className="flex-1 bg-[#FFC300] text-black py-3 rounded-lg font-bold">Зберегти</button>
                </div>
             </div>
          </div>
       )}

       {showDeleteModal && (
         <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm text-center">
               <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
               <h3 className="text-xl font-bold text-white mb-2">Видалити?</h3>
               <p className="text-zinc-400 mb-6">Цю дію неможливо скасувати.</p>
               <div className="flex gap-2">
                  <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-zinc-800 text-white py-3 rounded-lg font-bold">Ні</button>
                  <button onClick={mode === 'tyre' ? handleDeleteTyre : handleDeleteBooking} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold">Так, видалити</button>
               </div>
            </div>
         </div>
       )}

       {/* ADD TYRE MODAL (Simplified for restoration) */}
       {showAddTyreModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
             <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-white mb-4">{editingTyreId ? 'Редагувати товар' : 'Новий товар'}</h3>
                <div className="space-y-3">
                   <input type="text" placeholder="Виробник" value={tyreForm.manufacturer} onChange={e => setTyreForm({...tyreForm, manufacturer: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white" />
                   <input type="text" placeholder="Назва моделі" value={tyreForm.name} onChange={e => setTyreForm({...tyreForm, name: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white" />
                   <div className="flex gap-2">
                      <select value={tyreForm.radius} onChange={e => setTyreForm({...tyreForm, radius: e.target.value})} className="flex-1 bg-black border border-zinc-700 rounded-lg p-3 text-white">
                         {WHEEL_RADII.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select value={tyreForm.season} onChange={e => setTyreForm({...tyreForm, season: e.target.value})} className="flex-1 bg-black border border-zinc-700 rounded-lg p-3 text-white">
                         <option value="winter">Зима</option>
                         <option value="summer">Літо</option>
                         <option value="all-season">Всесезон</option>
                      </select>
                   </div>
                   <input type="text" placeholder="Ціна" value={tyreForm.price} onChange={e => setTyreForm({...tyreForm, price: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white" />
                   <textarea placeholder="Опис" value={tyreForm.description} onChange={e => setTyreForm({...tyreForm, description: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white h-24" />
                   
                   <div>
                      <label className="text-zinc-400 text-sm block mb-1">Фото:</label>
                      <input type="file" multiple onChange={e => setTyreUploadFiles(Array.from(e.target.files || []))} className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-sm" />
                   </div>
                </div>
                <div className="flex gap-2 mt-6">
                   <button onClick={() => setShowAddTyreModal(false)} className="flex-1 bg-zinc-800 text-white py-3 rounded-lg font-bold">Скасувати</button>
                   <button onClick={handleSaveTyre} disabled={uploading} className="flex-1 bg-[#FFC300] text-black py-3 rounded-lg font-bold">{uploading ? 'Збереження...' : 'Зберегти'}</button>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};

export default AdminPanel;
