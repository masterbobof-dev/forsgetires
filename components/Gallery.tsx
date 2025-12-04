
import React, { useState, useEffect } from 'react';
import { X, ZoomIn, Image as ImageIcon } from 'lucide-react';
import { GALLERY_IMAGES } from '../constants';
import { supabase } from '../supabaseClient';

const Gallery: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dbImages, setDbImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase
        .from('gallery')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data && data.length > 0) {
        setDbImages(data);
      }
    } catch (error) {
      console.error("Error fetching gallery:", error);
    } finally {
      setLoading(false);
    }
  };

  // Use DB images if available, otherwise fallback to constants
  const displayImages = dbImages.length > 0 
    ? dbImages.map(img => ({ src: img.url, alt: img.description || 'Фото шиномонтажу' })) 
    : GALLERY_IMAGES;

  return (
    <div className="min-h-screen bg-[#09090b] py-12 animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-8 border-b-2 border-[#FFC300] inline-block pb-2">
          Фотогалерея
        </h2>
        
        <p className="text-zinc-400 mb-8 max-w-2xl">
          Ознайомтеся з нашим сервісом, сучасним обладнанням та комфортними умовами для клієнтів.
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
             <div className="animate-spin text-[#FFC300]"><ImageIcon size={48} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayImages.map((img, index) => (
              <div 
                key={index} 
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 cursor-pointer"
                onClick={() => setSelectedImage(img.src)}
              >
                <img 
                  src={img.src} 
                  alt={img.alt} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="bg-[#FFC300] text-black p-3 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <ZoomIn size={24} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-[#FFC300] transition-colors p-2"
            onClick={() => setSelectedImage(null)}
          >
            <X size={40} />
          </button>
          
          <img 
            src={selectedImage} 
            alt="Full size view" 
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
};

export default Gallery;
