import type { Point } from "@/lib/queries";

/** 30-day trend line. Server-rendered SVG, no interaction. */
export function Sparkline({ points, label, width = 112, height = 32 }: {
  points: Point[]; label: string; width?: number; height?: number;
}) {
  if (points.length < 2) return <span className="text-xs text-gray-500">No data</span>;
  const max = Math.max(...points.map((p) => p.value), 1);
  const pad = 3;
  const x = (i: number) => pad + (i / (points.length - 1)) * (width - 2 * pad);
  const y = (v: number) => height - pad - (v / max) * (height - 2 * pad);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`${label}, last 30 days, latest ${Math.round(last.value)}`} className="block">
      <path d={d} fill="none" stroke="#2E86C1" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r={2.5} fill="#1B4F72" />
    </svg>
  );
}
