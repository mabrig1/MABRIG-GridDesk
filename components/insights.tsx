import type { Summary } from "@/lib/types";
import { naira, number } from "@/lib/utils";

function percent(part: number, whole: number) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

function ShareBar({
  title, value, note, pct, variant = "green",
}: {
  title: string;
  value: string;
  note: string;
  pct: number;
  variant?: "green" | "amber";
}) {
  return (
    <div className="insight-measure">
      <div className="insight-measure-header">
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
      <div
        className="insight-track"
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={`insight-fill ${variant}`} style={{ width: `${pct}%` }} />
      </div>
      <p>{note}</p>
    </div>
  );
}

export function Insights({
  summary,
  preview,
}: {
  summary: Summary | null;
  preview: boolean;
}) {
  if (!summary) return null;
  const collections = summary.real_revenue + summary.simulated_collections;
  return (
    <section className="insight-cards" aria-label="Operational insights">
      <article className="panel insight-panel">
        <div className="insight-heading">
          <div>
            <h2>Collection composition</h2>
            <p>Recorded totals across all dates · NGN</p>
          </div>
          {preview && <span className="tag">FICTIONAL SAMPLE</span>}
        </div>
        <ShareBar
          title="Non-simulated records"
          value={naira(summary.real_revenue)}
          pct={percent(summary.real_revenue, collections)}
          note="Real collections are not independently reconciled to a payment provider in this MVP."
        />
        <ShareBar
          title="Simulated collections"
          value={naira(summary.simulated_collections)}
          pct={percent(summary.simulated_collections, collections)}
          variant="amber"
          note="Test credit only — never included in real revenue."
        />
      </article>
      <article className="panel insight-panel">
        <div className="insight-heading">
          <div>
            <h2>Connection & usage insights</h2>
            <p>Workspace-wide totals, not just the visible page</p>
          </div>
          {preview && <span className="tag">FICTIONAL SAMPLE</span>}
        </div>
        <ShareBar
          title="Active businesses"
          value={`${number(summary.active_businesses)} / ${number(summary.total_tenants)}`}
          pct={percent(summary.active_businesses, summary.total_tenants)}
          note="Share of all tenants that are active non-household businesses."
        />
        <ShareBar
          title="Energy logged this month"
          value={`${number(summary.month_kwh)} / ${number(summary.total_kwh)} kWh`}
          pct={percent(summary.month_kwh, summary.total_kwh)}
          note="This month's portion of all manually recorded energy; no meter telemetry."
        />
      </article>
    </section>
  );
}
