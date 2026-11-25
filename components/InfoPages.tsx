import React, { useEffect, useState } from 'react';
import { ArrowLeft, Truck, Store, Wallet, ShieldCheck, RotateCcw, Phone, MapPin, MessageCircle, Send, Mail, HelpCircle, ChevronDown, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, PHONE_LINK_1, PHONE_LINK_2, TELEGRAM_LINK, VIBER_LINK } from '../constants';
import { linkClick } from '../navigation';
import { ArticleBody } from './ArticlesPage';

export type InfoPage = 'delivery' | 'warranty' | 'about' | 'contacts' | 'faq';

export const INFO_PAGES: Record<InfoPage, { path: string; title: string; description: string }> = {
  delivery: { path: '/dostavka-i-oplata', title: 'Доставка і оплата', description: 'Самовивіз у Синельниковому або доставка Новою Поштою по всій Україні. Оплата при отриманні, карткою або на рахунок.' },
  warranty: { path: '/garantiya-i-povernennya', title: 'Гарантія і повернення', description: 'Гарантія виробника на всі товари. Повернення та обмін протягом 14 днів згідно із законом.' },
  about: { path: '/pro-nas', title: 'Про магазин', description: 'Інтернет-магазин «Форсаж» у Синельниковому: шини, диски, акумулятори та автотовари з доставкою по Україні.' },
  contacts: { path: '/kontakty', title: 'Контакти', description: 'Телефони, Viber, Telegram та адреса магазину «Форсаж»: м. Синельникове, вул. Квітнева, 9.' },
  faq: { path: '/faq', title: 'Поширені питання', description: 'Відповіді на популярні питання: як оформити замовлення, доставка, оплата, підбір розміру шин, повернення.' },
};

const MAP_LINK = 'https://www.google.com/maps/dir/?api=1&destination=%D0%B2%D1%83%D0%BB%D0%B8%D1%86%D1%8F%20%D0%9A%D0%B2%D1%96%D1%82%D0%BD%D0%B5%D0%B2%D0%B0%209%2C%20%D0%A1%D0%B8%D0%BD%D0%B5%D0%BB%D1%8C%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%D0%B5%2C%20%D0%94%D0%BD%D1%96%D0%BF%D1%80%D0%BE%D0%BF%D0%B5%D1%82%D1%80%D0%BE%D0%B2%D1%81%D1%8C%D0%BA%D0%B0%20%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C';

const Card: React.FC<{ icon: React.ComponentType<{ size?: number }>; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-5">
    <h2 className="text-white font-black text-base md:text-lg flex items-center gap-2 mb-2"><span className="text-[#FFC300]"><Icon size={20} /></span>{title}</h2>
    <div className="text-zinc-300 text-sm leading-relaxed space-y-2">{children}</div>
  </div>
);

const FAQ: { q: string; a: React.ReactNode; text: string }[] = [
  { q: 'Як оформити замовлення?', text: 'Додайте товар у кошик і натисніть «Оформити замовлення» або скористайтесь кнопкою «Купити в 1 клік» — менеджер зателефонує для підтвердження.', a: <>Додайте товар у кошик і натисніть «Оформити замовлення» або скористайтесь кнопкою «Купити в 1 клік» — менеджер зателефонує, щоб підтвердити наявність і ціну.</> },
  { q: 'Як дізнатися розмір шини?', text: 'Розмір написаний на боковині шини, наприклад 205/55 R16 91V: ширина 205 мм, висота профілю 55%, радіус 16 дюймів, 91 — індекс навантаження, V — індекс швидкості.', a: <>Розмір написаний на боковині шини, наприклад <b>205/55 R16 91V</b>: ширина 205 мм, висота профілю 55%, радіус 16 дюймів, 91 — індекс навантаження, V — індекс швидкості. Не впевнені — подзвоніть, підберемо за маркою авто.</> },
  { q: 'Скільки коштує доставка?', text: 'Доставка Новою Поштою оплачується за тарифами перевізника під час отримання. Самовивіз у Синельниковому безкоштовний.', a: <>Доставка Новою Поштою оплачується за тарифами перевізника під час отримання. Самовивіз у Синельниковому — безкоштовно.</> },
  { q: 'Які способи оплати?', text: 'Готівкою або карткою при самовивозі, накладений платіж Новою Поштою, або передоплата на рахунок.', a: <>Готівкою або карткою при самовивозі, накладений платіж Новою Поштою, або передоплата на рахунок.</> },
  { q: 'Чи можна повернути товар?', text: 'Так, протягом 14 днів, якщо товар не був у використанні та збережено його вигляд і упаковку. Змонтовані шини та встановлені акумулятори як товар належної якості не повертаються.', a: <>Так, протягом 14 днів, якщо товар не був у використанні та збережено його вигляд і упаковку. Змонтовані шини та встановлені акумулятори як товар належної якості не повертаються. Детальніше — у розділі <a href="/garantiya-i-povernennya" onClick={linkClick('/garantiya-i-povernennya')} className="text-[#FFC300] underline">Гарантія і повернення</a>.</> },
  { q: 'Як дізнатися, де моє замовлення?', text: 'Зареєстровані покупці бачать статус і номер ТТН у розділі «Мій кабінет». Або зателефонуйте нам.', a: <>Зареєстровані покупці бачать статус і номер ТТН у розділі <a href="/account" onClick={linkClick('/account')} className="text-[#FFC300] underline">«Мій кабінет»</a>. Або зателефонуйте нам.</> },
  { q: 'Що означає XL та C у розмірі?', text: 'XL — посилена шина з більшим допустимим навантаженням. C після радіуса (R16C) — шина для бусів і легковантажних авто.', a: <><b>XL</b> — посилена шина з більшим допустимим навантаженням. <b>C</b> після радіуса (R16C) — шина для бусів і легковантажних авто.</> },
];

const InfoPages: React.FC<{ page: InfoPage; onBack: () => void }> = ({ page, onBack }) => {
  const meta = INFO_PAGES[page];
  const [phones, setPhones] = useState({ p1: PHONE_NUMBER_1, p2: PHONE_NUMBER_2, l1: PHONE_LINK_1, l2: PHONE_LINK_2 });
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState<number | null>(0);
  // text edited in the shop program (table site_pages) replaces the built-in text
  const [custom, setCustom] = useState<{ title: string; content: string } | null>(null);
  useEffect(() => {
    setCustom(null);
    supabase.from('site_pages').select('title, content').eq('slug', page).maybeSingle().then(({ data }) => setCustom((data as any) || null));
  }, [page]);

  useEffect(() => {
    document.title = `${meta.title} — інтернет-магазин Форсаж`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://www.forsage-tires.com${meta.path}`);
  }, [page]);

  useEffect(() => {
    supabase.from('settings').select('key, value').in('key', ['contact_phone1', 'contact_phone2', 'legal_seller_email']).then(({ data }) => {
      const get = (k: string) => data?.find((r: any) => r.key === k)?.value?.trim();
      const link = (v: string) => { const d = v.replace(/\D/g, ''); return `tel:${d.startsWith('0') ? `+38${d}` : `+${d}`}`; };
      const p1 = get('contact_phone1'), p2 = get('contact_phone2');
      setPhones(prev => ({ p1: p1 || prev.p1, p2: p2 || prev.p2, l1: p1 ? link(p1) : prev.l1, l2: p2 ? link(p2) : prev.l2 }));
      setEmail(get('legal_seller_email') || '');
    });
  }, []);

  const faqLd = page === 'faq' && !custom ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.text } })),
  } : null;

  return (
    <article className="max-w-4xl mx-auto px-4 py-6 md:py-12 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
      <button onClick={onBack} className="text-zinc-500 hover:text-[#FFC300] text-xs font-black uppercase tracking-widest flex items-center gap-1 mb-6"><ArrowLeft size={14} /> До каталогу</button>
      <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-2">{custom?.title || meta.title}</h1>
      {custom ? (
        <div className="mb-6 md:mb-8 max-w-3xl"><ArticleBody content={custom.content} /></div>
      ) : (
        <p className="text-zinc-400 mb-6 md:mb-8 max-w-2xl">{meta.description}</p>
      )}

      {page === 'delivery' && !custom && (
        <div className="grid md:grid-cols-2 gap-3">
          <Card icon={Store} title="Самовивіз">
            <p>м. Синельникове, вул. Квітнева, 9.</p>
            <p>Перед приїздом дочекайтесь дзвінка менеджера з підтвердженням, що товар готовий.</p>
            <a href={MAP_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#FFC300] font-bold"><MapPin size={14} /> Прокласти маршрут</a>
          </Card>
          <Card icon={Truck} title="Нова Пошта по Україні">
            <p>У відділення, поштомат або кур'єром. Зазвичай відправляємо протягом 1–3 робочих днів після підтвердження.</p>
            <p>Вартість — за тарифами Нової Пошти, сплачується під час отримання.</p>
            <p>Після відправлення номер ТТН з'явиться у «Моєму кабінеті».</p>
          </Card>
          <Card icon={Wallet} title="Оплата">
            <ul className="list-disc pl-5 space-y-1">
              <li>готівкою або карткою при самовивозі;</li>
              <li>накладений платіж Новою Поштою (комісія перевізника — за його тарифами);</li>
              <li>передоплата на рахунок магазину.</li>
            </ul>
          </Card>
          <Card icon={Info} title="Перевірка при отриманні">
            <p>Огляньте посилку у відділенні: якщо є пошкодження — складіть акт з працівником Нової Пошти і зателефонуйте нам.</p>
          </Card>
        </div>
      )}

      {page === 'warranty' && !custom && (
        <div className="grid md:grid-cols-2 gap-3">
          <Card icon={ShieldCheck} title="Гарантія">
            <p>На всі товари діє гарантія виробника. Строки залежать від бренду та типу товару — уточнюйте у менеджера.</p>
            <p>Якщо виявили недолік — зателефонуйте нам: розглянемо звернення відповідно до Закону «Про захист прав споживачів».</p>
          </Card>
          <Card icon={RotateCcw} title="Повернення та обмін">
            <p>Протягом <b>14 днів</b> з дня отримання, якщо товар не використовувався і збережено його вигляд, упаковку та документ про покупку.</p>
            <p>Шини й диски, що були змонтовані, та акумулятори, що встановлювались, як товар належної якості не повертаються.</p>
            <p>Гроші повертаємо протягом 30 днів тим самим способом, яким ви платили.</p>
          </Card>
          <Card icon={Info} title="Як оформити повернення">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Зателефонуйте або напишіть нам — повідомте номер замовлення.</li>
              <li>Надішліть товар Новою Поштою або привезіть у магазин.</li>
              <li>Після перевірки повернемо кошти або обміняємо товар.</li>
            </ol>
            <p className="text-zinc-500 text-xs">Повні умови — у <a href="/oferta" onClick={linkClick('/oferta')} className="underline">публічній оферті</a>.</p>
          </Card>
        </div>
      )}

      {page === 'about' && !custom && (
        <div className="grid md:grid-cols-2 gap-3">
          <Card icon={Store} title="Хто ми">
            <p>«Форсаж» — інтернет-магазин у місті Синельникове Дніпропетровської області. Продаємо шини для легкових авто, позашляховиків, бусів, вантажівок та сільгосптехніки, а також диски, акумулятори й автотовари.</p>
          </Card>
          <Card icon={Truck} title="Як ми працюємо">
            <p>Ви оформлюєте замовлення на сайті або телефоном — ми підтверджуємо наявність і ціну, і відправляємо Новою Поштою або готуємо до самовивозу.</p>
            <p>Не знаєте, що підійде вашому авто? Подзвоніть — підберемо.</p>
          </Card>
        </div>
      )}

      {page === 'contacts' && (
        <div className="grid md:grid-cols-2 gap-3">
          <Card icon={Phone} title="Телефони">
            <a href={phones.l1} className="block text-xl font-black text-white hover:text-[#FFC300]">{phones.p1}</a>
            <a href={phones.l2} className="block text-xl font-black text-white hover:text-[#FFC300]">{phones.p2}</a>
          </Card>
          <Card icon={MessageCircle} title="Месенджери">
            <div className="flex flex-wrap gap-2">
              <a href={VIBER_LINK} className="flex items-center gap-2 bg-[#7360F2] text-white font-bold px-4 py-2 rounded-xl"><MessageCircle size={16} /> Viber</a>
              <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-[#0088cc] text-white font-bold px-4 py-2 rounded-xl"><Send size={16} /> Telegram</a>
            </div>
            {email && <a href={`mailto:${email}`} className="flex items-center gap-2 mt-2 text-zinc-300 hover:text-white"><Mail size={16} /> {email}</a>}
          </Card>
          <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <iframe
              src="https://www.google.com/maps?q=%D0%B2%D1%83%D0%BB%D0%B8%D1%86%D1%8F%20%D0%9A%D0%B2%D1%96%D1%82%D0%BD%D0%B5%D0%B2%D0%B0%209%2C%20%D0%A1%D0%B8%D0%BD%D0%B5%D0%BB%D1%8C%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%D0%B5%2C%20%D0%94%D0%BD%D1%96%D0%BF%D1%80%D0%BE%D0%BF%D0%B5%D1%82%D1%80%D0%BE%D0%B2%D1%81%D1%8C%D0%BA%D0%B0%20%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C&z=17&hl=uk&output=embed"
              width="100%" height="280" style={{ border: 0, filter: 'grayscale(1) invert(0.85) contrast(1.1)' }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Карта: магазин Форсаж"
            />
            <div className="p-4 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-white font-bold"><MapPin size={16} className="text-[#FFC300]" /> м. Синельникове, вул. Квітнева, 9</span>
              <a href={MAP_LINK} target="_blank" rel="noopener noreferrer" className="bg-[#FFC300] text-black font-black text-xs uppercase px-4 py-2 rounded-xl">Маршрут</a>
            </div>
          </div>
        </div>
      )}

      {page === 'faq' && !custom && (
        <div className="space-y-2">
          {FAQ.map((f, i) => (
            <div key={f.q} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-3 p-4 text-left" aria-expanded={open === i}>
                <span className="font-bold text-white flex items-center gap-2"><HelpCircle size={18} className="text-[#FFC300] shrink-0" />{f.q}</span>
                <ChevronDown size={18} className={`text-zinc-500 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && <div className="px-4 pb-4 -mt-1 text-zinc-300 text-sm leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">{f.a}</div>}
            </div>
          ))}
        </div>
      )}
    </article>
  );
};

export default InfoPages;
