import { describe, it, expect } from "vitest";
import { demoGsc, demoGa4, demoGa4Newest, demoGscNewest } from "./demo";
import { evaluateMetric, zeroFill, type Series } from "./detect";
import { addDays } from "./dates";

// Check the demo scenarios produce the intended outcome on many different "today"s,
// since weekday patterns move around with the date.
const days = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i, 6)));

function evalDemo(key: string, metric: "gsc_clicks" | "ga4_sessions" | "ga4_organic" | "gsc_impressions", now: Date) {
  if (metric.startsWith("gsc")) {
    const end = demoGscNewest(now);
    const rows = demoGsc(`demo:${key}`, addDays(end, -15), end, now);
    const s: Series = new Map(rows.map((r) => [r.date, metric === "gsc_clicks" ? r.clicks : r.impressions]));
    return evaluateMetric(metric, s, end);
  }
  const end = demoGa4Newest(now);
  const start = addDays(end, -15);
  const rows = demoGa4(`demo:${key}`, start, end, now);
  const raw: Series = new Map(rows.map((r) => [r.date, metric === "ga4_sessions" ? r.sessions : r.organic]));
  return evaluateMetric(metric, zeroFill(raw, start, end), end);
}

describe("demo data", () => {
  it.each(days)("matches the 4 scenarios on %s", (now) => {
    for (const m of ["gsc_clicks", "gsc_impressions", "ga4_sessions", "ga4_organic"] as const) {
      expect(evalDemo("steady", m, now).status).toBe("ok");
      expect(evalDemo("small", m, now).status).toBe("low-volume");
    }
    const drop = evalDemo("gsc-drop", "gsc_clicks", now);
    expect(drop.status).toBe("warning");
    expect(drop.dropPct!).toBeGreaterThan(40);
    expect(drop.dropPct!).toBeLessThan(50);
    expect(evalDemo("gsc-drop", "gsc_impressions", now).status).toBe("ok");
    expect(evalDemo("gsc-drop", "ga4_sessions", now).status).toBe("ok");
    expect(evalDemo("tracking-break", "ga4_sessions", now).status).toBe("critical");
    expect(evalDemo("tracking-break", "ga4_organic", now).status).toBe("critical");
    expect(evalDemo("tracking-break", "gsc_clicks", now).status).toBe("ok");
  });

  it("is deterministic", () => {
    const now = days[0];
    expect(demoGsc("demo:steady", "2026-01-01", "2026-01-10", now)).toEqual(demoGsc("demo:steady", "2026-01-01", "2026-01-10", now));
  });
});
