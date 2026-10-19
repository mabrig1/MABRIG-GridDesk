export const businessTypes = [
  "household",
  "welder",
  "cold_storage",
  "tailoring",
  "other",
] as const;
export type BusinessType = (typeof businessTypes)[number];
export type Tenant = {
  id: string;
  operator_id: string;
  name: string;
  business_type: BusinessType;
  meter_id: string;
  current_balance: number;
  is_active: boolean;
  created_at: string;
};
export type Payment = {
  id: string;
  tenant_id: string;
  amount: number;
  payment_date: string;
  status: string;
  is_simulated: boolean;
  idempotency_key: string;
  tenants?: { name: string; meter_id: string } | null;
};
export type EnergyLog = {
  id: string;
  tenant_id: string;
  kwh_consumed: number;
  log_date: string;
  tenants?: { name: string; meter_id: string } | null;
};
export type Summary = {
  total_tenants: number;
  active_businesses: number;
  real_revenue: number;
  simulated_collections: number;
  total_kwh: number;
  month_kwh: number;
  energy_entries: number;
};
export type PaymentResult = {
  payment_id: string;
  tenant_id: string;
  amount: number;
  status: string;
  is_simulated: boolean;
  balance: number;
  replayed: boolean;
};
export type PaymentIntent = {
  key: string;
  tenantId: string;
  amount: string;
  userId: string;
};
