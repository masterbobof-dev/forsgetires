import { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import type { ProductCategory } from '../../../categories';
import { invokeAiProxy } from '../../../aiProxyClient';
import type { TyresList } from './useTyresList';
import type { Messages } from './useMessages';
import { normalizeQuery } from './tyreAdminUtils';

/**
 * Actions for the ticked products: move to a section, mark as hits, delete, remove photos,
 * find photos with AI (one by one, with a progress window).
 */
export const useBulkActions = (list: TyresList, categories: ProductCategory[], { showError, setSuccessMessage }: Messages) => {
  const { tyres, setTyres, selectedTyreIds, setSelectedTyreIds, fetchTyres, fetchCategoryCounts } = list;

  const [bulkMarkup, setBulkMarkup] = useState('');
  const [bulkCategory, setBulkCategory] = useState(''); // NEW for Bulk Category
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // BULK AI PHOTO PROCESSING STATE
  const [isBulkPhotoProcessing, setIsBulkPhotoProcessing] = useState(false);
  const [bulkPhotoProgress, setBulkPhotoProgress] = useState(0);
  const [bulkPhotoTotal, setBulkPhotoTotal] = useState(0);
  /** the photo search key (Serper) is not set */
  const [showKeyNeededError, setShowKeyNeededError] = useState(false);

  const handleBulkPriceUpdate = async (dir: number) => {
      if(!bulkMarkup) return;
      setIsApplyingBulk(true);
      setTimeout(() => { setIsApplyingBulk(false); showError("Ціни оновлено (Mock)"); }, 500);
  };

  // --- BULK CATEGORY UPDATE ---
  const handleBulkCategoryUpdate = async (category: string) => {
      if (!category || selectedTyreIds.size === 0) return;
      if (category.startsWith('cat:')) {
          const cat = categories.find(c => String(c.id) === category.slice(4));
          if (!cat) return;
          setIsApplyingBulk(true);
          try {
              const ids = Array.from(selectedTyreIds);
              const updates: any = { category_id: cat.id };
              if (cat.vehicle_type) updates.vehicle_type = cat.vehicle_type;
              const { error } = await supabase.from('tyres').update(updates).in('id', ids);
              if (error) throw error;
              setSuccessMessage(`${ids.length} товарів перенесено в «${cat.name}».`);
              setBulkCategory('');
              setSelectedTyreIds(new Set());
              fetchTyres(0, true);
              setTimeout(() => setSuccessMessage(''), 3000);
          } catch (e: any) { showError(e.message); } finally { setIsApplyingBulk(false); }
          return;
      }
      setIsApplyingBulk(true);
      try {
          const ids = Array.from(selectedTyreIds);
          const updates: any = { vehicle_type: category };

          // Force All-Season for Truck and Agro
          if (category === 'truck' || category === 'agro') {
              updates.season = 'all-season';
          }

          const { error } = await supabase.from('tyres').update(updates).in('id', ids);

          if (error) throw error;

          // Update local state
          setTyres(prev => prev.map(t => {
              if (selectedTyreIds.has(t.id)) {
                  return { 
                      ...t, 
                      vehicle_type: category as any,
                      season: (category === 'truck' || category === 'agro') ? 'all-season' : t.season 
                  };
              }
              return t;
          }));

          setSuccessMessage(`Оновлено категорію для ${ids.length} товарів.`);
          setBulkCategory('');
          setSelectedTyreIds(new Set()); // Clear selection
          fetchCategoryCounts();
          setTimeout(() => setSuccessMessage(''), 3000);

      } catch (e: any) {
          showError("Помилка оновлення категорії: " + e.message);
      } finally {
          setIsApplyingBulk(false);
      }
  };

  const handleBulkHotUpdate = async (action: 'add' | 'remove') => {
      if (selectedTyreIds.size === 0) return;
      setIsApplyingBulk(true);
      try {
          const ids = Array.from(selectedTyreIds);
          const updates = ids.map(id => ({ id, is_hot: action === 'add' }));
          for (const u of updates) await supabase.from('tyres').update(u).eq('id', u.id);

          showError(`Оновлено ${ids.length} товарів`);
          fetchTyres(0, true);
          setSelectedTyreIds(new Set());
      } catch (e: any) { showError(e.message); }
      finally { setIsApplyingBulk(false); }
  };

  // --- BULK DELETE ---
  const handleBulkDelete = () => {
      if (selectedTyreIds.size === 0) return;
      setShowBulkDeleteConfirm(true);
  };

  const executeBulkDelete = async () => {
      setShowBulkDeleteConfirm(false);
      setIsApplyingBulk(true);
      try {
          const ids = Array.from(selectedTyreIds);
          const { error } = await supabase.from('tyres').delete().in('id', ids);

          if (error) throw error;

          setTyres(prev => prev.filter(t => !selectedTyreIds.has(t.id)));
          setSelectedTyreIds(new Set());
          setSuccessMessage(`Успішно видалено ${ids.length} товарів.`);
          setTimeout(() => setSuccessMessage(''), 3000);
          fetchCategoryCounts();
      } catch (e: any) { 
          showError("Помилка видалення: " + e.message); 
      } finally { 
          setIsApplyingBulk(false); 
      }
  };

  // --- BULK PHOTO OPERATIONS ---
  const handleBulkDeletePhotos = async () => {
      if (selectedTyreIds.size === 0) return;
      if (!confirm(`Видалити фото для ${selectedTyreIds.size} товарів?`)) return;

      setIsApplyingBulk(true);
      try {
          const ids = Array.from(selectedTyreIds);
          const { error } = await supabase.from('tyres').update({ image_url: null, gallery: [] }).in('id', ids);
          if (error) throw error;

          setTyres(prev => prev.map(t => selectedTyreIds.has(t.id) ? { ...t, image_url: null, gallery: [] } : t));
          setSuccessMessage(`Видалено фото для ${ids.length} товарів.`);
          setSelectedTyreIds(new Set());
          fetchCategoryCounts();
      } catch (e: any) {
          showError("Помилка видалення фото: " + e.message);
      } finally {
          setIsApplyingBulk(false);
      }
  };

  const handleBulkAiSearch = async (onlyMissing: boolean) => {
      if (selectedTyreIds.size === 0) return;

      const idsToProcess = Array.from(selectedTyreIds).filter(id => {
          if (!onlyMissing) return true;
          const t = tyres.find(ty => ty.id === id);
          return !t?.image_url;
      });

      if (idsToProcess.length === 0) {
          showError("Немає товарів для обробки.");
          return;
      }

      setIsBulkPhotoProcessing(true);
      setBulkPhotoTotal(idsToProcess.length);
      setBulkPhotoProgress(0);

      let successCount = 0;
      for (const [index, id] of idsToProcess.entries()) {
          const tyre = tyres.find(t => t.id === id);
          if (!tyre) continue;

          try {
              const cleanQ = normalizeQuery(tyre.title);
              const res = await invokeAiProxy({ mode: 'image_search', query: cleanQ });
              if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
                  const firstImg = res.data[0].imageUrl;
                  await supabase.from('tyres').update({ image_url: firstImg }).eq('id', id);
                  setTyres(prev => prev.map(t => t.id === id ? { ...t, image_url: firstImg } : t));
                  successCount++;
              }
              // Rate limiting delay
              await new Promise(r => setTimeout(r, 600)); 
          } catch (e: any) {
              if (e.message && e.message.includes('Додайте Serper')) {
                  setShowKeyNeededError(true);
                  setIsBulkPhotoProcessing(false);
                  return;
              }
              console.error(`Error processing ID ${id}:`, e);
          }
          setBulkPhotoProgress(index + 1);
      }

      setIsBulkPhotoProcessing(false);
      setSuccessMessage(`Оброблено! Додано фото для ${successCount} товарів.`);
      setSelectedTyreIds(new Set());
      fetchCategoryCounts();
  };

  return {
    bulkMarkup, setBulkMarkup, bulkCategory, isApplyingBulk,
    handleBulkPriceUpdate, handleBulkCategoryUpdate, handleBulkHotUpdate,
    handleBulkDelete, showBulkDeleteConfirm, setShowBulkDeleteConfirm, executeBulkDelete,
    handleBulkDeletePhotos, handleBulkAiSearch,
    isBulkPhotoProcessing, bulkPhotoProgress, bulkPhotoTotal, showKeyNeededError, setShowKeyNeededError,
  };
};

export type BulkActions = ReturnType<typeof useBulkActions>;
