import { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import type { TyreProduct } from '../../../types';
import { invokeAiProxy } from '../../../aiProxyClient';
import type { TyresList } from './useTyresList';
import type { Messages } from './useMessages';
import { normalizeQuery } from './tyreAdminUtils';

/** Photo search for one product: the window with found pictures; the first chosen one becomes the main photo. */
export const useAiPhotoSearch = (list: TyresList, { showError, setSuccessMessage }: Messages) => {
  const { setTyres, fetchTyres, fetchCategoryCounts, tyrePage } = list;

  const [showAiSearchModal, setShowAiSearchModal] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState<any[]>([]);
  const [selectedAiUrls, setSelectedAiUrls] = useState<string[]>([]);
  const [isSearchingAi, setIsSearchingAi] = useState(false);
  const [targetTyreForAi, setTargetTyreForAi] = useState<TyreProduct | null>(null);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const [apiErrorHint, setApiErrorHint] = useState(false);

  const handleOpenAiSearch = (tyre: TyreProduct) => {
      setTargetTyreForAi(tyre);
      const q = normalizeQuery(tyre.title);
      setAiSearchQuery(q);
      setAiSearchResults([]);
      setSelectedAiUrls([]);
      setAiSearchError(null);
      setShowAiSearchModal(true);
      performAiSearch(q);
  };

  const performAiSearch = async (query: string) => {
      setIsSearchingAi(true);
      setAiSearchError(null);
      setApiErrorHint(false);
      try {
          const res = await invokeAiProxy({
              mode: 'image_search',
              query: query
          });
          if (res.ok && Array.isArray(res.data)) {
              setAiSearchResults(res.data);
              if (res.data.length === 0) {
                  setAiSearchError("Нічого не знайдено. Спробуйте змінити запит.");
              }
          }
      } catch (e: any) {
          if (e.message && e.message.includes('Додайте Serper')) {
              setApiErrorHint(true);
          } else {
              setAiSearchError(e.message);
          }
      } finally {
          setIsSearchingAi(false);
      }
  };

  const toggleAiImage = (url: string) => {
      setSelectedAiUrls(prev => 
          prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
      );
  };

  const handleSaveAiImages = async () => {
      if (!targetTyreForAi || selectedAiUrls.length === 0) return;
      const tId = targetTyreForAi.id;

      const mainUrl = selectedAiUrls[0];
      const gallery = selectedAiUrls.slice(1);

      // Optimistic update
      setTyres(prev => prev.map(t => t.id === tId ? { ...t, image_url: mainUrl, gallery } : t));

      try {
          const { error } = await supabase.from('tyres').update({ 
              image_url: mainUrl,
              gallery: gallery 
          }).eq('id', tId);
          if (error) throw error;
          setSuccessMessage("Фото та галерею оновлено!");
          setTimeout(() => setSuccessMessage(''), 2000);
          setShowAiSearchModal(false);
          fetchCategoryCounts();
      } catch (e: any) {
          showError("Помилка збереження: " + e.message);
          fetchTyres(tyrePage, true);
      }
  };

  return {
    showAiSearchModal, setShowAiSearchModal, aiSearchQuery, setAiSearchQuery, aiSearchResults, selectedAiUrls, isSearchingAi,
    targetTyreForAi, aiSearchError, apiErrorHint, setApiErrorHint,
    handleOpenAiSearch, performAiSearch, toggleAiImage, handleSaveAiImages,
  };
};

export type AiPhotoSearch = ReturnType<typeof useAiPhotoSearch>;
