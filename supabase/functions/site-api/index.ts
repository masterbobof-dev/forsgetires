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
  const row = check(await db.from('tyres').select('id, description, attributes, hidden_on_site, seo_title, seo_description, image_url, image_thumb_url, gallery, gallery_thumbs')
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

const actions: Record<string, (p: any) => Promise<unknown>> = {
  // ---------- orders ----------
  'orders.list': async (p) => {
    let q = db.from('tyre_orders').select('*').order('created_at', { ascending: false })
      .range(p.offset || 0, (p.offset || 0) + Math.min(p.limit || 50, 200) - 1);
    if (p.status) q = q.eq('status', STATUS_IN[p.status] || p.status);
    if (p.since) q = q.gte('created_at', p.since);
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

  // ---------- product fields for the site ----------
  'products.site_fields.get': async (p) => {
    const r: any = await productByProgramId(p.program_product_id);
    return { site_product_id: r.id, description: r.description, specs: r.attributes || {}, hidden: r.hidden_on_site, seo_title: r.seo_title, seo_description: r.seo_description, photos: photosOf(r) };
  },
  'products.site_fields.set': async (p) => {
    const r: any = await productByProgramId(p.program_product_id);
    const upd: Record<string, unknown> = {};
    if (p.description !== undefined) upd.description = p.description || null;
    if (p.specs !== undefined) upd.attributes = p.specs && typeof p.specs === 'object' ? p.specs : {};
    if (p.seo_title !== undefined) upd.seo_title = p.seo_title || null;
    if (p.seo_description !== undefined) upd.seo_description = p.seo_description || null;
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

  // ---------- service ----------
  'ping': async () => {
    const st = check(await db.rpc('program_sync_state')) as any;
    return { site: 'forsage-tires.com', time: new Date().toISOString(), catalog_sync: { last_ok_at: st.last_ok_at, last_error: st.last_error } };
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
