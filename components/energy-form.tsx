"use client";
import { useState } from "react";
import type { Tenant } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { errorMessage, readDraft, saveDraft, removeDraft } from "@/lib/utils";
import { Modal } from "./modal";
import { Message } from "./shared";
import { Button } from "./ui/button";
export function EnergyForm({
  userId,
  tenant,
  onClose,
  onSaved,
}: {
  userId: string;
  tenant: Tenant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const key = `mg:${userId}:energy:${tenant.id}`;
  const [form, setForm] = useState(() =>
    readDraft(key, {
      id: crypto.randomUUID(),
      kwh: "",
      log_date: new Date().toISOString(),
    }),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    saveDraft(key, form);
    try {
      if (!/^\d+(\.\d{1,3})?$/.test(form.kwh) || Number(form.kwh) > 1000000)
        throw new Error("Enter 0–1,000,000 kWh with at most three decimals.");
      const sb = getSupabase();
      const { error } = await sb
        .from("energy_logs")
        .insert({
          id: form.id,
          tenant_id: tenant.id,
          kwh_consumed: Number(form.kwh),
          log_date: form.log_date,
        });
      if (error) {
        if (error.code !== "23505") throw error;
        const { data } = await sb
          .from("energy_logs")
          .select("id,tenant_id,kwh_consumed")
          .eq("id", form.id)
          .maybeSingle();
        if (
          !data ||
          data.tenant_id !== tenant.id ||
          Number(data.kwh_consumed) !== Number(form.kwh)
        )
          throw error;
      }
      removeDraft(key);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Log energy use" onClose={onClose} busy={busy}>
      <h3>{tenant.name}</h3>
      <p className="muted">
        Enter energy consumed over a non-overlapping interval, not a cumulative
        meter reading. Manual logs do not deduct prepaid credit.
      </p>
      <form onSubmit={submit}>
        <label>
          Energy consumed (kWh)
          <input
            required
            inputMode="decimal"
            value={form.kwh}
            disabled={busy}
            onChange={(e) => {
              const next = { ...form, kwh: e.target.value };
              setForm(next);
              saveDraft(key, next);
            }}
          />
        </label>
        <p className="muted">
          Logged at the time this form was opened. Avoid recording the same
          usage twice.
        </p>
        <Message text={error} error />
        <Button disabled={busy}>{busy ? "Saving…" : "Save energy log"}</Button>
      </form>
    </Modal>
  );
}
