
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Article } from '../types';
import { Lightbulb, ChevronRight, X, Calendar } from 'lucide-react';

const Tips: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <div 
              key={article.id} 
              className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-[#FFC300] transition-all group flex flex-col h-full"
            >
              <div className="h-48 overflow-hidden relative">
                {article.image_url ? (
                  <img 
                    src={article.image_url} 
                    alt={article.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600">
                    <Lightbulb size={48} />
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-zinc-300 text-xs px-2 py-1 rounded flex items-center gap-1">
                   <Calendar size={12} /> {new Date(article.created_at).toLocaleDateString('uk-UA')}
                </div>
              </div>
              
              <div className="p-5 flex flex-col flex-grow">
                <h3 className="text-xl font-bold text-white mb-3 line-clamp-2">{article.title}</h3>
                <p className="text-zinc-400 text-sm line-clamp-3 mb-4 flex-grow">
                  {article.content}
                </p>
                <button 
                  onClick={() => setSelectedArticle(article)}
                  className="mt-auto flex items-center gap-2 text-[#FFC300] font-bold text-sm hover:underline"
                >
                  Читати повністю <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
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
                  <div className="prose prose-invert prose-lg max-w-none text-zinc-300 whitespace-pre-line">
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
