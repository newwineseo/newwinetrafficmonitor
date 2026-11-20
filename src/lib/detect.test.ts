import { describe, it, expect } from "vitest";
import { evaluateMetric, planAlertActions, zeroFill, newestDate, type Series, type ExistingAlert } from "./detect";
import { addDays, dateRange, daysBetween, todayInTz } from "./dates";

const DAY = "2026-11-19";

/** 7 baseline days of `base` before DAY, then `value` on DAY. */
function series(base: number, value: number | undefined, baselineDays = 7): Series {
  const s: Series = new Map();
  for (let i = 1; i <= baselineDays; i++) s.set(addDays(DAY, -i), base);
  if (value !== undefined) s.set(DAY, value);
  return s;
}

describe("evaluateMetric", () => {
  it("is ok when the drop is below the threshold", () => {
    const e = evaluateMetric("gsc_clicks", series(100, 80), DAY);
    expect(e.status).toBe("ok");
    expect(e.baseline).toBe(100);
    expect(e.dropPct).toBeCloseTo(20);
  });

  it("warns at exactly the threshold", () => {
    expect(evaluateMetric("gsc_clicks", series(100, 75), DAY).status).toBe("warning");
  });

  it("warns between 1x and 2x the threshold", () => {
    const e = evaluateMetric("gsc_clicks", series(100, 52), DAY);
    expect(e.status).toBe("warning");
    expect(e.dropPct).toBeCloseTo(48);
  });

  it("is critical at 2x the threshold", () => {
    expect(evaluateMetric("gsc_clicks", series(100, 50), DAY).status).toBe("critical");
  });

  it("is critical when the value is zero and the baseline is above zero", () => {
    // threshold 80 means 100% would only be a warning by percentage; zero must still be critical
    const e = evaluateMetric("ga4_sessions", series(225, 0), DAY, { thresholdPct: 80 });
    expect(e.status).toBe("critical");
    expect(e.dropPct).toBe(100);
  });

  it("uses per-site threshold override", () => {
    expect(evaluateMetric("gsc_clicks", series(100, 90), DAY, { thresholdPct: 5 }).status).toBe("critical");
    expect(evaluateMetric("gsc_clicks", series(100, 70), DAY, { thresholdPct: 40 }).status).toBe("ok");
  });

  it("skips low-volume metrics below the default minimum baseline of 20", () => {
    const e = evaluateMetric("gsc_clicks", series(15, 0), DAY);
    expect(e.status).toBe("low-volume");
    expect(e.dropPct).toBeNull();
  });

  it("uses per-site minimum baseline override", () => {
    expect(evaluateMetric("gsc_clicks", series(15, 0), DAY, { minBaseline: 10 }).status).toBe("critical");
    expect(evaluateMetric("gsc_clicks", series(100, 0), DAY, { minBaseline: 150 }).status).toBe("low-volume");
  });

  it("needs at least 5 of the 7 baseline days", () => {
    expect(evaluateMetric("gsc_clicks", series(100, 0, 4), DAY).status).toBe("insufficient-data");
    expect(evaluateMetric("gsc_clicks", series(100, 0, 5), DAY).status).toBe("critical");
  });

  it("averages only the days that have data", () => {
    const s = series(100, 100, 7);
    s.delete(addDays(DAY, -3));
    s.set(addDays(DAY, -1), 160); // 5 x 100 + 160 over 6 days
    expect(evaluateMetric("gsc_clicks", s, DAY).baseline).toBeCloseTo(110);
  });

  it("ignores data older than 7 days", () => {
    const s = series(100, 100);
    s.set(addDays(DAY, -8), 100000);
    expect(evaluateMetric("gsc_clicks", s, DAY).baseline).toBe(100);
  });

  it("reports no-data when the evaluated day is missing", () => {
    expect(evaluateMetric("gsc_clicks", series(100, undefined), DAY).status).toBe("no-data");
  });
});

describe("zeroFill", () => {
  it("fills missing GA4 days with 0 so a broken tag becomes a critical drop", () => {
    const raw: Series = new Map([[addDays(DAY, -2), 200]]);
    const filled = zeroFill(raw, addDays(DAY, -3), DAY);
    expect([...filled.entries()]).toEqual([
      [addDays(DAY, -3), 0], [addDays(DAY, -2), 200], [addDays(DAY, -1), 0], [DAY, 0],
    ]);

    const s = series(225, undefined);
    const e = evaluateMetric("ga4_sessions", zeroFill(s, addDays(DAY, -7), DAY), DAY);
    expect(e.status).toBe("critical");
    expect(e.value).toBe(0);
  });
});

describe("planAlertActions", () => {
  const warn = evaluateMetric("gsc_clicks", series(100, 60), DAY);
  const crit = evaluateMetric("ga4_sessions", series(100, 0), DAY);
  const ok = evaluateMetric("gsc_impressions", series(100, 95), DAY);
  const low = evaluateMetric("ga4_organic", series(10, 0), DAY);

  it("inserts warning and critical alerts only", () => {
    const { toInsert, toResolve } = planAlertActions([warn, crit, ok, low], []);
    expect(toInsert.map((a) => [a.metric, a.severity])).toEqual([
      ["gsc_clicks", "warning"], ["ga4_sessions", "critical"],
    ]);
    expect(toResolve).toEqual([]);
  });

  it("does not create a duplicate for the same metric and date (dedup)", () => {
    const existing: ExistingAlert[] = [
      { id: 1, metric: "gsc_clicks", date: DAY, status: "acknowledged" },
      { id: 2, metric: "ga4_sessions", date: DAY, status: "resolved" },
    ];
    expect(planAlertActions([warn, crit], existing).toInsert).toEqual([]);
  });

  it("still alerts on a new date for the same metric", () => {
    const existing: ExistingAlert[] = [{ id: 1, metric: "gsc_clicks", date: addDays(DAY, -1), status: "open" }];
    expect(planAlertActions([warn], existing).toInsert).toHaveLength(1);
  });

  it("auto-resolves open and acknowledged alerts once the metric recovers", () => {
    const existing: ExistingAlert[] = [
      { id: 1, metric: "gsc_impressions", date: addDays(DAY, -2), status: "open" },
      { id: 2, metric: "gsc_impressions", date: addDays(DAY, -1), status: "acknowledged" },
      { id: 3, metric: "gsc_impressions", date: addDays(DAY, -5), status: "resolved" },
      { id: 4, metric: "gsc_clicks", date: addDays(DAY, -1), status: "open" },
    ];
    expect(planAlertActions([ok], existing).toResolve).toEqual([1, 2]);
  });

  it("does not resolve on low-volume, missing data or a continuing drop", () => {
    const existing: ExistingAlert[] = [
      { id: 1, metric: "ga4_organic", date: addDays(DAY, -1), status: "open" },
      { id: 2, metric: "gsc_clicks", date: addDays(DAY, -1), status: "open" },
    ];
    const missing = evaluateMetric("ga4_organic", series(100, undefined), DAY);
    expect(planAlertActions([low, missing, warn], existing).toResolve).toEqual([]);
  });
});

describe("dates", () => {
  it("computes the calendar day in a time zone", () => {
    const t = new Date("2026-11-19T20:00:00Z"); // 01:30 on the 20th in India
    expect(todayInTz("Asia/Kolkata", t)).toBe("2026-11-20");
    expect(todayInTz("America/New_York", t)).toBe("2026-11-19");
  });
  it("adds days across month ends and counts ranges", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(daysBetween("2026-11-10", "2026-11-19")).toBe(9);
    expect(dateRange("2026-11-01", "2026-11-03")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
  });
  it("finds the newest date in a series", () => {
    expect(newestDate(series(1, 1))).toBe(DAY);
    expect(newestDate(new Map())).toBeNull();
  });
});
