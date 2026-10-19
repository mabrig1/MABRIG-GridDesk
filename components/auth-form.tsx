"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Brand, Message, SetupNotice } from "./shared";
import { Button } from "./ui/button";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { errorMessage } from "@/lib/utils";
export function AuthForm({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  if (!isConfigured()) return <SetupNotice />;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const sb = getSupabase();
      if (signup) {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback/` },
        });
        if (error) throw error;
        if (data.session) router.push("/onboarding/");
        else
          setMessage(
            "Check your email to confirm your account. Open the link in this browser, then finish your workspace setup.",
          );
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard/");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-wrap">
      <div className="auth-aside">
        <div className="eyebrow">POWERING LOCAL POSSIBILITY</div>
        <h1>
          Every connection
          <br />
          has a story.
        </h1>
        <p>
          Give your team the clarity to serve households, support businesses and
          build stronger communities.
        </p>
        <ShieldCheck size={42} />
      </div>
      <div className="panel auth-panel">
        <Brand />
        <h1>{signup ? "Create your account" : "Welcome back"}</h1>
        <p>
          {signup
            ? "Your mini-grid workspace starts here."
            : "Sign in to your operator workspace."}
        </p>
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              minLength={12}
              maxLength={128}
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {signup && (
            <small>
              Use at least 12 characters. You’ll confirm your email before
              onboarding.
            </small>
          )}
          <Message text={error} error />
          <Message text={message} />
          <Button disabled={busy}>
            {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}{" "}
            <ArrowRight size={16} />
          </Button>
        </form>
        <p>
          {signup ? "Already have an account?" : "New to GridDesk?"}{" "}
          <Link href={signup ? "/login/" : "/signup/"}>
            {signup ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <Link href="/demo/" className="text-link">
          Explore without an account →
        </Link>
      </div>
    </main>
  );
}
