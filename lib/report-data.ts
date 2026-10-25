import { getSupabase } from "./supabase";
import { sampleEnergy, samplePayments, sampleTenants } from "./demo";
import { safeSearch } from "./utils";
import {
  REPORT_LIMIT,
  type ReportResult,
  type ReportTab,
  type ReportRow,
} from "./reports";

const BATCH_SIZE = 250;

export function previewReport(
  tab: ReportTab,
  options: { query: string; filter: string },
): ReportResult {
  let rows: ReportRow[];
  if (tab === "tenants") {
    const search = safeSearch(options.query).toLocaleLowerCase();
    rows = sampleTenants.filter((t) =>
      (!options.filter || t.business_type === options.filter) &&
      (!search || `${t.name} ${t.meter_id}`.toLocaleLowerCase().includes(search))
    );
  } else if (tab === "payments") {
    rows = samplePayments;
  } else {
    rows = sampleEnergy;
  }
  return { rows, total: rows.length, truncated: false };
}

/**
 * Download only records permitted by Supabase RLS. Stable newest-first sort
 * with an ID tie-breaker. At most 1000 rows are returned to protect mobile
 * data usage; callers must clearly label any incomplete export.
 *
 * This is a convenient reporting snapshot, not a signed accounting audit.
 */
export async function fetchReport(
  tab: ReportTab,
  options: { query: string; filter: string },
): Promise<ReportResult> {
  const sb = getSupabase();
  const table = tab === "energy" ? "energy_logs" : tab;
  const columns =
    tab === "tenants"
      ? "id,operator_id,name,business_type,meter_id,current_balance,is_active,created_at"
      : tab === "payments"
        ? "id,tenant_id,amount,payment_date,status,is_simulated,idempotency_key,tenants(name,meter_id)"
        : "id,tenant_id,kwh_consumed,log_date,tenants(name,meter_id)";
  const sort =
    tab === "tenants" ? "created_at" :
    tab === "payments" ? "payment_date" : "log_date";
  const search = safeSearch(options.query);
  const rows: ReportRow[] = [];
  let total = 0;

  for (let start = 0; start < REPORT_LIMIT; start += BATCH_SIZE) {
    let request = sb
      .from(table)
      .select(columns, { count: "exact" })
      .order(sort, { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + BATCH_SIZE - 1);
    if (tab === "tenants") {
      if (search)
        request = request.or(`name.ilike.%${search}%,meter_id.ilike.%${search}%`);
      if (options.filter) request = request.eq("business_type", options.filter);
    }
    const { data, count, error } = await request;
    if (error) throw error;
    const batch = (data || []) as unknown as ReportRow[];
    rows.push(...batch);
    if (count !== null) total = count;
    if (batch.length < BATCH_SIZE || rows.length >= total) break;
  }

  // Exact totals can change during paginated reads if records are being edited.
  // Never claim this report is a complete immutable snapshot.
  return {
    rows,
    total: Math.max(total, rows.length),
    truncated: total > rows.length,
  };
}
