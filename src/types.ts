export interface Variant {
  label: string;
  weight_estimate: string;
  price: number;
  unit: string;
}

export interface Product {
  product_id: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string;
  description?: string;
  variants?: Variant[];
  price?: number;
  unit?: string;
  weight?: string;
  price_per_unit?: number | null;
  currency: string;
  deal_type: string;
  image_reference?: string;
  image_url?: string;
  bounding_box?: [number, number, number, number];
  confidence?: number;
  origin?: string;
  is_local?: boolean;
  nutri_score?: string;
  in_stock?: boolean;
  verified?: boolean;
  price_trend?: 'stable' | 'dropping' | 'rising';
  tags?: string[];
}

export interface PromotionPeriod {
  start_date: string;
  end_date: string;
}

export interface FlyerData {
  store: string;
  location: string;
  promotion_period: PromotionPeriod;
  terms_and_conditions?: string;
  store_hours?: string;
  traffic_status?: string;
  products: Product[];
}

export interface Deal extends Product {
  store: string;
  location: string;
  start_date: string;
  end_date: string;
  terms_and_conditions?: string;
  store_hours?: string;
  traffic_status?: string;
  uploaded_at?: number;
}

export interface ListItem {
  product_id: string;
  quantity: number;
  deal: Deal;
}
