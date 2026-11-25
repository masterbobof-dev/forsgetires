import React from 'react';
import { Briefcase, Plus, PackageX, Trash2 } from 'lucide-react';
import type { Suppliers } from './useSuppliers';

/** Part "Постачальники": the list, adding, and the buttons that open the deletion window. */
const SuppliersPanel: React.FC<{ supp: Suppliers }> = ({ supp }) => {
  const {
    newSupplierName, setNewSupplierName, handleAddSupplier, suppliers, supplierCounts, initiateDelete,
  } = supp;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><Briefcase className="text-[#FFC300]" size={20}/> Керування Постачальниками</h4>
        <div className="flex gap-2 sm:gap-4 mb-6">
            <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Назва постачальника" className="bg-black border border-zinc-700 rounded-lg p-3 text-white flex-1 min-w-0 font-bold" />
            <button onClick={handleAddSupplier} className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 sm:px-6 py-3 rounded-lg flex items-center gap-2 justify-center"><Plus size={18} /> Додати</button>
        </div>
        <div className="grid grid-cols-1 gap-3">
            {suppliers.map(s => {
                const count = supplierCounts[s.id] || 0;
                return (
                    <div key={s.id} className="bg-black/40 p-4 rounded-xl border border-zinc-800 flex justify-between items-center hover:border-zinc-600 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="bg-zinc-800 p-2 rounded-lg text-zinc-400">
                                <Briefcase size={20}/>
                            </div>
                            <div>
                                <h5 className="font-bold text-white text-lg">{s.name}</h5>
                                <span className={`text-xs px-2 py-0.5 rounded font-bold ${count > 0 ? 'bg-green-900/30 text-green-400 border border-green-900/50' : 'bg-zinc-800 text-zinc-500'}`}>
                                    {count} позицій
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => initiateDelete('products_only', s.id, s.name)} className="p-2 bg-zinc-800 text-zinc-400 hover:text-orange-500 hover:bg-orange-900/20 rounded-lg border border-zinc-700 hover:border-orange-500 transition-all" title="Очистити склад" disabled={count === 0}><PackageX size={20}/></button>
                            <button onClick={() => initiateDelete('full_supplier', s.id, s.name)} className="p-2 bg-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-red-900/20 rounded-lg border border-zinc-700 hover:border-red-500 transition-all" title="Видалити постачальника"><Trash2 size={20}/></button>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default SuppliersPanel;
