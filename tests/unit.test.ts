import test from "node:test";
import assert from "node:assert/strict";
import { validAmount, safeSearch, naira } from "../lib/utils";
import { samplePayments, sampleSummary, sampleTenants } from "../lib/demo";
test("Payment validation rejects ambiguous, excessive and fractional-kobo amounts", () => {
  for (const input of [
    "",
    "-1",
    "0",
    "0.001",
    "1e3",
    "1000000.01",
    "NaN",
    "Infinity",
    "5,000",
    " 20",
    "01",
  ])
    assert.equal(validAmount(input), false, input);
  for (const input of ["0.01", "1", "5000.50", "1000000"])
    assert.equal(validAmount(input), true, input);
});
test("Search removes PostgREST filter syntax", () => {
  assert.equal(
    safeSearch(" Ada,(operator_id.eq.other)% "),
    "Adaoperator_ideqother",
  );
  assert.equal(safeSearch("Chịka M-1"), "Chịka M-1");
});
test("NGN formatting and sample totals accurately separate simulated revenue", () => {
  assert.match(naira(1200.5), /1,200\.50/);
  assert.equal(sampleSummary.real_revenue, 0);
  assert.equal(
    samplePayments.reduce((sum, p) => sum + p.amount, 0),
    sampleSummary.simulated_collections,
  );
  assert.equal(
    sampleTenants.filter((t) => t.is_active && t.business_type !== "household")
      .length,
    sampleSummary.active_businesses,
  );
});

import { csvCell, makeReportCsv, reportFileName, REPORT_LIMIT } from "../lib/reports";
test("CSV export escapes formulas, quote delimiters, unicode and line breaks", () => {
  assert.equal(csvCell("=1+1"), `"'=1+1"`);
  assert.equal(csvCell("  @SUM(A1:A2)"), `"'  @SUM(A1:A2)"`);
  assert.equal(csvCell("\t+cmd"), `"'\t+cmd"`);
  assert.equal(csvCell("-2+5"), `"'-2+5"`);
  assert.equal(csvCell(12.5), '"12.5"');
  assert.equal(csvCell('Ada, "Chika"\r\nStore'), '"Ada, ""Chika""\r\nStore"');
  const csv = makeReportCsv("tenants", [{ ...sampleTenants[0], name: '=HYPERLINK("https://evil.invalid")' }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""https://evil.invalid"")"'));
  assert.ok(csv.includes("Prepaid credit (NGN)"));
  assert.equal(REPORT_LIMIT, 1000);
  assert.equal(reportFileName("payments", true, false, new Date("2026-10-25T12:00:00Z")),
    "griddesk-payments-fictional-sample-2026-10-25.csv");
  assert.equal(reportFileName("energy", false, true, new Date("2026-10-25T12:00:00Z")),
    "griddesk-energy-partial-2026-10-25.csv");
});
