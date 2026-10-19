import type { Tenant, Payment, EnergyLog, Summary } from "./types";
export const sampleTenants: Tenant[] = [
  {
    id: "sample-1",
    operator_id: "sample",
    name: "Chika Cold Store",
    business_type: "cold_storage",
    meter_id: "MG-001",
    current_balance: 24500,
    is_active: true,
    created_at: "2026-10-01T09:00:00Z",
  },
  {
    id: "sample-2",
    operator_id: "sample",
    name: "Ifeanyi Metal Works",
    business_type: "welder",
    meter_id: "MG-002",
    current_balance: 12800,
    is_active: true,
    created_at: "2026-10-02T09:00:00Z",
  },
  {
    id: "sample-3",
    operator_id: "sample",
    name: "Ada Stitch Studio",
    business_type: "tailoring",
    meter_id: "MG-003",
    current_balance: 6700,
    is_active: true,
    created_at: "2026-10-03T09:00:00Z",
  },
  {
    id: "sample-4",
    operator_id: "sample",
    name: "Okafor Household",
    business_type: "household",
    meter_id: "MG-004",
    current_balance: 3500,
    is_active: true,
    created_at: "2026-10-04T09:00:00Z",
  },
  {
    id: "sample-5",
    operator_id: "sample",
    name: "Unity Provisions",
    business_type: "other",
    meter_id: "MG-005",
    current_balance: 0,
    is_active: false,
    created_at: "2026-10-05T09:00:00Z",
  },
];
export const samplePayments: Payment[] = sampleTenants
  .slice(0, 4)
  .map((t, i) => ({
    id: `sample-payment-${i}`,
    tenant_id: t.id,
    amount: t.current_balance,
    payment_date: "2026-10-18T12:00:00Z",
    status: "successful",
    is_simulated: true,
    idempotency_key: `SAMPLE-${i + 1}`,
    tenants: { name: t.name, meter_id: t.meter_id },
  }));
export const sampleEnergy: EnergyLog[] = sampleTenants
  .slice(0, 4)
  .map((t, i) => ({
    id: `sample-energy-${i}`,
    tenant_id: t.id,
    kwh_consumed: [82.5, 46.2, 18.4, 9.6][i],
    log_date: "2026-10-18T12:00:00Z",
    tenants: { name: t.name, meter_id: t.meter_id },
  }));
export const sampleSummary: Summary = {
  total_tenants: 5,
  active_businesses: 3,
  real_revenue: 0,
  simulated_collections: 47500,
  total_kwh: 156.7,
  month_kwh: 156.7,
  energy_entries: 4,
};
