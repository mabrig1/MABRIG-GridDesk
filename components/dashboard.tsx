"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Activity,
  LogOut,
  Plus,
  Search,
  ArrowUpRight,
  RefreshCw,
  Leaf,
  Zap,
} from "lucide-react";
import { getSupabase, isConfigured } from "@/lib/supabase";
import {
  naira,
  number,
  label,
  date,
  errorMessage,
  safeSearch,
  readDraft,
  clearUserDrafts,
} from "@/lib/utils";
import {
  businessTypes,
  type Tenant,
  type Summary,
  type Payment,
  type EnergyLog,
  type PaymentIntent,
} from "@/lib/types";
import {
  sampleTenants,
  sampleSummary,
  samplePayments,
  sampleEnergy,
} from "@/lib/demo";
import { Brand, Message, Pagination, SetupNotice } from "./shared";
import { Button } from "./ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import { TenantForm } from "./tenant-form";
import { PaymentForm } from "./payment-form";
import { EnergyForm } from "./energy-form";
type Tab = "tenants" | "payments" | "energy";
export function Dashboard({ preview = false }: { preview?: boolean }) {
  const [uid, setUid] = useState(preview ? "sample" : ""),
    [company, setCompany] = useState(preview ? "Nsukka Community Energy" : ""),
    [authReady, setAuthReady] = useState(preview),
    [demo, setDemo] = useState(false);
  const [tab, setTab] = useState<Tab>("tenants"),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]),
    [payments, setPayments] = useState<Payment[]>([]),
    [energy, setEnergy] = useState<EnergyLog[]>([]),
    [summary, setSummary] = useState<Summary | null>(null),
    [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [refresh, setRefresh] = useState(0),
    [updated, setUpdated] = useState("");
  const [tenantForm, setTenantForm] = useState<Tenant | "new" | null>(null),
    [payTenant, setPayTenant] = useState<Pick<Tenant, "id" | "name"> | null>(
      null,
    ),
    [energyTenant, setEnergyTenant] = useState<Tenant | null>(null),
    [intent, setIntent] = useState<PaymentIntent | null>(null);
  const version = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(safeSearch(search));
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (preview || !isConfigured()) return;
    let active = true;
    const sb = getSupabase();
    (async () => {
      try {
        const { data, error } = await sb.auth.getUser();
        if (error || !data.user) {
          if (error && /fetch|network|abort|timeout/i.test(error.message))
            throw error;
          location.replace("/login/");
          return;
        }
        const { data: profile, error: profileError } = await sb
          .from("operators")
          .select("id,company_name")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile) {
          location.replace("/onboarding/");
          return;
        }
        const { data: allowed, error: accessError } =
          await sb.rpc("demo_access");
        if (accessError) throw accessError;
        if (!active) return;
        setUid(data.user.id);
        setCompany(profile.company_name);
        setDemo(Boolean(allowed));
        const saved = readDraft<PaymentIntent | null>(
          `mg:${data.user.id}:payment`,
          null,
        );
        if (saved?.userId === data.user.id) setIntent(saved);
        setAuthReady(true);
      } catch (e) {
        if (active) {
          setError(errorMessage(e));
          setLoading(false);
        }
      }
    })();
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setTenants([]);
        setPayments([]);
        setEnergy([]);
        setSummary(null);
        location.replace("/login/");
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [preview]);
  const load = useCallback(async () => {
    if (!authReady) return;
    const request = ++version.current;
    setLoading(true);
    setError("");
    try {
      if (preview) {
        const matched = sampleTenants.filter(
          (t) =>
            (!filter || t.business_type === filter) &&
            `${t.name} ${t.meter_id}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        );
        setTenants(matched);
        setPayments(samplePayments);
        setEnergy(sampleEnergy);
        setSummary(sampleSummary);
        setCount(tab === "tenants" ? matched.length : 4);
        setUpdated("Illustrative sample");
        return;
      }
      const sb = getSupabase();
      let result;
      if (tab === "tenants") {
        let q = sb
          .from("tenants")
          .select(
            "id,operator_id,name,business_type,meter_id,current_balance,is_active,created_at",
            { count: "exact" },
          )
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(page * 10, page * 10 + 9);
        if (query) q = q.or(`name.ilike.%${query}%,meter_id.ilike.%${query}%`);
        if (filter) q = q.eq("business_type", filter);
        result = await q;
      } else if (tab === "payments")
        result = await sb
          .from("payments")
          .select(
            "id,tenant_id,amount,payment_date,status,is_simulated,idempotency_key,tenants(name,meter_id)",
            { count: "exact" },
          )
          .order("payment_date", { ascending: false })
          .order("id", { ascending: false })
          .range(page * 10, page * 10 + 9);
      else
        result = await sb
          .from("energy_logs")
          .select("id,tenant_id,kwh_consumed,log_date,tenants(name,meter_id)", {
            count: "exact",
          })
          .order("log_date", { ascending: false })
          .order("id", { ascending: false })
          .range(page * 10, page * 10 + 9);
      if (result.error) throw result.error;
      const stats = await sb.rpc("dashboard_summary");
      if (stats.error) throw stats.error;
      if (request !== version.current) return;
      if (tab === "tenants") setTenants(result.data as Tenant[]);
      else if (tab === "payments")
        setPayments(result.data as unknown as Payment[]);
      else setEnergy(result.data as unknown as EnergyLog[]);
      setCount(result.count || 0);
      setSummary(stats.data as Summary);
      setUpdated(
        new Date().toLocaleTimeString("en-NG", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (e) {
      if (request === version.current) setError(errorMessage(e));
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [authReady, preview, tab, page, query, filter]);
  useEffect(() => {
    void load();
  }, [load, refresh]);
  function changeTab(next: Tab) {
    setTab(next);
    setPage(0);
    setError("");
    setNotice("");
  }
  function saved(message: string) {
    setTenantForm(null);
    setEnergyTenant(null);
    setNotice(message);
    setRefresh((x) => x + 1);
  }
  async function logout() {
    try {
      const { error } = await getSupabase().auth.signOut({ scope: "local" });
      if (error) throw error;
      clearUserDrafts(uid);
      location.replace("/login/");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  if (!preview && !isConfigured()) return <SetupNotice />;
  if (!authReady)
    return (
      <main className="auth-wrap">
        <div className="panel auth-panel">
          <Brand />
          <h1>{error ? "Workspace unavailable" : "Opening your workspace…"}</h1>
          <Message text={error} error />
          {error && (
            <Button onClick={() => location.reload()}>Retry connection</Button>
          )}
        </div>
      </main>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace">
          <span className="avatar">{company.slice(0, 1) || "G"}</span>
          <div>
            <strong>{company}</strong>
            <small>Operator workspace</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {(
            [
              { id: "tenants", icon: LayoutDashboard, name: "Overview" },
              { id: "payments", icon: Wallet, name: "Payments" },
              { id: "energy", icon: Activity, name: "Energy usage" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "nav-item selected" : "nav-item"}
              onClick={() => changeTab(item.id)}
            >
              <item.icon size={19} />
              {item.name}
              {tab === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Leaf size={23} />
          <strong>
            Small grids.
            <br />
            Lasting impact.
          </strong>
          <p>Better records for the communities you power.</p>
        </div>
        <div className="sidebar-bottom">
          {preview ? (
            <Link href="/signup/" className="btn btn-primary">
              Create workspace <ArrowUpRight size={16} />
            </Link>
          ) : (
            <button className="nav-item" onClick={logout}>
              <LogOut size={18} />
              Sign out
            </button>
          )}
          <small>GridDesk · by MABRIG</small>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="app-topbar">
          <span>
            Workspace{" "}
            <span className="breadcrumb">
              /{" "}
              {tab === "tenants"
                ? "Overview"
                : tab === "payments"
                  ? "Payments"
                  : "Energy usage"}
            </span>
          </span>
          <span className="top-status">
            <span className="dot" />
            {preview
              ? "SAMPLE DATA"
              : demo
                ? "DEMO ENVIRONMENT"
                : "OPERATOR WORKSPACE"}
          </span>
        </header>
        <main className="dashboard-main">
          {preview && (
            <div className="preview-banner">
              <span>
                <strong>Sample dashboard</strong> · Fictional records for a
                guided preview. No live account or payments.
              </span>
              <Link href="/signup/">Connect your own workspace →</Link>
            </div>
          )}
          {demo && (
            <div className="notice amber">
              Demo workspace · Simulations use test credit only. Real
              collections are tracked separately.
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR GRID, AT A GLANCE</div>
              <h1>
                {tab === "tenants"
                  ? "Powering your everyday."
                  : tab === "payments"
                    ? "Every collection, clearly."
                    : "Understand your energy."}
              </h1>
              <p>
                {tab === "tenants"
                  ? "A clear view of your customers, credit and community."
                  : tab === "payments"
                    ? "An auditable history. Simulated payments are always labelled."
                    : "Manual consumption records across your connected community."}
              </p>
            </div>
            <Button
              onClick={() =>
                preview
                  ? setNotice(
                      "Create an account and connect Supabase to add real workspace records.",
                    )
                  : setTenantForm("new")
              }
            >
              <Plus size={17} />
              Add tenant
            </Button>
          </div>
          <section className="stats" aria-label="Workspace totals">
            <Stat
              title="Total Tenants"
              value={summary ? number(summary.total_tenants) : "—"}
              note="All connections in your workspace"
              icon={<Users size={19} />}
            />
            <Stat
              title="Total Revenue Collected"
              value={summary ? naira(summary.real_revenue) : "—"}
              note="Successful, non-simulated payments"
              icon={<Wallet size={19} />}
            />
            <Stat
              title="Active Businesses"
              value={summary ? number(summary.active_businesses) : "—"}
              note="Active non-household connections"
              icon={<Activity size={19} />}
            />
          </section>
          <div className="insight-row">
            <span>
              <span className="small-icon">
                <Zap size={17} />
              </span>
              <strong>{summary ? number(summary.month_kwh) : "—"} kWh</strong>{" "}
              logged this month <span className="muted">· Lagos time</span>
            </span>
            <span className="demo-total">
              Simulated collections{" "}
              <strong>
                {summary ? naira(summary.simulated_collections) : "—"}
              </strong>
              <span className="tag">NOT REAL REVENUE</span>
            </span>
          </div>
          {intent && (
            <div className="notice amber">
              <strong>A payment needs confirmation.</strong> Keep this
              reference: <span className="reference">{intent.key}</span>{" "}
              <button
                className="text-link"
                onClick={() =>
                  setPayTenant({
                    id: intent.tenantId,
                    name: "Payment awaiting confirmation",
                  })
                }
              >
                Resume the same request →
              </button>
            </div>
          )}
          <Message text={notice} />
          <Message text={error} error />
          {error && (
            <Button variant="outline" onClick={() => setRefresh((x) => x + 1)}>
              Retry loading data
            </Button>
          )}
          <section className="panel data-panel">
            <div className="data-title">
              <div>
                <h2>
                  {tab === "tenants"
                    ? "Your connections"
                    : tab === "payments"
                      ? "Payment history"
                      : "Energy records"}
                </h2>
                <p>
                  {tab === "tenants"
                    ? "Manage the people and businesses on your grid."
                    : tab === "payments"
                      ? "Amounts are in Nigerian naira (NGN)."
                      : "Consumption is entered in kilowatt-hours (kWh)."}
                </p>
              </div>
              <Button
                variant="ghost"
                aria-label="Refresh data"
                disabled={loading}
                onClick={() => setRefresh((x) => x + 1)}
              >
                <RefreshCw size={17} />
                <span>Refresh</span>
              </Button>
            </div>
            {tab === "tenants" && (
              <div className="filters">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search tenants"
                    placeholder="Search name or meter ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter business type"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All business types</option>
                  {businessTypes.map((t) => (
                    <option key={t} value={t}>
                      {label(t)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {loading ? (
              <div className="empty" role="status">
                Loading your latest records…
              </div>
            ) : error ? (
              <div className="empty">
                Records could not be refreshed. Retry when your connection
                returns.
              </div>
            ) : count === 0 ? (
              <div className="empty">
                <Users size={30} />
                <h3>
                  {tab === "tenants"
                    ? "No connections found"
                    : tab === "payments"
                      ? "No payments yet"
                      : "No energy logs yet"}
                </h3>
                <p>
                  {tab === "tenants"
                    ? "Add your first tenant or adjust the search filters."
                    : tab === "payments"
                      ? "Confirmed payments will appear here."
                      : "Choose “Log energy” beside a tenant to begin."}
                </p>
              </div>
            ) : (
              <>
                {tab === "tenants" && (
                  <>
                    <div className="tenant-table">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {[
                              "Name",
                              "Business Type",
                              "Meter ID",
                              "Balance",
                              "Status",
                              "Actions",
                            ].map((h) => (
                              <TableHead key={h}>{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tenants.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell>
                                <div className="tenant-name">
                                  <span
                                    className={`tenant-icon ${t.business_type}`}
                                  >
                                    <Zap size={16} />
                                  </span>
                                  <strong>{t.name}</strong>
                                </div>
                              </TableCell>
                              <TableCell>{label(t.business_type)}</TableCell>
                              <TableCell>
                                <span className="meter">{t.meter_id}</span>
                              </TableCell>
                              <TableCell>
                                <strong className="balance">
                                  {naira(t.current_balance)}
                                </strong>
                                <small className="credit-label">
                                  prepaid credit
                                </small>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`status ${t.is_active ? "active" : "inactive"}`}
                                >
                                  <span />
                                  {t.is_active ? "Active" : "Inactive"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="row-actions">
                                  <button
                                    onClick={() =>
                                      preview
                                        ? setNotice(
                                            "Sample data is read-only. Create a workspace to manage tenants.",
                                          )
                                        : setTenantForm(t)
                                    }
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() =>
                                      preview
                                        ? setNotice(
                                            "Log energy after connecting an authenticated workspace.",
                                          )
                                        : setEnergyTenant(t)
                                    }
                                  >
                                    Log energy
                                  </button>
                                  {demo && (
                                    <button
                                      disabled={!t.is_active || Boolean(intent)}
                                      onClick={() => setPayTenant(t)}
                                    >
                                      Simulate Payment
                                    </button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="tenant-cards">
                      {tenants.map((t) => (
                        <article className="tenant-card" key={t.id}>
                          <div className="tenant-card-top">
                            <div className="tenant-name">
                              <span
                                className={`tenant-icon ${t.business_type}`}
                              >
                                <Zap size={16} />
                              </span>
                              <div>
                                <strong>{t.name}</strong>
                                <small>
                                  {label(t.business_type)} · {t.meter_id}
                                </small>
                              </div>
                            </div>
                            <span
                              className={`status ${t.is_active ? "active" : "inactive"}`}
                            >
                              {t.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div className="tenant-card-credit">
                            <span>Prepaid credit</span>
                            <strong>{naira(t.current_balance)}</strong>
                          </div>
                          <div className="row-actions">
                            <button
                              onClick={() =>
                                preview
                                  ? setNotice(
                                      "Sample data is read-only. Create a workspace to manage tenants.",
                                    )
                                  : setTenantForm(t)
                              }
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                preview
                                  ? setNotice(
                                      "Log energy after connecting an authenticated workspace.",
                                    )
                                  : setEnergyTenant(t)
                              }
                            >
                              Log energy
                            </button>
                            {demo && (
                              <button
                                disabled={!t.is_active || Boolean(intent)}
                                onClick={() => setPayTenant(t)}
                              >
                                Simulate Payment
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
                {tab === "payments" && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          "Tenant",
                          "Amount",
                          "Type",
                          "Status",
                          "Date (Lagos)",
                          "Reference",
                        ].map((h) => (
                          <TableHead key={h}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <strong>{p.tenants?.name || "Tenant"}</strong>
                            <small className="credit-label">
                              {p.tenants?.meter_id}
                            </small>
                          </TableCell>
                          <TableCell>{naira(p.amount)}</TableCell>
                          <TableCell>
                            <span
                              className={
                                p.is_simulated ? "tag amber-tag" : "tag"
                              }
                            >
                              {p.is_simulated ? "SIMULATED" : "REAL"}
                            </span>
                          </TableCell>
                          <TableCell>{label(p.status)}</TableCell>
                          <TableCell>{date(p.payment_date)}</TableCell>
                          <TableCell>
                            <span className="reference">
                              {p.idempotency_key}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {tab === "energy" && (
                  <>
                    <div className="energy-summary">
                      <strong>
                        {summary ? number(summary.total_kwh) : "—"} kWh
                      </strong>{" "}
                      total recorded · {summary?.energy_entries || 0} entries.
                      Logs do not automatically debit credit.
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {[
                            "Tenant",
                            "Meter ID",
                            "Consumption",
                            "Date (Lagos)",
                          ].map((h) => (
                            <TableHead key={h}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {energy.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell>
                              <strong>{e.tenants?.name || "Tenant"}</strong>
                            </TableCell>
                            <TableCell>{e.tenants?.meter_id}</TableCell>
                            <TableCell>{number(e.kwh_consumed)} kWh</TableCell>
                            <TableCell>{date(e.log_date)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
                <Pagination
                  page={page}
                  count={count}
                  disabled={loading}
                  onChange={setPage}
                />
              </>
            )}
          </section>
          <div className="data-foot">
            <span>
              {updated ? `Last refreshed: ${updated}` : "Waiting for data"} ·
              Totals cover all records
            </span>
            <span>Secure records. Clear decisions.</span>
          </div>
          <p className="connectivity-note">
            Saving records requires connectivity. GridDesk does not process real
            money, control meters or provide offline billing.
          </p>
        </main>
      </div>
      {tenantForm && (
        <TenantForm
          userId={uid}
          tenant={tenantForm === "new" ? undefined : tenantForm}
          onClose={() => setTenantForm(null)}
          onSaved={() => saved("Tenant saved and confirmed by the backend.")}
        />
      )}{" "}
      {payTenant && (
        <PaymentForm
          userId={uid}
          tenant={payTenant}
          intent={intent}
          onIntent={setIntent}
          onClose={() => setPayTenant(null)}
          onSaved={() => {
            setRefresh((x) => x + 1);
          }}
        />
      )}
      {energyTenant && (
        <EnergyForm
          userId={uid}
          tenant={energyTenant}
          onClose={() => setEnergyTenant(null)}
          onSaved={() =>
            saved("Energy log saved and confirmed by the backend.")
          }
        />
      )}
    </div>
  );
}
function Stat({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="stat-card">
      <div>
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}
