import type { ReactNode } from "react";

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-navy">{children}</h1>
      {actions}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Banner({ children, tone = "critical" }: { children: ReactNode; tone?: "critical" | "warning" }) {
  const cls = tone === "critical" ? "bg-critical" : "bg-warning";
  return <div role="alert" className={`mb-4 rounded px-4 py-3 text-sm font-medium text-white ${cls}`}>{children}</div>;
}

export const btn = {
  primary: "inline-block rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-60",
  secondary: "inline-block rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-gray-50 disabled:opacity-60",
  danger: "inline-block rounded border border-critical bg-white px-3 py-1.5 text-sm font-medium text-critical hover:bg-red-50 disabled:opacity-60",
};

export const input = "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
