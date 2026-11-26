import { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import type { TyreProduct } from '../../../types';
import type { TyresList } from './useTyresList';
import type { Messages } from './useMessages';

/**
 * What can be done with one row of the list: change the price or stock right in the table, mark as a hit,
 * copy the name / a text for a messenger, delete.
 */
export const useRowActions = (list: TyresList, { showError, setSuccessMessage }: Messages) => {
  const { setTyres, fetchTyres, tyrePage } = list;

  // Inline editing state
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [inlineValue, setInlineValue] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tyreToDelete, setTyreToDelete] = useState<number | null>(null);

  const handleCopyTitle = (text: string) => {
      navigator.clipboard.writeText(text);
      setSuccessMessage(`Скопійовано: ${text}`);
      setTimeout(() => setSuccessMessage(''), 2500);
  };

  const handleShareProduct = (tyre: TyreProduct) => {
      const shareText = `🛞 *${tyre.title}*\n💰 Ціна: ${tyre.price} грн\n📦 В наявності: ${tyre.stock_quantity || 'Так'}\n🔗 https://forsage-tyre.com.ua/product/${tyre.slug || tyre.id}`;
      navigator.clipboard.writeText(shareText);
      setSuccessMessage("Текст для месенджера скопійовано!");
      setTimeout(() => setSuccessMessage(''), 2500);
  };

  const handleInlineUpdate = async (id: number, field: 'price' | 'stock_quantity', value: string) => {
      const numVal = parseInt(value);
      if (isNaN(numVal)) {
          setEditingPriceId(null);
          setEditingStockId(null);
          return;
      }

      // Optimistic update
      setTyres(prev => prev.map(t => t.id === id ? { ...t, [field]: numVal } : t));

      try {
          const { error } = await supabase.from('tyres').update({ [field]: numVal }).eq('id', id);
          if (error) throw error;
          setSuccessMessage("Оновлено!");
          setTimeout(() => setSuccessMessage(''), 1500);
      } catch (e: any) {
          showError("Помилка: " + e.message);
          fetchTyres(tyrePage, true); // Revert on error
      } finally {
          setEditingPriceId(null);
          setEditingStockId(null);
      }
  };

  const handleQuickHotToggle = async (tyre: TyreProduct) => {
      const newStatus = !tyre.is_hot;
      setTyres(prev => prev.map(t => t.id === tyre.id ? { ...t, is_hot: newStatus } : t));
      try {
          const { error } = await supabase.from('tyres').update({ is_hot: newStatus }).eq('id', tyre.id);
          if (error) throw error;
      } catch (e: any) {
          setTyres(prev => prev.map(t => t.id === tyre.id ? { ...t, is_hot: !newStatus } : t));
          showError("Помилка оновлення: " + e.message);
      }
  };

  const handleDeleteTyre = async () => {
    if (tyreToDelete) {
        await supabase.from('tyres').delete().eq('id', tyreToDelete);
        setTyreToDelete(null);
        setShowDeleteModal(false);
        fetchTyres(0, true);
    }
  };

  return {
    editingPriceId, setEditingPriceId, editingStockId, setEditingStockId, inlineValue, setInlineValue, handleInlineUpdate,
    handleQuickHotToggle, handleCopyTitle, handleShareProduct,
    showDeleteModal, setShowDeleteModal, tyreToDelete, setTyreToDelete, handleDeleteTyre,
  };
};

export type RowActions = ReturnType<typeof useRowActions>;
