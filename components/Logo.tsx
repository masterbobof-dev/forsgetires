import React from 'react';

const Logo: React.FC = () => {
  return (
    <div 
      className="cursor-pointer group relative flex items-center justify-center w-12 h-12 bg-[#FFC300] rounded-xl transform -skew-x-12 hover:scale-105 transition-transform duration-300 shadow-lg shadow-yellow-900/20"
    >
      <span className="text-black font-black text-3xl transform skew-x-12 select-none">
        F
      </span>
    </div>
  );
};

export default Logo;