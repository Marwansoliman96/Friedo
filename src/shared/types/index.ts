export interface ProductOption {
  id?: string;
  product_id?: string;
  option_type?: string; // 'size' | 'extras' | 'removals' | 'sauce' | 'beverage'
  item_name: string;
  extra_price: number;
  category?: string;
  tenant_id?: string;
  group_name?: string;
  group_name_en?: string;
  group_order?: number;
  selection_type?: 'single' | 'multi' | 'quantity';
  min_selection?: number;
  max_selection?: number;
  max_qty_per_item?: number;
  display_order?: number;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description?: string;
  base_price: number;
  image_url?: string;
  available: 'YES' | 'NO' | boolean | string;
  category_order?: number;
  display_order?: number;
  tenant_id?: string;
  options?: ProductOption[];
}

export interface MenuSection {
  id: string;
  name: string;
  order: number;
  items: Product[];
}

export interface DeliveryArea {
  id?: string;
  name: string;
  fee: number;
  tenant_id?: string;
}

export interface SelectedCustomOption {
  id?: string;
  group_name: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  selection_type?: 'single' | 'multi' | 'quantity';
}

export interface CartCustomizations {
  size?: { name: string; price: number };
  extras?: Array<{ name: string; price: number; quantity?: number }>;
  removals?: string[];
  sauce?: { name: string; price: number };
  notes?: string;
  selectedOptions?: SelectedCustomOption[];
}

export interface CartItem {
  id: string; // المعرف الفريد داخل السلة (يشمل توليفة الصنف مع خياراته)
  product: Product;
  quantity: number;
  unit_price: number;
  total_price: number;
  customizations?: CartCustomizations;
  options_summary?: string;
}

export interface RestaurantInfo {
  name: string;
  description: string;
  logo: string;
  themeColor: string;
  phone: string;
  currency: string;
}

export interface OrderSubmissionPayload {
  tenant_id: string;
  customer_name: string;
  customer_phone: string;
  order_type: 'pickup' | 'delivery';
  delivery_area?: string;
  delivery_address?: string;
  delivery_fee: number;
  subtotal: number;
  total_price: number;
  notes?: string;
  items: CartItem[];
}
