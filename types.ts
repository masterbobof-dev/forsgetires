
import React from 'react';

export type ViewState = 'home' | 'prices' | 'gallery' | 'admin' | 'shop';

export interface ServiceItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavItem {
  label: string;
  view: ViewState;
}

export interface Supplier {
  id: number;
  name: string;
  contact_info?: string;
}

export interface TyreProduct {
  id: number;
  title: string;
  description: string;
  price: string;        // Retail Price (New/Current Price)
  base_price?: string;  // Base Price (Cost)
  old_price?: string;   // Old Price (Crossed out)
  catalog_number?: string; // Catalog Number (Артикул)
  product_number?: string; // Product Number (Номер товару)
  manufacturer?: string;
  image_url: string;
  gallery?: string[];   // Array of image URLs
  radius?: string;
  created_at?: string;
  in_stock?: boolean;   // Availability status
  is_hot?: boolean;     // Hot deal / Sale status
  
  // New fields
  supplier_id?: number;
  stock_quantity?: number;

  // Computed properties for filtering
  width?: string;
  height?: string;
  season?: string;
  vehicle_type?: 'car' | 'cargo' | 'suv'; // Added for C-type detection
  
  // Cart Logic
  quantity?: number;
}

export interface CartItem extends TyreProduct {
  quantity: number;
}

export interface TyreOrder {
  id: number;
  tyre_id?: number; // Kept for backward compat
  items?: CartItem[]; // New cart support
  customer_name: string;
  customer_phone: string;
  status: string;
  created_at: string;
  tyres?: TyreProduct; // For join query result (legacy)
  // Delivery info
  delivery_method?: 'pickup' | 'newpost';
  delivery_city?: string;
  delivery_warehouse?: string;
  payment_method?: 'prepayment' | 'full';
}

export interface Article {
  id: number;
  title: string;
  content: string;
  image_url?: string;
  created_at: string;
}
