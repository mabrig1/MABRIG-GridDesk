"use client";
import { useState } from "react";
import type { Tenant, PaymentIntent, PaymentResult } from "@/lib/types";
import {
  naira,
  validAmount,
  errorMessage,
  saveDraft,
  removeDraft,
  readDraft,
} from "@/lib/utils";
import { submitPayment } from "@/lib/payments";
import { Button } from "./ui/button";
import { Modal } from "./modal";
import { Message } from "./shared";
export function PaymentForm({
  userId,
  tenant,
  intent: initial,
  onClose,
  onIntent,
  onSaved,
}: {
  userId: string;
  tenant: Pick<Tenant, "id" | "name">;
  intent: PaymentIntent | null;
  onClose: () => void;
  onIntent: (i: PaymentIntent | null) => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(
      () =>
        initial?.amount ||
        readDraft<string>(`mg:${userId}:amount:${tenant.id}`, ""),
    ),
    [intent, setIntent] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<PaymentResult | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validAmount(amount)) {
      setError("Enter NGN 0.01–1,000,000 with at most two decimals.");
      return;
    }
    const request = intent || {
      key: crypto.randomUUID(),
      tenantId: tenant.id,
      amount,
      userId,
    };
    if (!saveDraft(`mg:${userId}:payment`, request)) {
      setError(
        "This browser cannot keep a retry reference. Enable session storage before making a simulation.",
      );
      return;
    }
    setIntent(request);
    onIntent(request);
    setBusy(true);
    try {
      const receipt = await submitPayment(request);
      setResult(receipt);
      removeDraft(`mg:${userId}:amount:${tenant.id}`);
      removeDraft(`mg:${userId}:payment`);
      onIntent(null);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Simulate a payment" onClose={onClose} busy={busy}>
      <div className="notice amber">
        DEMO ONLY · No real money is collected. No physical meter is changed.
      </div>
      <h3>{tenant.name}</h3>
      {result ? (
        <>
          <Message
            text={`${result.replayed ? "Existing payment confirmed" : "Simulation confirmed"}: ${naira(result.amount)}. Backend balance: ${naira(result.balance)}.`}
          />
          <p className="reference">Payment ID: {result.payment_id}</p>
          <Button onClick={onClose}>Done</Button>
        </>
      ) : (
        <form onSubmit={submit}>
          <label>
            Amount (NGN)
            <input
              required
              inputMode="decimal"
              placeholder="e.g. 5000.00"
              value={amount}
              disabled={Boolean(intent) || busy}
              onChange={(e) => {
                setAmount(e.target.value);
                saveDraft(`mg:${userId}:amount:${tenant.id}`, e.target.value);
              }}
            />
          </label>
          {intent && (
            <>
              <p className="reference">Retry reference: {intent.key}</p>
              <p className="muted">
                This request is locked to the same tenant and amount. Retry to
                confirm its result before starting another payment. The
                reference is kept in this tab.
              </p>
            </>
          )}
          <Message text={error} error />
          <Button disabled={busy}>
            {busy
              ? "Confirming with backend…"
              : intent
                ? "Retry / confirm same payment"
                : "Simulate payment"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
