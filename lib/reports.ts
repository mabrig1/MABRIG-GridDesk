import type { EnergyLog, Payment, Tenant } from "./types";

export type ReportTab = "tenants" | "payments" | "energy";
export type ReportRow = Tenant | Payment | EnergyLog;
export type ReportResult = {
  rows: ReportRow[];
  total: number;
  truncated: boolean;
};

export const REPORT_LIMIT = 1000;

// Spreadsheet applications can execute formulas in CSV cells. Treat user-entered
// names/references as plain text, even when whitespace precedes a formula prefix.
export function csvCell(value: string | number | boolean | null | undefined) {
  let cell = value == null ? "" : String(value);
  if (typeof value !== "number" && /^[\s\uFEFF]*[=+\-@]/u.test(cell))
    cell = "'" + cell;
  return '"' + cell.replaceAll('"', '""') + '"';
}

export function makeReportCsv(tab: ReportTab, rows: ReportRow[]) {
  let header: string[];
  let records: (string | number | boolean | null | undefined)[][];
  if (tab === "tenants") {
    header = [
      "Tenant name", "Meter ID", "Business type", "Active",
      "Prepaid credit (NGN)", "Created (UTC)",
    ];
    records = (rows as Tenant[]).map((r) => [
      r.name, r.meter_id, r.business_type, r.is_active,
      r.current_balance, r.created_at,
    ]);
  } else if (tab === "payments") {
    header = [
      "Tenant name", "Meter ID", "Amount (NGN)", "Simulated",
      "Status", "Date (UTC)", "Idempotency reference",
    ];
    records = (rows as Payment[]).map((r) => [
      r.tenants?.name || "", r.tenants?.meter_id || "", r.amount,
      r.is_simulated, r.status, r.payment_date, r.idempotency_key,
    ]);
  } else {
    header = ["Tenant name", "Meter ID", "Energy (kWh)", "Date (UTC)"];
    records = (rows as EnergyLog[]).map((r) => [
      r.tenants?.name || "", r.tenants?.meter_id || "",
      r.kwh_consumed, r.log_date,
    ]);
  }
  return "\uFEFF" + [header, ...records].map((row) =>
    row.map(csvCell).join(",")
  ).join("\r\n") + "\r\n";
}

export function reportFileName(
  tab: ReportTab,
  preview: boolean,
  truncated: boolean,
  today = new Date(),
) {
  const date = today.toISOString().slice(0, 10);
  return `griddesk-${tab}-${preview ? "fictional-sample-" : ""}${truncated ? "partial-" : ""}${date}.csv`;
}

export function downloadReport(csv: string, name: string) {
  const url = URL.createObjectURL(new Blob([csv], {
    type: "text/csv;charset=utf-8",
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
