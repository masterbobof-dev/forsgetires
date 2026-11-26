import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import type { TyreProduct } from '../../../types';

/** The "compare" window: loads the chosen products (in the order they were added) while it is open. */
export const useCompareWindow = (compareIds: number[], prepare: (p: TyreProduct) => TyreProduct) => {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<TyreProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (compareIds.length === 0) { setProducts([]); return; }
    setLoading(true);
    supabase.from('tyres').select('*').in('id', compareIds).then(({ data }) => {
      const list = ((data as TyreProduct[]) || []).map(prepare);
      setProducts(compareIds.map(id => list.find(p => p.id === id)).filter(Boolean) as TyreProduct[]);
      setLoading(false);
    });
  }, [open, compareIds.join(',')]);

  return { open, setOpen, products, loading };
};
