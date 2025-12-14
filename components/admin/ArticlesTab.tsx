
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Article } from '../../types';
import { Lightbulb, Plus, Edit2, Trash2, X, Save, FileText, Loader2, AlertTriangle } from 'lucide-react';

const ArticlesTab: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [articleForm, setArticleForm] = useState({ title: '', content: '', image: null as File | null, image_url: '' });
  const [uploading, setUploading] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);

  // Custom Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<number | null>(null);

  useEffect(() => { fetchArticles(); }, []);

  const fetchArticles = async () => { const { data } = await supabase.from('articles').select('*').order('created_at', { ascending: false }); if (data) setArticles(data); };

  const handleSave = async () => {
    if (!articleForm.title || !articleForm.content) return;
    setUploading(true);
    try {
      let finalImageUrl = articleForm.image_url;
      if (articleForm.image) {
        const fileName = `article_${Date.now()}`;
        await supabase.storage.from('galery').upload(fileName, articleForm.image);
        const { data } = supabase.storage.from('galery').getPublicUrl(fileName);
        finalImageUrl = data.publicUrl;
      }
      const payload = { title: articleForm.title, content: articleForm.content, image_url: finalImageUrl };
      if (editingArticle) await supabase.from('articles').update(payload).eq('id', editingArticle.id);
      else await supabase.from('articles').insert([payload]);
      setShowModal(false); fetchArticles();
    } catch (e: any) { alert(e.message); } finally { setUploading(false); }
  };

  const initiateDelete = (id: number) => {
      setArticleToDelete(id);
      setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
      if (!articleToDelete) return;
      await supabase.from('articles').delete().eq('id', articleToDelete);
      fetchArticles();
      setShowDeleteConfirm(false);
      setArticleToDelete(null);
  };

  return (
    <div className="animate-in fade-in">
       <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white flex items-center gap-2"><Lightbulb className="text-[#FFC300]"/> Статті</h3><button onClick={() => { setEditingArticle(null); setArticleForm({ title: '', content: '', image: null, image_url: '' }); setShowModal(true); }} className="bg-[#FFC300] text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={18}/> Нова стаття</button></div>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{articles.map(article => (<div key={article.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group relative"><div className="h-40 bg-black">{article.image_url ? <img src={article.image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><FileText size={40} className="text-zinc-700"/></div>}</div><div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100"><button onClick={() => { setEditingArticle(article); setArticleForm({ title: article.title, content: article.content, image: null, image_url: article.image_url || '' }); setShowModal(true); }} className="p-2 bg-blue-600 text-white rounded"><Edit2 size={16}/></button><button onClick={() => initiateDelete(article.id)} className="p-2 bg-red-600 text-white rounded"><Trash2 size={16}/></button></div><div className="p-4"><h4 className="font-bold text-white mb-2 line-clamp-2">{article.title}</h4><p className="text-zinc-400 text-sm line-clamp-3">{article.content}</p></div></div>))}</div>
       
       {showModal && (<div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"><div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="flex justify-between mb-4"><h3 className="text-xl font-bold text-white">{editingArticle ? 'Редагування' : 'Нова стаття'}</h3><button onClick={() => setShowModal(false)}><X/></button></div><div className="space-y-4"><input value={articleForm.title} onChange={e => setArticleForm({...articleForm, title: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-3 text-white font-bold" placeholder="Заголовок" /><textarea value={articleForm.content} onChange={e => setArticleForm({...articleForm, content: e.target.value})} className="w-full bg-black border border-zinc-700 rounded p-3 text-white h-40" placeholder="Текст" /><div className="flex gap-2"><input value={articleForm.image_url} onChange={e => setArticleForm({...articleForm, image_url: e.target.value})} placeholder="URL фото" className="flex-grow bg-black border border-zinc-700 rounded p-3 text-white" /><button onClick={() => imageRef.current?.click()} className="bg-zinc-800 px-4 rounded border border-zinc-700 text-white font-bold">Файл</button><input type="file" ref={imageRef} className="hidden" onChange={e => e.target.files && setArticleForm({...articleForm, image: e.target.files[0]})} /></div><button onClick={handleSave} disabled={uploading} className="w-full bg-[#FFC300] text-black font-black py-4 rounded-xl hover:bg-[#e6b000]">{uploading ? <Loader2 className="animate-spin mx-auto"/> : 'Зберегти'}</button></div></div></div>)}

       {/* Delete Confirmation Modal */}
       {showDeleteConfirm && (
           <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm text-center">
                   <AlertTriangle size={48} className="mx-auto text-red-500 mb-4"/>
                   <h3 className="text-xl font-bold text-white mb-2">Видалити статтю?</h3>
                   <p className="text-zinc-400 mb-6 text-sm">Дію неможливо скасувати.</p>
                   <div className="flex gap-3">
                       <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl">Скасувати</button>
                       <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl">Видалити</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default ArticlesTab;
