import { getSupabase } from "./supabase";
import { validAmount } from "./utils";
import type { PaymentIntent, PaymentResult } from "./types";
export async function submitPayment(
  intent: PaymentIntent,
): Promise<PaymentResult> {
  if (!validAmount(intent.amount))
    throw new Error(
      "Enter NGN 0.01–1,000,000 using at most two decimal places.",
    );
  const { data, error } = await getSupabase().rpc("simulate_payment", {
    p_tenant_id: intent.tenantId,
    p_amount: intent.amount,
    p_idempotency_key: intent.key,
  });
  if (error) throw error;
  const result = data?.[0] as PaymentResult | undefined;
  if (
    !result ||
    result.status !== "successful" ||
    !result.is_simulated ||
    result.tenant_id !== intent.tenantId
  )
    throw new Error(
      "No authoritative confirmation received. Retry with the same reference.",
    );
  return result;
}
