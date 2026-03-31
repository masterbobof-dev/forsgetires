
import React from 'react';
import { MapPin, ShieldCheck, Clock, Award } from 'lucide-react';

const SeoContentBlock: React.FC = () => {
    return (
        <section className="max-w-6xl mx-auto px-4 py-20 border-t border-zinc-800/50">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <h2 className="text-3xl font-black text-white uppercase italic leading-tight mb-6">
                            Купити шини у <span className="text-[#FFC300]">Дніпрі, Синельниковому</span> та області
                        </h2>
                        <div className="space-y-4 text-zinc-400 leading-relaxed text-sm md:text-base">
                            <p>
                                Ласкаво просимо до спеціалізованого магазину та шиномонтажу <strong>Форсаж</strong>. Ми є лідерами у сфері обслуговування коліс у Дніпропетровській області, пропонуючи повний спектр послуг від професійного підбору гуми до складного ремонту дисків.
                            </p>
                            <p>
                                Наш асортимент включає сотні моделей шин від провідних світових брендів: Michelin, Continental, Bridgestone, Hankook та багато інших. Шукаєте ви <em>літні шини</em> для комфортних поїздок по Дніпру чи надійну <em>зимову гуму</em> для засніжених доріг області — у нас ви знайдете ідеальний варіант за найкращою ціною.
                            </p>
                            <p>
                                Ми розуміємо, що безпека на дорозі не терпить зволікань, тому наш <strong>шиномонтаж працює цілодобово (24/7)</strong> у місті Синельникове. Ми обслуговуємо легковий, вантажний та агро-транспорт, забезпечуючи швидкий та якісний сервіс у будь-який час доби.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                <Award className="text-[#FFC300]" size={20}/> Чому обирають нас?
                            </h3>
                            <ul className="text-zinc-500 text-sm space-y-2">
                                <li>• Величезний склад шин у наявності</li>
                                <li>• Професійне обладнання для балансування</li>
                                <li>• Зварювання аргоном та рихтування дисків</li>
                                <li>• Гарантія на всі види робіт</li>
                            </ul>
                        </div>
                        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                <MapPin className="text-[#FFC300]" size={20}/> Доставка та сервіс
                            </h3>
                            <ul className="text-zinc-500 text-sm space-y-2">
                                <li>• Самовивіз: м. Синельникове, вул. Квітнева 9</li>
                                <li>• Доставка по Дніпру та області</li>
                                <li>• Відправка Новою Поштою по всій Україні</li>
                                <li>• Онлайн-запис на зручний час</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-[#FFC300] p-8 rounded-3xl text-black">
                        <h4 className="text-2xl font-black uppercase italic mb-4 leading-none">Потрібна консультація?</h4>
                        <p className="font-bold opacity-80 mb-6 text-sm">Наші експерти допоможуть підібрати ідеальну гуму під ваш бюджет та стиль водіння.</p>
                        <a href="tel:+380991674424" className="block text-center bg-black text-white font-black py-4 rounded-xl hover:scale-105 transition-transform">
                            ЗАТЕЛЕФОНУВАТИ
                        </a>
                    </div>
                    
                    <div className="p-6 border border-zinc-800 rounded-2xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-[#FFC300]">
                            <Clock size={24}/>
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm leading-none mb-1">Працюємо 24/7</p>
                            <p className="text-zinc-500 text-xs">Без перерв та вихідних</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* LSI Keywords Tag Cloud (Very subtle) */}
            <div className="mt-12 pt-8 border-t border-zinc-800/30 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-zinc-600 font-medium uppercase tracking-widest">
                <span>автошини дніпро</span>
                <span>•</span>
                <span>вулканізація область</span>
                <span>•</span>
                <span>рихтування дисків</span>
                <span>•</span>
                <span>низькі ціни на гуму</span>
                <span>•</span>
                <span>продаж шин 24/7</span>
                <span>•</span>
                <span>сервіс коліс форсаж</span>
            </div>
        </section>
    );
};

export default SeoContentBlock;
