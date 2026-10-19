"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand, Message, SetupNotice } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { errorMessage, readDraft, saveDraft, removeDraft } from "@/lib/utils";
export default function Onboarding() {
  const router = useRouter();
  const [company, setCompany] = useState(""),
    [uid, setUid] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!isConfigured()) return;
    getSupabase()
      .auth.getUser()
      .then(({ data, error }) => {
        if (error || !data.user) {
          router.push("/login/");
          return;
        }
        setUid(data.user.id);
        setCompany(readDraft(`mg:${data.user.id}:company`, ""));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [router]);
  if (!isConfigured()) return <SetupNotice />;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await getSupabase().rpc("onboard_operator", {
        p_company_name: company,
      });
      if (error) throw error;
      removeDraft(`mg:${uid}:company`);
      router.push("/dashboard/");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-wrap">
      <div className="panel auth-panel">
        <Brand />
        <h1>Make it your workspace.</h1>
        <p>
          Add your operator’s company name. Your email and account ownership are
          verified by the backend.
        </p>
        <form onSubmit={submit}>
          <label>
            Company name
            <input
              required
              minLength={2}
              maxLength={120}
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                saveDraft(`mg:${uid}:company`, e.target.value);
              }}
            />
          </label>
          <Message text={error} error />
          <Button disabled={busy || !uid}>
            {busy ? "Creating workspace…" : "Open my dashboard"}
          </Button>
        </form>
        {error && (
          <Button variant="outline" onClick={() => location.reload()}>
            Retry account check
          </Button>
        )}
      </div>
    </main>
  );
}
