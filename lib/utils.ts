import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const naira = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value));
export const number = (value: number) =>
  new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(
    Number(value),
  );
export const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const date = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
export function validAmount(raw: string) {
  return (
    /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw) &&
    Number(raw) > 0 &&
    Number(raw) <= 1000000
  );
}
export function safeSearch(raw: string) {
  return raw
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .slice(0, 80);
}
export function errorMessage(error: unknown) {
  const text =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "The request could not be completed.";
  return /fetch|network|abort|timeout/i.test(text)
    ? "Connection interrupted or timed out. Your input is kept. Reconnect and retry; an uncertain payment must use the same reference."
    : text;
}
export function readDraft<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function saveDraft(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function removeDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
export function clearUserDrafts(userId: string) {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(`mg:${userId}:`) && !k.endsWith(":payment"))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}
