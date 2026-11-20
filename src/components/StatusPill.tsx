// Status is always shown as text; color only reinforces it.
const STYLES = {
  critical: { cls: "bg-critical text-white", label: "Critical" },
  warning: { cls: "bg-warning text-white", label: "Warning" },
  ok: { cls: "bg-ok text-white", label: "OK" },
  error: { cls: "border border-critical text-critical bg-white", label: "Data error" },
  paused: { cls: "bg-gray-200 text-gray-700", label: "Paused" },
  "low-volume": { cls: "bg-gray-200 text-gray-700", label: "Low volume" },
  "insufficient-data": { cls: "bg-gray-200 text-gray-700", label: "Not enough data" },
  "no-data": { cls: "bg-gray-200 text-gray-700", label: "No data" },
  open: { cls: "border border-critical text-critical bg-white", label: "Open" },
  acknowledged: { cls: "bg-gray-200 text-gray-800", label: "Acknowledged" },
  resolved: { cls: "border border-ok text-ok bg-white", label: "Resolved" },
  success: { cls: "bg-ok text-white", label: "Success" },
  partial: { cls: "bg-warning text-white", label: "Partial" },
  failed: { cls: "bg-critical text-white", label: "Failed" },
  running: { cls: "bg-gray-200 text-gray-700", label: "Running" },
} as const;

export type PillKind = keyof typeof STYLES;

export function StatusPill({ kind, label }: { kind: PillKind; label?: string }) {
  const s = STYLES[kind];
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      {label ?? s.label}
    </span>
  );
}
