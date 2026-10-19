"use client";
// Static Pages route: Dashboard uses getSupabase(), backed by createBrowserClient
// from @supabase/ssr. Auth and RLS run at Supabase; there are no Server Actions.
import { Dashboard } from "@/components/dashboard";
export default function DashboardPage() {
  return <Dashboard />;
}
