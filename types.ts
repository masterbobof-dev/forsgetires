
import React from 'react';

export type ViewState = 'home' | 'prices' | 'gallery' | 'admin';

export interface ServiceItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavItem {
  label: string;
  view: ViewState;
}
