import React from 'react';
import { FolderOpen, X } from 'lucide-react';
import CategoriesTab from '../CategoriesTab';
import VehiclesPanel from '../VehiclesPanel';

/** Window with the full sections editor (names, subsections, order, descriptions, questions-answers) and the cars for the car picker. */
export const CategoriesEditor: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[200] flex">
    <div className="absolute inset-0 bg-black/80" onClick={onClose} />
    <div className="relative ml-auto w-full max-w-5xl h-full bg-zinc-950 border-l border-zinc-800 overflow-y-auto p-3 md:p-6 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black uppercase flex items-center gap-2"><FolderOpen className="text-[#FFC300]" /> Категорії і підкатегорії</h2>
        <button onClick={onClose} aria-label="Закрити" className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800"><X size={22} /></button>
      </div>
      <CategoriesTab />
      <VehiclesPanel />
    </div>
  </div>
);


