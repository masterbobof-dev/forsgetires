import React from 'react';
import { SERVICES } from '../constants';

const Services: React.FC = () => {
  return (
    <section className="py-12 bg-[#09090b]">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-black text-white mb-8 border-b-2 border-[#FFC300] inline-block pb-2">
          Наші Послуги
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SERVICES.map((service) => (
            <div 
              key={service.id} 
              className="flex items-center gap-4 p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] transition-all duration-300 hover:bg-zinc-800 group"
            >
              <div className="bg-zinc-950 p-3 rounded-full border border-zinc-800 group-hover:border-[#FFC300] transition-colors">
                <service.icon className="w-8 h-8 text-[#FFC300]" />
              </div>
              <span className="text-xl font-bold text-zinc-100 group-hover:text-white leading-tight">
                {service.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;