export interface User {
  id: number;
  username: string;
  first_name: string;
  other_names?: string;
  email?: string;
  phone?: string;
  group_id?: number;
  status: string;
  last_login?: Date;
  created_at: Date;
}

export interface Customer {
  id: number;
  account_no: string;
  contract_no?: string;
  conn_no?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  national_id?: string;
  category_id?: number;
  typology_id?: number;
  billing_group_id?: number;
  route_id?: number;
  walk_no?: string;
  zone_id?: number;
  address?: string;
  town?: string;
  po_box?: string;
  plot_no?: string;
  telephone?: string;
  email?: string;
  dma_id?: number;
  account_status: string;
  balance: number;
  deposit_amount: number;
  created_at: Date;
}

export interface Meter {
  id: number;
  meter_no: string;
  meter_type_id?: number;
  meter_status: string;
  meter_location?: string;
  customer_id?: number;
  install_date?: Date;
  barcode_no?: string;
  digits: number;
  max_reading?: number;
  current_reading: number;
  dma_id?: number;
  created_at: Date;
}

export interface Bill {
  id: number;
  bill_no: string;
  customer_id: number;
  billing_period_id?: number;
  bill_date: Date;
  due_date?: Date;
  prev_reading?: number;
  curr_reading?: number;
  consumption?: number;
  water_charge: number;
  sewer_charge: number;
  rent_charge: number;
  misc_charge: number;
  fixed_charge: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: string;
  bill_type: string;
  created_at: Date;
}

export interface Payment {
  id: number;
  receipt_no: string;
  customer_id?: number;
  bill_id?: number;
  amount: number;
  payment_date: Date;
  payment_mode_id?: number;
  payment_category_id?: number;
  reference?: string;
  cashier_id?: number;
  notes?: string;
  is_cancelled: boolean;
  created_at: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
