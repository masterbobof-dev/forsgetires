
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Upload, Trash2, Loader2 } from 'lucide-react';

const GalleryTab: React.FC = () => {
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchGallery(); }, []);

  const fetchGallery = async () => { const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false }); if (data) setGalleryImages(data); };
  
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const fileName = `gallery_${Date.now()}`;
      const { error } = await supabase.storage.from('galery').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('galery').getPublicUrl(fileName);
      await supabase.from('gallery').insert([{ url: data.publicUrl, description: 'Uploaded via Admin' }]);
      fetchGallery();
    } catch (err: any) { alert(err.message); } finally { setUploading(false); }
  };

  const deleteGalleryImage = async (id: number) => { await supabase.from('gallery').delete().eq('id', id); fetchGallery(); };

  return (
    <div className="animate-in fade-in">
       <div className="mb-6 flex justify-between items-center"><h3 className="text-xl font-bold">Галерея</h3><div className="relative"><button onClick={() => galleryInputRef.current?.click()} className="bg-[#FFC300] text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#e6b000]">{uploading ? <Loader2 className="animate-spin" /> : <Upload size={18}/>} Завантажити</button><input type="file" ref={galleryInputRef} onChange={handleGalleryUpload} className="hidden" accept="image/*" /></div></div>
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{galleryImages.map(img => (<div key={img.id} className="relative group rounded-xl overflow-hidden aspect-square border border-zinc-800"><img src={img.url} className="w-full h-full object-cover" /><button onClick={() => deleteGalleryImage(img.id)} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100"><Trash2 size={20}/></button></div>))}</div>
    </div>
  );
};

export default GalleryTab;
