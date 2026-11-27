
import React from 'react';

export type ViewState = 'home' | 'admin' | 'account' | 'oferta' | 'privacy' | 'articles' | 'delivery' | 'warranty' | 'about' | 'contacts' | 'faq' | 'city' | 'forum' | 'payment';

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
  axis?: string; // Added Axis (Position) for Truck tires
  vehicle_type?: 'car' | 'cargo' | 'suv' | 'truck' | 'agro'; // Added truck (TIR) and agro (Special)

  // Shop categories (table product_categories)
  category_id?: number | null;
  attributes?: Record<string, string> | null;
  
  // SEO fields
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  slug?: string;

  // Shop program link & site-only fields
  program_product_id?: string | null;
  image_thumb_url?: string | null;
  gallery_thumbs?: string[] | null;
  /** set on the site when a promo (site_promos) applies */
  promo_badge?: string | null;
  /** old tyres: not in stock, price to be confirmed by the manager */
  on_order?: boolean;
  /** delivery time in days from the shop program, e.g. "3" or "3-5" */
  lead_days?: string | null;
  /** a partner's offer (GPL, Omega) from the program: on order, but with a real retail price and delivery days */
  supplier_offer_id?: string | null;

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
