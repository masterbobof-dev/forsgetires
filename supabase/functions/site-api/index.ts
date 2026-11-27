// Gateway for the shop program: the program's server manages the website through this one endpoint.
// POST { action, ...params } with header x-site-key. Responds { ok, data } or { ok: false, error }.
// Contract: docs/program-site-integration.md
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const BUCKET = 'galery';

class ApiError extends Error {}
const fail = (msg: string): never => { throw new ApiError(msg); };
const need = <T>(v: T | null | undefined, name: string): T => (v === undefined || v === null || v === '' ? fail(`Не вказано поле ${name}`) : v);
const check = <T>(r: { data: T; error: { message: string } | null }): T => { if (r.error) fail(r.error.message); return r.data; };

const money = (v: unknown) => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const STATUS_IN: Record<string, string> = { new: 'new', confirmed: 'confirmed', shipped: 'shipped', completed: 'completed', canceled: 'cancelled', cancelled: 'cancelled' };
const STATUS_OUT = (s: string) => (s === 'cancelled' ? 'canceled' : s || 'new');
const SETTINGS_KEYS = ['contact_phone1', 'contact_phone2', 'contact_address', 'contact_viber', 'contact_telegram', 'seo_title', 'seo_description',
  'legal_seller_name', 'legal_seller_code', 'legal_seller_address', 'legal_seller_email', 'ga_measurement_id', 'fb_pixel_id'];
const INFO_PAGES = ['delivery', 'warranty', 'about', 'contacts', 'faq'];
const HOME_BLOCKS = ['banners', 'size_search', 'categories', 'hits', 'promos', 'benefits', 'reviews', 'articles'];
const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

const productByProgramId = async (pid: string) => {
  const row = check(await db.from('tyres').select('id, description, attributes, hidden_on_site, seo_title, seo_description, seo_keywords, image_url, image_thumb_url, gallery, gallery_thumbs')
    .eq('program_product_id', need(pid, 'program_product_id')).maybeSingle());
  return row || fail('Товар ще не з’явився на сайті (синхронізація раз на 2 хвилини; товар має бути в наявності)');
};
const photosOf = (r: any) => {
  const full: string[] = r.gallery?.length ? r.gallery : (r.image_url ? [r.image_url] : []);
  const thumbs: string[] = r.gallery_thumbs || [];
  return full.map((f, i) => ({ full: f, thumb: thumbs[i] || (i === 0 ? r.image_thumb_url : null) || f }));
};
const savePhotos = async (id: number, photos: { full: string; thumb: string }[]) => {
  check(await db.from('tyres').update({
    gallery: photos.map(p => p.full), gallery_thumbs: photos.map(p => p.thumb),
    image_url: photos[0]?.full ?? null, image_thumb_url: photos[0]?.thumb ?? null,
  }).eq('id', id));
};

// ---------- forum helpers ----------
const SHOP_AUTHOR = 'Форсаж (магазин)';
const TOPIC_COLS = 'id, created_at, category, title, author_name, is_shop, is_pinned, is_locked, is_hidden, replies_count, views, last_reply_at, edited_at, images';
const topicOut = (t: any) => ({ ...t, section: t.category, url: `https://www.forsage-tires.com/forum/${t.id}`, category: undefined });
const slug = (v: string) => String(v).toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || `r-${Math.random().toString(36).slice(2, 6)}`;
const sectionSlug = async (v: unknown) => {
  const s = check(await db.from('forum_sections').select('slug').or(`slug.eq.${String(v).replace(/[,()]/g, '')}${/^\d+$/.test(String(v)) ? `,id.eq.${v}` : ''}`).limit(1)) as any[];
  return s[0]?.slug || fail(`Розділ форуму ${v} не знайдено (дайте slug або id з forum.sections.list)`);
};

const actions: Record<string, (p: any) => Promise<unknown>> = {
  // ---------- orders ----------
  'orders.list': async (p) => {
    let q = db.from('tyre_orders').select('*').order('created_at', { ascending: false })
      .range(p.offset || 0, (p.offset || 0) + Math.min(p.limit || 50, 200) - 1);
    if (p.status) q = q.eq('status', STATUS_IN[p.status] || p.status);
    if (p.since) q = q.gte('created_at', p.since);
    if (p.paid !== undefined) q = q.eq('paid', !!p.paid);
    if (p.synced === false) q = q.is('synced_at', null);
    if (p.synced === true) q = q.not('synced_at', 'is', null);
    if (p.search) { const s = String(p.search).replace(/[,()]/g, ' '); q = q.or(`customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,customer_email.ilike.%${s}%,tracking_number.ilike.%${s}%`); }
    const rows = check(await q) as any[];
    const ids = [...new Set(rows.flatMap(r => (r.items || []).map((i: any) => Number(i.id)).filter(Boolean)))];
    const map = new Map<number, string | null>();
    if (ids.length) (check(await db.from('tyres').select('id, program_product_id').in('id', ids)) as any[]).forEach(t => map.set(t.id, t.program_product_id));
    const unseen = rows.filter(r => !r.seen_at).map(r => r.id);
    if (unseen.length) await db.from('tyre_orders').update({ seen_at: new Date().toISOString() }).in('id', unseen);
    return rows.map(r => {
      const items = (r.items || []).map((i: any) => ({ product_id: i.id, program_product_id: map.get(Number(i.id)) ?? null, title: i.title, qty: i.quantity || 1, price: money(i.price) }));
      return {
        id: r.id, created_at: r.created_at, status: STATUS_OUT(r.status), customer_name: r.customer_name, customer_phone: r.customer_phone,
        customer_email: r.customer_email, delivery_method: r.delivery_method, city: r.delivery_city, warehouse: r.delivery_warehouse,
        payment_method: r.payment_method, comment: r.comment, total: items.reduce((s: number, i: any) => s + i.price * i.qty, 0),
        tracking_number: r.tracking_number, manager_comment: r.manager_comment, is_new: !r.seen_at, items,
        paid: !!r.paid, paid_at: r.paid_at, paid_amount: r.paid_amount === null ? null : Number(r.paid_amount),
        program_order_id: r.program_order_id, program_order_number: r.program_order_number, synced_at: r.synced_at,
      };
    });
  },
  'orders.update': async (p) => {
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (p.status !== undefined) upd.status = STATUS_IN[p.status] || fail(`Невідомий статус ${p.status}`);
    if (p.tracking_number !== undefined) upd.tracking_number = p.tracking_number || null;
    if (p.manager_comment !== undefined) upd.manager_comment = p.manager_comment || null;
    return check(await db.from('tyre_orders').update(upd).eq('id', need(p.id, 'id')).select('id, status').single());
  },
  // the program created its own order from a paid site order: from now on the goods are in the program's reservations
  'orders.mark_synced': async (p) => {
    const row = check(await db.from('tyre_orders').update({
      synced_at: new Date().toISOString(), program_order_id: String(need(p.program_order_id, 'program_order_id')),
      program_order_number: p.program_order_number == null ? null : String(p.program_order_number), updated_at: new Date().toISOString(),
    }).eq('id', need(p.id, 'id')).select('id, synced_at, program_order_id, program_order_number').maybeSingle());
    return row || fail(`Замовлення ${p.id} не знайдено`);
  },
  'orders.unseen_count': async () => {
    const { count, error } = await db.from('tyre_orders').select('id', { count: 'exact', head: true }).is('seen_at', null);
    if (error) fail(error.message);
    return { count: count || 0 };
  },

  // ---------- customers ----------
  'customers.list': async (p) => {
    const limit = Math.min(p.limit || 50, 200), offset = p.offset || 0;
    const { data: users, error } = await db.auth.admin.listUsers({ page: Math.floor(offset / limit) + 1, perPage: limit });
    if (error) fail(error.message);
    const ids = users.users.map(u => u.id);
    const profiles = ids.length ? check(await db.from('customer_profiles').select('*').in('id', ids)) as any[] : [];
    const orders = ids.length ? check(await db.from('tyre_orders').select('user_id').in('user_id', ids)) as any[] : [];
    // staff accounts (admin / manager e-mails in settings) are not customers
    const staffEmails = new Set((check(await db.from('settings').select('value').in('key', ['admin_email', 'manager_email', 'service_staff_email'])) as any[])
      .map(r => String(r.value || '').trim().toLowerCase()));
    let list = users.users.filter(u => !staffEmails.has(String(u.email || '').toLowerCase())).map(u => {
      const pr = profiles.find(x => x.id === u.id) || {};
      return { id: u.id, email: u.email, full_name: pr.full_name || u.user_metadata?.full_name || null, phone: pr.phone || u.user_metadata?.phone || null,
        city: pr.city || null, created_at: u.created_at, orders_count: orders.filter(o => o.user_id === u.id).length };
    });
    if (p.search) { const s = String(p.search).toLowerCase(); list = list.filter(c => [c.email, c.full_name, c.phone].some(v => v?.toLowerCase().includes(s))); }
    return list;
  },

  // ---------- reviews ----------
  'reviews.list': async (p) => {
    let q = db.from('product_reviews').select('id, author_name, rating, body, created_at, approved, admin_reply, tyres(title)').order('created_at', { ascending: false }).limit(200);
    if (typeof p.approved === 'boolean') q = q.eq('approved', p.approved);
    return (check(await q) as any[]).map(r => ({ ...r, product_title: r.tyres?.title ?? null, tyres: undefined }));
  },
  'reviews.moderate': async (p) => check(await db.from('product_reviews').update({ approved: !!p.approved, ...(p.admin_reply !== undefined ? { admin_reply: p.admin_reply } : {}) }).eq('id', need(p.id, 'id')).select('id, approved').single()),
  'reviews.delete': async (p) => { check(await db.from('product_reviews').delete().eq('id', need(p.id, 'id'))); return { deleted: p.id }; },

  // ---------- recommended goods (chosen in the program) ----------
  // shown in «Рекомендуємо» on the home page and first in the «Рекомендовані» order of every section
  // how much of each item the program holds for its open orders; the site sells only what is free
  'products.reserved.set': async (p) => {
    if (!Array.isArray(p.items)) fail('Не вказано items (масив { program_product_id, qty })');
    if (p.items.length > 1000) fail('Не більше 1000 позицій за один виклик');
    return check(await db.rpc('program_reserved_set', { p_items: p.items, p_replace: p.replace_all === true }));
  },
  'products.recommended.list': async () =>
    check(await db.from('tyres').select('id, program_product_id, supplier_offer_id, title, price, in_stock').eq('is_hot', true).order('title')),
  // { program_product_ids?: uuid[], supplier_offer_ids?: string[], ids?: number[], on?: true|false, replace?: true }
  // replace: true = exactly this list is recommended, everything else is not
  'products.recommended.set': async (p) => {
    const pids: string[] = Array.isArray(p.program_product_ids) ? p.program_product_ids.map(String) : [];
    const sids: string[] = Array.isArray(p.supplier_offer_ids) ? p.supplier_offer_ids.map(String) : [];
    const ids: number[] = Array.isArray(p.ids) ? p.ids.map(Number).filter(Number.isFinite) : [];
    if (!pids.length && !sids.length && !ids.length && !p.replace) fail('Вкажіть program_product_ids, supplier_offer_ids або ids');
    const on = p.on !== false;
    const found = new Set<number>(ids);
    if (pids.length) for (const r of check(await db.from('tyres').select('id').in('program_product_id', pids)) as any[]) found.add(r.id);
    if (sids.length) for (const r of check(await db.from('tyres').select('id').in('supplier_offer_id', sids)) as any[]) found.add(r.id);
    const list = [...found];
    if (p.replace) check(await db.from('tyres').update({ is_hot: false }).eq('is_hot', true).not('id', 'in', `(${list.join(',') || 0})`));
    if (list.length) check(await db.from('tyres').update({ is_hot: p.replace ? true : on }).in('id', list));
    const { count } = await db.from('tyres').select('id', { count: 'exact', head: true }).eq('is_hot', true);
    return { changed: list.length, not_found: pids.length + sids.length + ids.length - list.length, recommended_total: count };
  },

  // ---------- product fields for the site ----------
  'products.site_fields.get': async (p) => {
    const r: any = await productByProgramId(p.program_product_id);
    return { site_product_id: r.id, description: r.description, specs: r.attributes || {}, hidden: r.hidden_on_site, seo_title: r.seo_title, seo_description: r.seo_description, seo_keywords: r.seo_keywords, photos: photosOf(r) };
  },
  'products.site_fields.set': async (p) => {
    const r: any = await productByProgramId(p.program_product_id);
    const upd: Record<string, unknown> = {};
    if (p.description !== undefined) upd.description = p.description || null;
    if (p.specs !== undefined) upd.attributes = p.specs && typeof p.specs === 'object' ? p.specs : {};
    if (p.seo_title !== undefined) upd.seo_title = p.seo_title || null;
    if (p.seo_description !== undefined) upd.seo_description = p.seo_description || null;
    if (p.seo_keywords !== undefined) upd.seo_keywords = p.seo_keywords || null;
    if (p.hidden !== undefined) {
      upd.hidden_on_site = !!p.hidden;
      // hidden -> off the site now; shown again -> visible if in stock (the sync keeps it up to date)
      const st = check(await db.from('tyres').select('stock_quantity, program_product_id').eq('id', r.id).single()) as any;
      upd.in_stock = !p.hidden && (st.program_product_id ? st.stock_quantity > 0 : true);
    }
    check(await db.from('tyres').update(upd).eq('id', r.id));
    return { ok: true };
  },

  // ---------- photos ----------
  'photos.upload_url': async (p) => {
    const count = Math.min(Math.max(Number(p.count) || 1, 1), 20);
    const folder = p.kind === 'banner' ? 'banners' : `products/program/${need(p.program_product_id, 'program_product_id')}`;
    const out = [];
    for (let i = 0; i < count; i++) {
      const base = `${folder}/${crypto.randomUUID()}`;
      const one: Record<string, unknown> = {};
      for (const kind of p.kind === 'banner' ? ['full', 'mobile'] : ['full', 'thumb']) {
        const path = `${base}-${kind}.webp`;
        const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error) fail(error.message);
        one[kind] = { upload_url: data!.signedUrl, public_url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
      }
      out.push(one);
    }
    return out;
  },
  'photos.attach': async (p) => {
    const r: any = await productByProgramId(p.program_product_id);
    const photos = (need(p.photos, 'photos') as any[]).map(x => ({ full: need(x.full, 'full'), thumb: x.thumb || x.full }));
    await savePhotos(r.id, photos);
    // photos chosen in the program replace an auto-found one
    await db.from('tyres').update({ photo_auto: false }).eq('id', r.id);
    return { photos };
  },
  'photos.remove': async (p) => {
    const r: any = await productByProgramId(p.program_product_id);
    const photos = photosOf(r).filter(x => x.full !== p.full);
    await savePhotos(r.id, photos);
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    const paths = [p.full, ...photosOf(r).filter(x => x.full === p.full).map(x => x.thumb)].filter((u: string) => u?.includes(prefix)).map((u: string) => u.split(prefix)[1]);
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
    return { photos };
  },

  /** photos the site found automatically (checked by AI) — the program downloads them into its own database.
   *  Pass the last `found_at` you received as `since` to get only new ones. */
  'photos.auto_list': async (p) => {
    let q = db.from('tyres').select('program_product_id, image_url, image_thumb_url, photo_verified_at')
      .eq('photo_auto', true).eq('photo_verified', true).not('program_product_id', 'is', null).not('image_url', 'is', null)
      .order('photo_verified_at', { ascending: true }).limit(Math.min(p.limit || 200, 1000));
    if (p.since) q = q.gt('photo_verified_at', p.since);
    return (check(await q) as any[]).map(r => ({ program_product_id: r.program_product_id, full: r.image_url, thumb: r.image_thumb_url || r.image_url, found_at: r.photo_verified_at }));
  },

  // ---------- categories ----------
  'categories.list': async () => check(await db.from('product_categories').select('id, name, slug, parent_id, icon, sort_order, is_active, kind, program_category_ids').order('sort_order')),
  'categories.upsert': async (p) => {
    const row: Record<string, unknown> = pick(p, ['name', 'parent_id', 'icon', 'sort_order', 'is_active', 'program_category_ids']);
    if (!p.id) {
      row.name = need(p.name, 'name');
      const base = String(p.name).toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, '-').replace(/^-|-$/g, '');
      row.slug = p.slug || `${base || 'cat'}-${Math.random().toString(36).slice(2, 6)}`;
      row.kind = 'generic';
      return check(await db.from('product_categories').insert(row).select().single());
    }
    // a program category may belong to one site category only
    if (Array.isArray(p.program_category_ids) && p.program_category_ids.length) {
      const others = check(await db.from('product_categories').select('id, program_category_ids').overlaps('program_category_ids', p.program_category_ids).neq('id', p.id)) as any[];
      for (const o of others) await db.from('product_categories').update({ program_category_ids: o.program_category_ids.filter((x: string) => !p.program_category_ids.includes(x)) }).eq('id', o.id);
      // move already synced products
      await db.from('tyres').update({ category_id: p.id }).in('program_category_id', p.program_category_ids);
    }
    return check(await db.from('product_categories').update(row).eq('id', p.id).select().single());
  },
  'categories.delete': async (p) => {
    const id = need(p.id, 'id');
    const used = await db.from('tyres').select('id', { count: 'exact', head: true }).eq('category_id', id);
    if ((used.count || 0) > 0) fail('У категорії є товари — спершу перенесіть їх або вимкніть категорію (is_active: false)');
    check(await db.from('product_categories').delete().eq('id', id));
    return { deleted: id };
  },

  // ---------- banners ----------
  'banners.list': async () => check(await db.from('site_banners').select('*').order('sort_order')),
  'banners.upsert': async (p) => {
    const row = { ...pick(p, ['title', 'subtitle', 'image_url', 'image_mobile_url', 'button_text', 'link', 'starts_at', 'ends_at', 'sort_order', 'is_active']), updated_at: new Date().toISOString() };
    if (!p.id) need(p.image_url, 'image_url');
    return check(p.id ? await db.from('site_banners').update(row).eq('id', p.id).select().single() : await db.from('site_banners').insert(row).select().single());
  },
  'banners.delete': async (p) => { check(await db.from('site_banners').delete().eq('id', need(p.id, 'id'))); return { deleted: p.id }; },

  // ---------- promos ----------
  'promos.list': async () => check(await db.from('site_promos').select('*').order('created_at', { ascending: false })),
  'promos.upsert': async (p) => {
    const row: Record<string, unknown> = { ...pick(p, ['title', 'discount_percent', 'target_type', 'target_ids', 'starts_at', 'ends_at', 'badge_text', 'is_active']), updated_at: new Date().toISOString() };
    if (Array.isArray(row.target_ids)) row.target_ids = (row.target_ids as unknown[]).map(String);
    if (!p.id) { need(p.title, 'title'); need(p.discount_percent, 'discount_percent'); }
    return check(p.id ? await db.from('site_promos').update(row).eq('id', p.id).select().single() : await db.from('site_promos').insert(row).select().single());
  },
  'promos.delete': async (p) => { check(await db.from('site_promos').delete().eq('id', need(p.id, 'id'))); return { deleted: p.id }; },

  // ---------- home page ----------
  'home.get': async () => {
    const r = check(await db.from('settings').select('value').eq('key', 'home_blocks').maybeSingle()) as any;
    let blocks = []; try { blocks = r?.value ? JSON.parse(r.value) : []; } catch { /* default */ }
    if (!blocks.length) blocks = HOME_BLOCKS.map(type => ({ type, enabled: true }));
    return { blocks };
  },
  'home.set': async (p) => {
    const blocks = (need(p.blocks, 'blocks') as any[]).map(b => ({ type: HOME_BLOCKS.includes(b.type) ? b.type : fail(`Невідомий блок ${b.type}`), enabled: b.enabled !== false, ...(b.title ? { title: String(b.title) } : {}) }));
    check(await db.from('settings').upsert({ key: 'home_blocks', value: JSON.stringify(blocks) }));
    return { blocks };
  },

  // ---------- pages & articles ----------
  'pages.list': async () => {
    const arts = check(await db.from('articles').select('id, title, content, image_url, created_at').order('created_at', { ascending: false })) as any[];
    const info = check(await db.from('site_pages').select('*')) as any[];
    return [
      ...INFO_PAGES.map(slug => { const pg = info.find(i => i.slug === slug); return { id: slug, type: 'info', slug, title: pg?.title ?? null, content: pg?.content ?? null, image_url: null, created_at: pg?.updated_at ?? null, customized: !!pg }; }),
      ...arts.map(a => ({ id: a.id, type: 'article', slug: null, title: a.title, content: a.content, image_url: a.image_url, created_at: a.created_at })),
    ];
  },
  'pages.upsert': async (p) => {
    if (p.type === 'info') {
      const slug = INFO_PAGES.includes(p.id || p.slug) ? (p.id || p.slug) : fail('Інфо-сторінка: delivery, warranty, about, contacts або faq');
      return check(await db.from('site_pages').upsert({ slug, title: need(p.title, 'title'), content: need(p.content, 'content'), updated_at: new Date().toISOString() }).select().single());
    }
    const row = pick(p, ['title', 'content', 'image_url']);
    if (!p.id) { need(p.title, 'title'); need(p.content, 'content'); }
    return check(p.id ? await db.from('articles').update(row).eq('id', p.id).select().single() : await db.from('articles').insert(row).select().single());
  },
  'pages.delete': async (p) => {
    if (INFO_PAGES.includes(p.id)) fail('Інфо-сторінки не видаляються, лише редагуються');
    check(await db.from('articles').delete().eq('id', need(p.id, 'id')));
    return { deleted: p.id };
  },

  // ---------- settings ----------
  'settings.get': async () => Object.fromEntries((check(await db.from('settings').select('key, value').in('key', SETTINGS_KEYS)) as any[]).map(r => [r.key, r.value])),
  'settings.set': async (p) => {
    const values = need(p.values, 'values') as Record<string, unknown>;
    const rows = Object.entries(values).map(([key, value]) => (SETTINGS_KEYS.includes(key) ? { key, value: String(value ?? '') } : fail(`Ключ ${key} не дозволено`)));
    if (rows.length) check(await db.from('settings').upsert(rows));
    return { saved: rows.length };
  },

  // ---------- forum (the program writes as the shop: author «Форсаж (магазин)») ----------
  'forum.sections.list': async () => check(await db.from('forum_sections').select('id, parent_id, slug, name, description, sort_order').order('sort_order').order('id')),
  'forum.sections.upsert': async (p) => {
    const row: Record<string, unknown> = pick(p, ['name', 'description', 'parent_id', 'sort_order']);
    if (p.slug) row.slug = slug(p.slug);
    if (!p.id) { row.name = need(p.name, 'name'); row.slug = row.slug || slug(p.name); return check(await db.from('forum_sections').insert(row).select().single()); }
    return check(await db.from('forum_sections').update(row).eq('id', p.id).select().single());
  },
  'forum.sections.delete': async (p) => {
    const s: any = check(await db.from('forum_sections').select('id, slug').eq('id', need(p.id, 'id')).single());
    const kids = await db.from('forum_sections').select('id', { count: 'exact', head: true }).eq('parent_id', s.id);
    const used = await db.from('forum_topics').select('id', { count: 'exact', head: true }).eq('category', s.slug);
    if ((kids.count || 0) + (used.count || 0) > 0) fail('У розділі є підрозділи або теми — спершу перенесіть їх');
    check(await db.from('forum_sections').delete().eq('id', s.id));
    return { deleted: s.id };
  },
  'forum.topics.list': async (p) => {
    let q = db.from('forum_topics').select(TOPIC_COLS).order('last_reply_at', { ascending: false })
      .range(p.offset || 0, (p.offset || 0) + Math.min(p.limit || 50, 200) - 1);
    if (p.section) q = q.eq('category', p.section);
    if (p.since) q = q.gte('last_reply_at', p.since);
    if (typeof p.hidden === 'boolean') q = q.eq('is_hidden', p.hidden);
    if (typeof p.from_shop === 'boolean') q = q.eq('is_shop', p.from_shop);
    if (p.search) q = q.ilike('title', `%${String(p.search).replace(/[%,()]/g, ' ')}%`);
    return (check(await q) as any[]).map(topicOut);
  },
  'forum.topic.get': async (p) => {
    const t = check(await db.from('forum_topics').select(TOPIC_COLS + ', body').eq('id', need(p.id, 'id')).maybeSingle()) || fail('Тему не знайдено');
    const posts = check(await db.from('forum_posts').select('id, parent_id, created_at, author_name, is_shop, body, images, is_hidden, edited_at').eq('topic_id', p.id).order('created_at').limit(1000)) as any[];
    return { ...topicOut(t), body: (t as any).body, posts };
  },
  'forum.topics.create': async (p) => {
    const now = new Date().toISOString();
    const row = { category: await sectionSlug(need(p.section, 'section')), title: String(need(p.title, 'title')).slice(0, 200), body: String(need(p.body, 'body')),
      images: Array.isArray(p.images) ? p.images.slice(0, 12) : [], is_pinned: !!p.pinned, is_locked: !!p.locked, is_shop: true, author_name: SHOP_AUTHOR,
      created_at: now, last_reply_at: now, replies_count: 0, views: 0 };
    return topicOut(check(await db.from('forum_topics').insert(row).select(TOPIC_COLS).single()));
  },
  'forum.topics.update': async (p) => {
    const upd: Record<string, unknown> = {};
    if (p.title !== undefined) upd.title = String(p.title).slice(0, 200);
    if (p.body !== undefined) upd.body = String(p.body);
    if (p.images !== undefined) upd.images = Array.isArray(p.images) ? p.images.slice(0, 12) : [];
    if (p.section !== undefined) upd.category = await sectionSlug(p.section);
    if (p.pinned !== undefined) upd.is_pinned = !!p.pinned;
    if (p.locked !== undefined) upd.is_locked = !!p.locked;
    if (p.hidden !== undefined) upd.is_hidden = !!p.hidden;
    if (upd.title !== undefined || upd.body !== undefined || upd.images !== undefined) upd.edited_at = new Date().toISOString();
    return topicOut(check(await db.from('forum_topics').update(upd).eq('id', need(p.id, 'id')).select(TOPIC_COLS).single()));
  },
  'forum.topics.delete': async (p) => { check(await db.from('forum_topics').delete().eq('id', need(p.id, 'id'))); return { deleted: p.id }; },
  'forum.posts.create': async (p) => {
    const topic = need(p.topic_id, 'topic_id');
    if (p.parent_id) { const par: any = check(await db.from('forum_posts').select('topic_id').eq('id', p.parent_id).maybeSingle()); if (!par || par.topic_id !== topic) fail('parent_id не з цієї теми'); }
    const row = { topic_id: topic, parent_id: p.parent_id || null, body: String(need(p.body, 'body')), images: Array.isArray(p.images) ? p.images.slice(0, 12) : [],
      is_shop: true, author_name: SHOP_AUTHOR, created_at: new Date().toISOString() };
    return check(await db.from('forum_posts').insert(row).select('id, topic_id, parent_id, created_at').single());
  },
  'forum.posts.update': async (p) => {
    const upd: Record<string, unknown> = {};
    if (p.body !== undefined) { upd.body = String(p.body); upd.edited_at = new Date().toISOString(); }
    if (p.images !== undefined) upd.images = Array.isArray(p.images) ? p.images.slice(0, 12) : [];
    if (p.hidden !== undefined) upd.is_hidden = !!p.hidden;
    return check(await db.from('forum_posts').update(upd).eq('id', need(p.id, 'id')).select('id, is_hidden, edited_at').single());
  },
  'forum.posts.delete': async (p) => { check(await db.from('forum_posts').delete().eq('id', need(p.id, 'id'))); return { deleted: p.id }; },
  'forum.stats': async (p) => check(await db.rpc('forum_stats', { p_days: Math.min(Math.max(Number(p.days) || 7, 1), 365) })),
  'forum.photos.upload_url': async (p) => {
    const count = Math.min(Math.max(Number(p.count) || 1, 1), 12);
    const out = [];
    for (let i = 0; i < count; i++) {
      const path = `shop/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${p.ext === 'webp' ? 'webp' : 'jpg'}`;
      const { data, error } = await db.storage.from('forum').createSignedUploadUrl(path);
      if (error) fail(error.message);
      out.push({ upload_url: data!.signedUrl, public_url: db.storage.from('forum').getPublicUrl(path).data.publicUrl });
    }
    return out;
  },

  // ---------- SEO: what Google shows (titles, descriptions, section texts, FAQ, redirects) ----------
  'seo.health': async () => check(await db.rpc('seo_health')),
  'seo.products.missing': async (p) => {
    // products on the site without their own Google title/description: the program's AI fills them (seo.products.set)
    let q = db.from('tyres').select('program_product_id, title, manufacturer, price, description, seo_title, seo_description, category_id, product_categories(name)')
      .not('program_product_id', 'is', null).neq('in_stock', false).order('id').range(p.offset || 0, (p.offset || 0) + Math.min(p.limit || 100, 500) - 1);
    q = p.field === 'description' ? q.or('seo_description.is.null,seo_description.eq.') : q.or('seo_title.is.null,seo_title.eq.,seo_description.is.null,seo_description.eq.');
    return (check(await q) as any[]).map(r => ({ program_product_id: r.program_product_id, title: r.title, brand: r.manufacturer, price: money(r.price),
      category: r.product_categories?.name ?? null, has_description: !!r.description, seo_title: r.seo_title, seo_description: r.seo_description }));
  },
  'seo.products.set': async (p) => {
    // many at once: [{ program_product_id, seo_title?, seo_description?, seo_keywords?, description? }]
    const items = (need(p.items, 'items') as any[]).slice(0, 500);
    let saved = 0; const missing: string[] = [];
    for (const it of items) {
      const upd: Record<string, unknown> = {};
      for (const k of ['seo_title', 'seo_description', 'seo_keywords', 'description']) if (it[k] !== undefined) upd[k] = it[k] ? String(it[k]) : null;
      if (!Object.keys(upd).length) continue;
      const r = await db.from('tyres').update(upd).eq('program_product_id', it.program_product_id).select('id');
      if (r.error) fail(r.error.message);
      if (r.data?.length) saved++; else missing.push(it.program_product_id);
    }
    return { saved, not_on_site: missing };
  },
  'seo.categories.list': async () => {
    const cats = check(await db.from('product_categories').select('id, name, slug, parent_id, is_active, description, seo_title, seo_description, noindex, faq').order('sort_order')) as any[];
    return cats.map(c => ({ ...c, url: `https://www.forsage-tires.com/katalog/${c.slug}` }));
  },
  'seo.categories.set': async (p) => {
    const upd: Record<string, unknown> = {};
    for (const k of ['seo_title', 'seo_description', 'description']) if (p[k] !== undefined) upd[k] = p[k] || null;
    if (p.noindex !== undefined) upd.noindex = !!p.noindex;
    if (p.faq !== undefined) {
      // questions and answers under the section: [{ q, a }]
      upd.faq = Array.isArray(p.faq) ? p.faq.filter((x: any) => x?.q && x?.a).slice(0, 20).map((x: any) => ({ q: String(x.q), a: String(x.a) })) : null;
    }
    return check(await db.from('product_categories').update(upd).eq('id', need(p.id, 'id')).select('id, seo_title, seo_description, noindex').single());
  },
  'seo.settings.get': async () => Object.fromEntries((check(await db.from('settings').select('key, value').like('key', 'seo_%')) as any[]).map(r => [r.key, r.value])),
  'seo.settings.set': async (p) => {
    // site-wide: seo_title, seo_description, seo_keywords, seo_image, seo_hours ("Mo-Su 08:00-19:00"), seo_founded,
    // product title templates seo_tpl_title / seo_tpl_desc (and per section seo_tpl_title_<id>), seo_gsc_verify
    const values = need(p.values, 'values') as Record<string, unknown>;
    const rows = Object.entries(values).map(([key, value]) => (/^seo_[a-z0-9_]+$/.test(key) && key !== 'seo_mode' ? { key, value: String(value ?? '') } : fail(`Ключ ${key} не дозволено`)));
    if (rows.length) check(await db.from('settings').upsert(rows));
    return { saved: rows.length };
  },
  'seo.redirects.list': async () => check(await db.from('seo_redirects').select('from_path, to_path, hits, created_at').order('created_at', { ascending: false })),
  'seo.redirects.set': async (p) => {
    const from = String(need(p.from_path, 'from_path')), to = String(need(p.to_path, 'to_path'));
    if (!from.startsWith('/') || !to.startsWith('/')) fail('Шляхи мають починатися з / (наприклад /katalog/stari-shyny)');
    return check(await db.from('seo_redirects').upsert({ from_path: from, to_path: to }).select().single());
  },
  'seo.redirects.delete': async (p) => { check(await db.from('seo_redirects').delete().eq('from_path', need(p.from_path, 'from_path'))); return { deleted: p.from_path }; },

  // ---------- service ----------
  'ping': async () => {
    const st = check(await db.rpc('program_sync_state')) as any;
    const minutes = st.last_ok_at ? Math.round((Date.now() - new Date(st.last_ok_at).getTime()) / 60000) : null;
    // stale = no successful update for 15+ minutes (the program should show a warning)
    return { site: 'forsage-tires.com', time: new Date().toISOString(),
      catalog_sync: { last_ok_at: st.last_ok_at, last_error: st.last_error, minutes_since_ok: minutes, stale: minutes === null || minutes >= 15 } };
  },
};

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-site-key', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  const key = req.headers.get('x-site-key') || '';
  const { data: okKey } = await db.rpc('site_api_key_ok', { p_key: key });
  if (!key || okKey !== true) return json({ ok: false, error: 'Невірний ключ доступу' }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Тіло запиту має бути JSON' }, 400); }
  const fn = actions[body?.action];
  if (!fn) return json({ ok: false, error: `Невідома дія: ${body?.action}`, actions: Object.keys(actions) }, 400);
  try {
    return json({ ok: true, data: await fn(body) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!(e instanceof ApiError)) console.error(body.action, e);
    return json({ ok: false, error: msg }, e instanceof ApiError ? 400 : 500);
  }
});
