"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

interface Point { date: string; value: number }
interface AlertMark { date: string; severity: "warning" | "critical" }

const LINE = "#2E86C1";
const AVG = "#6B7280";
const ALERT = "#C0392B";
const HEIGHT = 220;
const M = { top: 12, right: 12, bottom: 26, left: 44 };

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/**
 * 90-day line chart: daily value, dashed average of the previous 7 days (the alert baseline),
 * and red markers on alert days. Hover or tap shows a tooltip.
 */
export function MetricChart({ title, points, alerts }: { title: string; points: Point[]; alerts: AlertMark[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (el.clientWidth) setWidth(Math.max(260, el.clientWidth));
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const avg = useMemo(() => {
    const byDate = new Map(points.map((p) => [p.date, p.value]));
    return points.map((p) => {
      const prior: number[] = [];
      const t = Date.parse(`${p.date}T00:00:00Z`);
      for (let i = 1; i <= 7; i++) {
        const v = byDate.get(new Date(t - i * 86_400_000).toISOString().slice(0, 10));
        if (v !== undefined) prior.push(v);
      }
      return prior.length >= 5 ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
    });
  }, [points]);

  const alertByDate = useMemo(() => new Map(alerts.map((a) => [a.date, a.severity])), [alerts]);

  if (points.length < 2) {
    return <div className="rounded bg-gray-50 p-6 text-center text-sm text-gray-600">No data yet for {title}.</div>;
  }

  const innerW = width - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;
  const yMax = niceMax(Math.max(...points.map((p) => p.value), ...avg.map((a) => a ?? 0)));
  const x = (i: number) => M.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  let avgPath = "";
  avg.forEach((a, i) => {
    if (a === null) return;
    avgPath += `${avgPath && avg[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)},${y(a).toFixed(1)}`;
  });

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(innerW / 70)));

  function pick(clientX: number) {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = (clientX - rect.left) * (width / rect.width) - M.left; // SVG may be scaled before first measure
    const i = Math.round((px / innerW) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  }

  const h = hover !== null ? points[hover] : null;
  const hAlert = h ? alertByDate.get(h.date) : undefined;
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover) - 80, 0), width - 160) : 0;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700">
        <span className="flex items-center gap-1.5"><svg width="16" height="8" aria-hidden><line x1="0" y1="4" x2="16" y2="4" stroke={LINE} strokeWidth="2" /></svg>Daily</span>
        <span className="flex items-center gap-1.5"><svg width="16" height="8" aria-hidden><line x1="0" y1="4" x2="16" y2="4" stroke={AVG} strokeWidth="2" strokeDasharray="4 3" /></svg>7-day average</span>
        <span className="flex items-center gap-1.5"><svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="4" fill={ALERT} /></svg>Alert day</span>
      </div>
      <div ref={wrapRef} className="relative min-w-0 select-none" style={{ touchAction: "pan-y" }}
        onPointerMove={(e) => pick(e.clientX)} onPointerDown={(e) => pick(e.clientX)} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${title}, last ${points.length} days`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="#E5E7EB" strokeWidth={1} />
              <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#6B7280">{fmt(t)}</text>
            </g>
          ))}
          {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (points.length - 1 - i >= labelEvery / 2 || i === points.length - 1) ? (
            <text key={p.date} x={x(i)} y={HEIGHT - 6} textAnchor={i === points.length - 1 ? "end" : "middle"} fontSize="11" fill="#6B7280">{day(p.date)}</text>
          ) : null)}
          <path d={avgPath} fill="none" stroke={AVG} strokeWidth={1.5} strokeDasharray="5 4" />
          <path d={line} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => alertByDate.has(p.date) ? (
            <circle key={p.date} cx={x(i)} cy={y(p.value)} r={5} fill={ALERT} stroke="#fff" strokeWidth={2} />
          ) : null)}
          {hover !== null && h && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} stroke="#9CA3AF" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(h.value)} r={4.5} fill={hAlert ? ALERT : LINE} stroke="#fff" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hover !== null && h && (
          <div className="pointer-events-none absolute top-0 z-10 w-40 rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-md" style={{ left: tipLeft }}>
            <div className="font-semibold text-navy">{day(h.date)}</div>
            <div>{title}: <span className="font-semibold">{fmt(h.value)}</span></div>
            <div className="text-gray-600">7-day avg: {avg[hover] !== null ? fmt(avg[hover]!) : "-"}</div>
            {hAlert && <div className="mt-1 font-semibold text-critical">Alert: {hAlert === "critical" ? "Critical" : "Warning"}</div>}
          </div>
        )}
      </div>
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-brand">Show data table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white"><tr><th className="py-1">Date</th><th className="py-1 text-right">Value</th><th className="py-1 text-right">7-day avg</th><th className="py-1 pl-2">Alert</th></tr></thead>
            <tbody>
              {[...points].reverse().map((p, ri) => {
                const i = points.length - 1 - ri;
                const a = alertByDate.get(p.date);
                return (
                  <tr key={p.date} className="border-t border-gray-100">
                    <td className="py-0.5">{p.date}</td>
                    <td className="py-0.5 text-right">{fmt(p.value)}</td>
                    <td className="py-0.5 text-right">{avg[i] !== null ? fmt(avg[i]!) : "-"}</td>
                    <td className="py-0.5 pl-2">{a ? (a === "critical" ? "Critical" : "Warning") : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
