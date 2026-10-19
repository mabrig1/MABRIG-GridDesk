"use client";
import { useState } from "react";
import { businessTypes, type Tenant } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import {
  errorMessage,
  label,
  readDraft,
  saveDraft,
  removeDraft,
} from "@/lib/utils";
import { Modal } from "./modal";
import { Message } from "./shared";
import { Button } from "./ui/button";
export function TenantForm({
  userId,
  tenant,
  onClose,
  onSaved,
}: {
  userId: string;
  tenant?: Tenant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const key = `mg:${userId}:tenant:${tenant?.id || "new"}`;
  const [form, setForm] = useState(() =>
    readDraft(key, {
      id: tenant?.id || crypto.randomUUID(),
      name: tenant?.name || "",
      business_type: tenant?.business_type || "household",
      meter_id: tenant?.meter_id || "",
      is_active: tenant?.is_active ?? true,
    }),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function change(patch: Partial<typeof form>) {
    const value = { ...form, ...patch };
    setForm(value);
    saveDraft(key, value);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    saveDraft(key, form);
    try {
      const sb = getSupabase();
      const fields = {
        name: form.name.trim(),
        business_type: form.business_type,
        meter_id: form.meter_id.trim(),
        is_active: form.is_active,
      };
      if (tenant) {
        const { data, error } = await sb
          .from("tenants")
          .update(fields)
          .eq("id", tenant.id)
          .select("id")
          .single();
        if (error) throw error;
        if (!data) throw new Error("No tenant was updated. Refresh and retry.");
      } else {
        const { error } = await sb
          .from("tenants")
          .insert({ id: form.id, operator_id: userId, ...fields });
        if (error) {
          if (error.code !== "23505") throw error;
          const { data } = await sb
            .from("tenants")
            .select("id,name,business_type,meter_id,is_active")
            .eq("id", form.id)
            .maybeSingle();
          if (
            !data ||
            data.name !== fields.name ||
            data.meter_id !== fields.meter_id ||
            data.business_type !== fields.business_type ||
            data.is_active !== fields.is_active
          )
            throw new Error(
              "This meter ID is already in use, or a previous save has different values. Refresh before editing.",
            );
        }
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
    <Modal
      title={tenant ? "Edit tenant" : "Add a connection"}
      onClose={onClose}
      busy={busy}
    >
      <p className="muted">
        Prepaid credit starts at ₦0.00. Meter IDs must be unique within your
        workspace.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Tenant name
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <label>
            Business type
            <select
              aria-label="Business type"
              value={form.business_type}
              onChange={(e) =>
                change({
                  business_type: e.target.value as typeof form.business_type,
                })
              }
            >
              {businessTypes.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Meter ID
            <input
              required
              maxLength={80}
              value={form.meter_id}
              onChange={(e) => change({ meter_id: e.target.value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => change({ is_active: e.target.checked })}
            />{" "}
            Active connection
          </label>
        </fieldset>
        <Message text={error} error />
        <Button disabled={busy}>{busy ? "Saving…" : "Save tenant"}</Button>
        <small>Unsent input stays in this tab until saved or signed out.</small>
      </form>
    </Modal>
  );
}
