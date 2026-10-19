"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, WifiOff } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-icon">
        <Zap size={20} fill="currentColor" />
      </span>
      <span>
        GridDesk<span className="brand-sub">BY MABRIG</span>
      </span>
    </Link>
  );
}
export function NetworkStatus() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <div className="offline" role="status">
      <WifiOff size={16} /> You’re offline. Your open forms are kept in this
      tab. Reconnect to save or confirm payments.
    </div>
  ) : null;
}
export function SetupNotice() {
  return (
    <main className="auth-wrap">
      <div className="panel auth-panel">
        <Brand />
        <h1>Connect your workspace</h1>
        <p>
          Add your Supabase project URL and publishable key, then rebuild. The
          dashboard needs an authenticated backend.
        </p>
        <Link className="btn btn-primary" href="/demo/">
          Explore the sample dashboard
        </Link>
        <p className="muted">See README.md for the exact setup steps.</p>
      </div>
    </main>
  );
}
export function Message({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return text ? (
    <div
      className={error ? "notice error" : "notice"}
      role={error ? "alert" : "status"}
    >
      {text}
    </div>
  ) : null;
}
export function Pagination({
  page,
  count,
  onChange,
  disabled = false,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pagination">
      <span>
        {count} records · Page {page + 1} of{" "}
        {Math.max(1, Math.ceil(count / 10))}
      </span>
      <div>
        <button
          className="btn btn-outline"
          disabled={!page || disabled}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="btn btn-outline"
          disabled={(page + 1) * 10 >= count || disabled}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
