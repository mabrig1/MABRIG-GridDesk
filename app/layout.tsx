import type { Metadata } from "next";
import "./globals.css";
import { NetworkStatus } from "@/components/shared";
export const metadata: Metadata = {
  title: "GridDesk · Mini-Grid Operator Dashboard",
  description:
    "Tenant credit, collections and productive energy use. A lightweight workspace for Nigerian mini-grid operators.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-NG">
      <body>
        <NetworkStatus />
        {children}
      </body>
    </html>
  );
}
