import React from 'react';
import { X, Info } from 'lucide-react';

/** "How to read a tyre size" explainer with a drawing of the sidewall marking. */
const SizeGuideModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  if (!open) return null;
  const parts = [
    { code: '205', color: '#FFC300', title: 'Ширина', text: 'Ширина шини в міліметрах.' },
    { code: '55', color: '#60A5FA', title: 'Висота профілю', text: 'Висота боковини у % від ширини (55% від 205 мм ≈ 113 мм).' },
    { code: 'R16', color: '#34D399', title: 'Радіус', text: 'Діаметр диска в дюймах. Має збігатися з вашими дисками.' },
    { code: '91', color: '#F472B6', title: 'Індекс навантаження', text: 'Максимальна вага на одну шину: 91 = до 615 кг.' },
    { code: 'V', color: '#A78BFA', title: 'Індекс швидкості', text: 'Максимальна швидкість: T — 190, H — 210, V — 240 км/год.' },
  ];
  return (
    <div className="fixed inset-0 z-[185] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 sm:p-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-8 duration-300" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Як прочитати розмір шини">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black uppercase flex items-center gap-2"><Info className="text-[#FFC300]" size={20} /> Як прочитати розмір шини</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white" aria-label="Закрити"><X size={20} /></button>
        </div>

        <div className="bg-black rounded-2xl p-5 mb-4 text-center">
          <p className="text-zinc-500 text-xs mb-2">Знайдіть на боковині своєї шини напис:</p>
          <p className="text-3xl sm:text-4xl font-black tracking-wide">
            {[['205', '#FFC300'], ['/'], ['55', '#60A5FA'], [' '], ['R16', '#34D399'], [' '], ['91', '#F472B6'], ['V', '#A78BFA']].map(([t, c], i) => (
              <span key={i} style={c ? { color: c } : { color: '#71717a' }}>{t}</span>
            ))}
          </p>
        </div>

        <ul className="space-y-2.5">
          {parts.map(p => (
            <li key={p.code} className="flex gap-3 items-start">
              <span className="min-w-[52px] text-center font-black rounded-lg px-2 py-1 text-black text-sm" style={{ background: p.color }}>{p.code}</span>
              <span className="text-sm"><b className="text-white">{p.title}.</b> <span className="text-zinc-400">{p.text}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-zinc-500">Літера <b className="text-zinc-300">C</b> після радіуса (R16C) — шина для бусів і легковантажних авто. <b className="text-zinc-300">XL</b> — посилена шина з більшим навантаженням.</p>
        <p className="mt-2 text-xs text-zinc-500">Не знайшли розмір? Подзвоніть нам — підберемо за маркою авто.</p>
      </div>
    </div>
  );
};

export default SizeGuideModal;
