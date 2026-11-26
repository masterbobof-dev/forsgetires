import { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import type { TyreProduct } from '../../../types';
import { type ProductCategory, isTyreProduct } from '../../../categories';
import { getPresetForCategory, suggestTitle } from '../../../productAttributes';
import { buildTyreTitle } from '../../../tyreIndex';
import { detectSeason } from './tyreAdminUtils';

/**
 * The edit window of a product: its form (tyre fields or the characteristics of the section), photos,
 * and saving. For goods that come from the shop program only the site's own fields are saved
 * (photos, description, characteristics, SEO).
 */
export const useTyreEditor = (categories: ProductCategory[], dbReady: boolean, fetchTyres: (page: number, isRefresh?: boolean) => void, showError: (msg: string) => void) => {
  const [showAddTyreModal, setShowAddTyreModal] = useState(false);
  const [editingTyreId, setEditingTyreId] = useState<number | null>(null);
  /** product comes from the shop program: name, price, stock, article and category are managed there */
  const [editingFromProgram, setEditingFromProgram] = useState(false);
  const PROGRAM_FIELDS = ['title', 'price', 'stock_quantity', 'in_stock', 'catalog_number', 'product_number', 'manufacturer', 'category_id', 'base_price'];
  const stripProgramFields = (payload: any) => { if (editingFromProgram) PROGRAM_FIELDS.forEach(k => delete payload[k]); return payload; };
  const [tyreForm, setTyreForm] = useState({ 
      category_id: '',
      manufacturer: '', 
      name: '', 
      width: '', 
      height: '', 
      radius: 'R15', 
      season: 'winter', 
      vehicle_type: 'car' as 'car'|'cargo'|'suv'|'truck'|'agro', 
      price: '', 
      old_price: '', 
      base_price: '', 
      catalog_number: '', 
      product_number: '', 
      description: '', 
      is_hot: false, 
      supplier_id: '', 
      stock_quantity: '',
      axis: '',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      slug: ''
  });
  const [attrForm, setAttrForm] = useState<Record<string, string>>({});
  const [tyreUploadFiles, setTyreUploadFiles] = useState<File[]>([]);
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const applyDiscount = (pct: number) => {
      const price = parseFloat(tyreForm.price);
      if (!price) return;
      const base = parseFloat(tyreForm.old_price) || price;
      const newPrice = Math.round(base * (1 - pct / 100));
      setTyreForm(prev => ({ ...prev, old_price: base.toString(), price: newPrice.toString() }));
  };

  const formCategoryForUi = categories.find(c => String(c.id) === tyreForm.category_id);
  const isTyreForm = !formCategoryForUi || formCategoryForUi.kind === 'tyre';
  const formPreset = isTyreForm ? null : getPresetForCategory(categories, formCategoryForUi);

  const handleSaveTyre = async () => {
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const fileItem of tyreUploadFiles) {
         const fileName = `tyre_${Date.now()}_${fileItem.name.replace(/\s+/g, '_')}`;
         const { error } = await supabase.storage.from('galery').upload(fileName, fileItem);
         if (!error) { const { data } = supabase.storage.from('galery').getPublicUrl(fileName); newUrls.push(data.publicUrl); }
      }

      const finalGallery = Array.from(new Set([...existingGallery, ...newUrls]));

      const formCategory = categories.find(c => String(c.id) === tyreForm.category_id);
      const isTyre = !formCategory || formCategory.kind === 'tyre';

      if (!isTyre) {
        const name = tyreForm.name.trim();
        const brand = tyreForm.manufacturer.trim();
        const preset = getPresetForCategory(categories, formCategory);
        const cleanAttrs: Record<string, string> = {};
        if (preset) for (const f of preset.fields) {
          let v = (attrForm[f.key] || '').trim().replace(',', '.');
          if (f.key === 'pcd') v = v.replace(/\s*[хХ×*xX]\s*/g, 'x');          // 5х112 → 5x112
          if (f.key === 'size') v = v.replace(/\s*[хХ*xX×]\s*/g, '×');         // 242x175x190 → 242×175×190
          if (v) cleanAttrs[f.key] = v;
        }
        const genericTitle = !name && preset
          ? suggestTitle(preset, brand, cleanAttrs)
          : brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;
        const genericPayload: any = {
          title: genericTitle.replace(/\s+/g, ' ').trim(),
          description: tyreForm.description || null,
          price: tyreForm.price,
          old_price: tyreForm.old_price || null,
          base_price: tyreForm.base_price || '0',
          manufacturer: brand || null,
          catalog_number: tyreForm.catalog_number,
          product_number: tyreForm.product_number,
          radius: null,
          season: null,
          axis: null,
          category_id: formCategory!.id,
          attributes: cleanAttrs,
          seo_title: tyreForm.seo_title || null,
          seo_description: tyreForm.seo_description || null,
          seo_keywords: tyreForm.seo_keywords || null,
          slug: tyreForm.slug || null,
          image_url: finalGallery[0] || null,
          gallery: finalGallery,
          is_hot: tyreForm.is_hot,
          supplier_id: tyreForm.supplier_id ? parseInt(tyreForm.supplier_id) : null,
          stock_quantity: tyreForm.stock_quantity ? parseInt(tyreForm.stock_quantity) : 0,
          in_stock: true
        };
        if (!genericPayload.title || genericPayload.title === 'Акумулятор' || genericPayload.title === 'Диск') throw new Error('Вкажіть назву товару або заповніть характеристики');
        const { error } = editingTyreId
          ? await supabase.from('tyres').update(stripProgramFields(genericPayload)).eq('id', editingTyreId)
          : await supabase.from('tyres').insert([genericPayload]);
        if (error) throw error;
        fetchTyres(0, true);
        setShowAddTyreModal(false);
        return;
      }

      // FORCE ALL-SEASON IF TRUCK OR AGRO
      const forcedSeason = (tyreForm.vehicle_type === 'truck' || tyreForm.vehicle_type === 'agro') 
                           ? 'all-season' 
                           : tyreForm.season;

      // Canonical title: "<Brand> <Model> <W>/<H> R<D> <index>" (season is shown separately, not in the title)
      const fullTitle = buildTyreTitle(tyreForm.manufacturer.trim(), tyreForm.name, tyreForm.width, tyreForm.height, tyreForm.radius);

      const payload: any = {
        title: fullTitle,
        description: tyreForm.description || null,
        price: tyreForm.price, 
        old_price: tyreForm.old_price || null,
        base_price: tyreForm.base_price || '0', 
        manufacturer: tyreForm.manufacturer, 
        catalog_number: tyreForm.catalog_number,
        product_number: tyreForm.product_number,
        radius: tyreForm.radius, 
        season: forcedSeason, 
        vehicle_type: tyreForm.vehicle_type,
        axis: tyreForm.axis, // Added Axis
        seo_title: tyreForm.seo_title || null,
        seo_description: tyreForm.seo_description || null,
        seo_keywords: tyreForm.seo_keywords || null,
        slug: tyreForm.slug || null,
        image_url: finalGallery[0] || null, 
        gallery: finalGallery, 
        is_hot: tyreForm.is_hot,
        supplier_id: tyreForm.supplier_id ? parseInt(tyreForm.supplier_id) : null,
        stock_quantity: tyreForm.stock_quantity ? parseInt(tyreForm.stock_quantity) : 0,
        in_stock: true
      };
      if (dbReady) payload.category_id = formCategory ? formCategory.id : null;

      const { error } = editingTyreId
          ? await supabase.from('tyres').update(stripProgramFields(payload)).eq('id', editingTyreId)
          : await supabase.from('tyres').insert([payload]);
      if (error) throw error;

      fetchTyres(0, true); 
      setShowAddTyreModal(false);
    } catch (err: any) { showError(err.message); } finally { setUploading(false); }
  };

  const openEditTyreModal = (t: TyreProduct) => {
      setEditingTyreId(t.id);
      setEditingFromProgram(!!t.program_product_id);
      // purchase price is kept privately; staff read it through tyre_cost()
      supabase.rpc('tyre_cost', { p_id: t.id }).then(({ data }) => { if (data) setTyreForm(f => ({ ...f, base_price: String(data) })); });
      let width = '', height = '';
      const sizeRegex = /(\d{3})[\/\s](\d{2})/;
      const match = t.title.match(sizeRegex);
      if (match) { width = match[1]; height = match[2]; }

      let name = t.title;
      if (t.manufacturer) name = name.replace(t.manufacturer, '');
      if (width && height) name = name.replace(`${width}/${height}`, '').replace(`${width} ${height}`, '');
      if (t.radius) name = name.replace(t.radius, '');
      name = name.replace(/\s(Winter|Summer|All Season)\s*$/i, ' '); // old titles had the season appended at the end
      name = name.replace(/\s+/g, ' ').trim();

      let parsedSeason = t.season || detectSeason(t.title, t.description || '') || 'summer';
      // Force correction on open
      if (t.vehicle_type === 'truck' || t.vehicle_type === 'agro') {
          parsedSeason = 'all-season';
      }

      if (!isTyreProduct(t, categories)) {
          const brand = t.manufacturer || '';
          name = brand && t.title.toLowerCase().startsWith(brand.toLowerCase()) ? t.title.slice(brand.length).trim() : t.title;
      }

      setAttrForm(Object.fromEntries(Object.entries(t.attributes || {}).map(([k, v]) => [k, String(v ?? '')])));
      setTyreForm({ 
        category_id: t.category_id ? String(t.category_id) : '',
        manufacturer: t.manufacturer || '', 
        name: name, 
        width, height,
        radius: t.radius || 'R15', 
        season: parsedSeason, 
        vehicle_type: t.vehicle_type || 'car', 
        price: String(t.price || ''), 
        old_price: String(t.old_price || ''), 
        base_price: String(t.base_price || ''), 
        catalog_number: t.catalog_number || '',
        product_number: t.product_number || '',
        description: t.description || '', 
        is_hot: !!t.is_hot,
        supplier_id: t.supplier_id ? String(t.supplier_id) : '',
        stock_quantity: t.stock_quantity ? String(t.stock_quantity) : '',
        axis: t.axis || '',
        seo_title: t.seo_title || '',
        seo_description: t.seo_description || '',
        seo_keywords: t.seo_keywords || '',
        slug: t.slug || ''
      });

      let currentGallery = t.gallery || [];
      if (currentGallery.length === 0 && t.image_url) {
          currentGallery = [t.image_url];
      }
      setExistingGallery(currentGallery);
      setTyreUploadFiles([]);
      setShowAddTyreModal(true);
  };

  return {
    showAddTyreModal, setShowAddTyreModal, editingTyreId, editingFromProgram,
    tyreForm, setTyreForm, attrForm, setAttrForm, isTyreForm, formPreset,
    tyreUploadFiles, setTyreUploadFiles, existingGallery, setExistingGallery, uploading,
    applyDiscount, handleSaveTyre, openEditTyreModal,
  };
};

export type TyreEditor = ReturnType<typeof useTyreEditor>;
