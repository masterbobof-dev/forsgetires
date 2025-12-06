
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Article } from '../types';
import { Lightbulb, ChevronRight, ChevronLeft, X, Calendar } from 'lucide-react';

const Tips: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      const { data } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setArticles(data);
    };
    fetchArticles();
  }, []);

  const handleScroll = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      if (e.deltaY !== 0) {
         scrollRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.firstChild instanceof HTMLElement ? scrollRef.current.firstChild.clientWidth : 300;
      scrollRef.current.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.firstChild instanceof HTMLElement ? scrollRef.current.firstChild.clientWidth : 300;
      scrollRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
    }
  };

  if (articles.length === 0) return null;

  return (
    <section className="py-12 bg-[#0c0c0e] border-t border-zinc-900">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-8">
           <Lightbulb className="text-[#FFC300] w-8 h-8" />
           <h2 className="text-3xl font-black text-white border-b-2 border-[#FFC300] inline-block pb-2">
             Корисні Поради
           </h2>
        </div>

        <div className="relative group">
            {/* Left Arrow (Desktop Only) */}
            <button 
              onClick={scrollLeft} 
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-black/80 rounded-full border border-zinc-700 items-center justify-center text-white hover:bg-[#FFC300] hover:text-black hover:border-[#FFC300] transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 -translate-x-1/2 duration-300"
            >
                <ChevronLeft size={28} />
            </button>

            {/* Right Arrow (Desktop Only) */}
            <button 
              onClick={scrollRight} 
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-black/80 rounded-full border border-zinc-700 items-center justify-center text-white hover:bg-[#FFC300] hover:text-black hover:border-[#FFC300] transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 translate-x-1/2 duration-300"
            >
                <ChevronRight size={28} />
            </button>

            <div 
              ref={scrollRef}
              onWheel={handleScroll}
              className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory cursor-grab active:cursor-grabbing px-1"
            >
              {articles.map((article) => (
                <div 
                  key={article.id} 
                  className="flex-shrink-0 w-[45%] md:w-[32%] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-[#FFC300] transition-all group/card flex flex-col h-auto snap-start select-none"
                >
                  <div className="h-32 md:h-48 overflow-hidden relative">
                    {article.image_url ? (
                      <img 
                        src={article.image_url} 
                        alt={article.title} 
                        className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                        draggable="false"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600">
                        <Lightbulb size={32} />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-zinc-300 text-[10px] md:text-xs px-2 py-1 rounded flex items-center gap-1">
                      <Calendar size={10} /> {new Date(article.created_at).toLocaleDateString('uk-UA')}
                    </div>
                  </div>
                  
                  <div className="p-4 flex flex-col flex-grow">
                    <h3 className="text-sm md:text-xl font-bold text-white mb-2 line-clamp-2 leading-tight">{article.title}</h3>
                    <p className="text-zinc-400 text-xs md:text-sm line-clamp-3 mb-4 flex-grow leading-relaxed">
                      {article.content}
                    </p>
                    <button 
                      onClick={() => setSelectedArticle(article)}
                      className="mt-auto flex items-center gap-2 text-[#FFC300] font-bold text-xs md:text-sm hover:underline"
                    >
                      Читати повністю <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
        </div>
      </div>

      {/* Article Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedArticle(null)}>
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl relative shadow-2xl flex flex-col max-h-[90vh]" 
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setSelectedArticle(null)} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-[#FFC300] hover:text-black transition-colors z-10">
              <X size={24} />
            </button>
            
            <div className="overflow-y-auto custom-scrollbar">
               {selectedArticle.image_url && (
                 <div className="w-full h-64 md:h-80 relative">
                    <img src={selectedArticle.image_url} className="w-full h-full object-cover" alt={selectedArticle.title} />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent"></div>
                 </div>
               )}
               
               <div className="p-6 md:p-10 relative">
                  <h3 className="text-2xl md:text-4xl font-black text-white mb-6 leading-tight">
                    {selectedArticle.title}
                  </h3>
                  <div className="prose prose-invert prose-lg max-w-none text-zinc-300 whitespace-pre-line text-sm md:text-base">
                    {selectedArticle.content}
                  </div>
                  <div className="mt-8 pt-6 border-t border-zinc-800 text-zinc-500 text-sm">
                     Опубліковано: {new Date(selectedArticle.created_at).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Tips;
