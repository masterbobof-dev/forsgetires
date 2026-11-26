import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import type { Suppliers } from './useSuppliers';

interface SupplierDeleteModalProps {
  supp: Suppliers;
  /** what is about to be deleted (the window is shown only when this is known) */
  deleteData: NonNullable<Suppliers['deleteData']>;
}

/** The window that asks for a confirmation code before the goods of a supplier (or the supplier too) are deleted. */
const SupplierDeleteModal: React.FC<SupplierDeleteModalProps> = ({ supp, deleteData }) => {
  const { setShowDeleteModal, deleteMode, generatedCode, inputCode, setInputCode, executeDelete, isDeleting } = supp;

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl flex flex-col items-center text-center">
            <button onClick={() => setShowDeleteModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24}/></button>
            <div className="bg-red-900/20 p-4 rounded-full text-red-500 mb-4 border border-red-900/50"><AlertTriangle size={40} /></div>
            <h3 className="text-xl font-black text-white mb-2">{deleteMode === 'products_only' ? 'Очищення Складу' : 'Видалення Постачальника'}</h3>
            <p className="text-zinc-400 text-sm mb-4">{deleteMode === 'products_only' ? <>Ви збираєтесь видалити <span className="text-white font-bold">{deleteData.count}</span> товарів від постачальника <span className="text-[#FFC300]">{deleteData.name}</span>.</> : <>Увага! Видалення постачальника <span className="text-[#FFC300]">{deleteData.name}</span> призведе до видалення всіх його товарів (<span className="text-white font-bold">{deleteData.count} шт.</span>).</>}<br/><br/><span className="text-red-400 font-bold uppercase">Цю дію неможливо скасувати!</span></p>
            <div className="bg-black border border-zinc-700 rounded-xl p-4 mb-4 w-full"><p className="text-xs text-zinc-500 uppercase font-bold mb-1">Код підтвердження:</p><p className="text-3xl font-mono font-black text-[#FFC300] tracking-widest">{generatedCode}</p></div>
            <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value)} placeholder="Введіть код" className="w-full bg-zinc-800 border border-zinc-600 rounded-xl p-3 text-center text-white font-bold text-lg mb-4 outline-none focus:border-red-500"/>
            <button onClick={executeDelete} disabled={inputCode !== generatedCode || isDeleting} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">{isDeleting ? <Loader2 className="animate-spin" /> : (deleteMode === 'products_only' ? 'ВИДАЛИТИ ТОВАРИ' : 'ВИДАЛИТИ ВСЕ')}</button>
        </div>
    </div>
  );
};

export default SupplierDeleteModal;
