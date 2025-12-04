import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-black py-6 border-t border-white/10 text-center">
      <p className="text-zinc-500 text-sm">
        © {new Date().getFullYear()} Шиномонтаж F. Всі права захищено.
      </p>
    </footer>
  );
};

export default Footer;