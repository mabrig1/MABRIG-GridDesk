"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { Brand, Message, SetupNotice } from "@/components/shared";
import { errorMessage } from "@/lib/utils";
export default function Callback() {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isConfigured() || started.current) return;
    started.current = true;
    (async () => {
      try {
        const params = new URLSearchParams(location.search);
        if (params.get("error"))
          throw new Error(
            params.get("error_description") || "Email confirmation failed.",
          );
        const code = params.get("code");
        if (code) {
          const { error } =
            await getSupabase().auth.exchangeCodeForSession(code);
          if (error) throw error;
          history.replaceState(null, "", "/auth/callback/");
        }
        const { data, error } = await getSupabase().auth.getUser();
        if (error || !data.user)
          throw new Error(
            "Open the confirmation link in the browser where you signed up, or sign in after confirming your email.",
          );
        location.replace("/onboarding/");
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, []);
  if (!isConfigured()) return <SetupNotice />;
  return (
    <main className="auth-wrap">
      <div className="panel auth-panel">
        <Brand />
        <h1>{error ? "Let’s reconnect" : "Confirming your account…"}</h1>
        <Message text={error} error />
        {error && (
          <Link href="/login/" className="btn btn-primary">
            Return to sign in
          </Link>
        )}
      </div>
    </main>
  );
}
