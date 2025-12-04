import React from 'react';
import { Hammer } from 'lucide-react';

interface PlaceholderProps {
  title: string;
}

const Placeholder: React.FC<PlaceholderProps> = ({ title }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-[#09090b]">
      <div className="bg-zinc-900 p-8 rounded-full mb-6 animate-bounce">
        <Hammer className="w-16 h-16 text-[#FFC300]" />
      </div>
      <h2 className="text-4xl font-black text-white mb-4">{title}</h2>
      <p className="text-zinc-400 text-lg max-w-md">
        Цей розділ знаходиться в стадії наповнення. Будь ласка, зателефонуйте нам для отримання актуальної інформації.
      </p>
    </div>
  );
};

export default Placeholder;