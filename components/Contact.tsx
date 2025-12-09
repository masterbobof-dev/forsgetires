
import React, { useState, useEffect } from 'react';
import { PhoneCall, MapPin, Navigation } from 'lucide-react';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, PHONE_LINK_1, PHONE_LINK_2, MAP_EMBED_URL, MAP_DIRECT_LINK } from '../constants';
import { supabase } from '../supabaseClient';

const Contact: React.FC = () => {
  const [contacts, setContacts] = useState({
      p1: PHONE_NUMBER_1,
      p2: PHONE_NUMBER_2,
      link1: PHONE_LINK_1,
      link2: PHONE_LINK_2,
      mapLink: MAP_DIRECT_LINK
  });

  useEffect(() => {
      const fetchContacts = async () => {
          const { data } = await supabase.from('settings').select('key, value').in('key', ['contact_phone1', 'contact_phone2', 'contact_map_link']);
          if (data) {
              const newContacts = { ...contacts };
              data.forEach(r => {
                  if (r.key === 'contact_phone1') {
                      newContacts.p1 = r.value;
                      newContacts.link1 = `tel:${r.value.replace(/[^\d+]/g, '')}`;
                  }
                  if (r.key === 'contact_phone2') {
                      newContacts.p2 = r.value;
                      newContacts.link2 = `tel:${r.value.replace(/[^\d+]/g, '')}`;
                  }
                  if (r.key === 'contact_map_link') {
                      newContacts.mapLink = r.value;
                  }
              });
              setContacts(newContacts);
          }
      };
      fetchContacts();
  }, []);

  return (
    <section className="py-12 bg-[#09090b] pb-24">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-black text-white mb-8 border-b-2 border-[#FFC300] inline-block pb-2">
          Контакти та Адреса
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Phone Numbers */}
          <div className="space-y-6">
             <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                <div className="flex items-center gap-3 mb-4 text-zinc-400">
                  <PhoneCall className="w-5 h-5" />
                  <h3 className="uppercase tracking-widest text-sm font-bold">Телефонуйте</h3>
                </div>
                
                <div className="flex flex-col gap-4">
                  <a href={contacts.link1} className="block w-full">
                    <button className="w-full py-4 px-6 bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-2xl rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-yellow-900/20">
                      <PhoneCall className="w-6 h-6" />
                      {contacts.p1}
                    </button>
                  </a>
                  <a href={contacts.link2} className="block w-full">
                    <button className="w-full py-4 px-6 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-2xl rounded-xl border border-zinc-600 transition-transform active:scale-95 flex items-center justify-center gap-3">
                      <PhoneCall className="w-6 h-6 text-[#FFC300]" />
                      {contacts.p2}
                    </button>
                  </a>
                </div>
             </div>

             <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
               <div className="flex items-center gap-3 mb-4 text-zinc-400">
                  <MapPin className="w-5 h-5" />
                  <h3 className="uppercase tracking-widest text-sm font-bold">Навігація</h3>
               </div>
               <a href={contacts.mapLink} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <button className="w-full py-4 px-6 bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-xl rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-3 animate-pulse">
                    <Navigation className="w-6 h-6" />
                    ПРОКЛАСТИ МАРШРУТ
                  </button>
               </a>
             </div>
          </div>

          {/* Map */}
          <div className="h-[300px] md:h-auto bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-700 relative group">
            <iframe 
              src={MAP_EMBED_URL}
              width="100%" 
              height="100%" 
              style={{ border: 0, filter: 'grayscale(100%) invert(90%) contrast(85%)' }} 
              allowFullScreen={true} 
              loading="lazy" 
              className="absolute inset-0 w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500"
            ></iframe>
            <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded text-xs text-zinc-400 pointer-events-none">
              Міні-карта
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
