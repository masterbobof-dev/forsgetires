import React from 'react';
import { Trash2 } from 'lucide-react';

/** "Видалити?" for one product. */
export const DeleteModal: React.FC<{ onCancel: () => void; onConfirm: () => void }> = ({ onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
     <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl"><h3 className="text-xl font-bold text-white mb-4">Видалити?</h3><div className="flex gap-4"><button onClick={onCancel} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold">Ні</button><button onClick={onConfirm} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Так</button></div></div>
  </div>
);

/** "Видалити N товарів?" for the ticked products. */
export const BulkDeleteModal: React.FC<{ count: number; onCancel: () => void; onConfirm: () => void }> = ({ count, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
     <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl text-center">
         <div className="bg-red-900/20 p-4 rounded-full text-red-500 mb-4 border border-red-900/50 w-16 h-16 flex items-center justify-center mx-auto">
              <Trash2 size={32} />
         </div>
         <h3 className="text-xl font-bold text-white mb-2">Видалити {count} товарів?</h3>
         <p className="text-zinc-400 text-sm mb-6">Цю дію неможливо скасувати. Товари будуть видалені з бази назавжди.</p>
         <div className="flex gap-4">
             <button onClick={onCancel} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold border border-zinc-700 hover:bg-zinc-700 transition-colors">Скасувати</button>
             <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20">Видалити</button>
         </div>
     </div>
  </div>
);
