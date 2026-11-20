import { describe, it, expect } from "vitest";
import { buildDigestEmail, emailSubject, pushContent, sortAlerts, type DigestAlert, type DigestProblem } from "./digest";

const a = (o: Partial<DigestAlert>): DigestAlert => ({
  siteName: "Site A", domain: "a.com", metric: "gsc_clicks", date: "2026-11-18",
  value: 126, baseline: 232, dropPct: 45.6, severity: "warning", ...o,
});
const tracking = a({ siteName: "Site B", domain: "b.com", metric: "ga4_sessions", value: 0, baseline: 225, dropPct: 100, severity: "critical" });
const problem: DigestProblem = { siteName: "Site C", domain: "c.com", error: "GSC: User does not have access" };

describe("pushContent", () => {
  it("uses the site name for a single alert", () => {
    expect(pushContent([tracking], [])).toEqual({
      title: "Traffic drop: Site B",
      body: "GA4 sessions down 100% (0 vs avg 225)",
      url: "/alerts",
    });
  });
  it("summarises several alerts and shows the worst one", () => {
    const p = pushContent([a({}), tracking, a({ metric: "gsc_impressions", dropPct: 30 })], [])!;
    expect(p.title).toBe("3 traffic drops on 2 sites");
    expect(p.body).toBe("Worst: Site B, GA4 sessions down 100% (0 vs avg 225)");
  });
  it("reports data problems when there are no alerts", () => {
    expect(pushContent([], [problem])!.title).toBe("Data problem: Site C");
  });
  it("returns null with nothing to send", () => {
    expect(pushContent([], [])).toBeNull();
  });
});

describe("email digest", () => {
  it("orders critical before warnings, then data problems", () => {
    const { text, html } = buildDigestEmail([a({}), tracking], [problem], "https://x.vercel.app/");
    expect(text.indexOf("CRITICAL")).toBeLessThan(text.indexOf("WARNING"));
    expect(text.indexOf("WARNING")).toBeLessThan(text.indexOf("DATA CONNECTION PROBLEMS"));
    expect(html.indexOf("Critical (1)")).toBeLessThan(html.indexOf("Warnings (1)"));
    expect(html.indexOf("Warnings (1)")).toBeLessThan(html.indexOf("Data connection problems (1)"));
    expect(html).toContain('href="https://x.vercel.app/alerts"');
    expect(html).toContain("max-width:640px");
    expect(text).toContain("Open dashboard: https://x.vercel.app/alerts");
  });
  it("escapes HTML in site names and errors", () => {
    const { html } = buildDigestEmail([a({ siteName: "<b>x</b>" })], [], "");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });
  it("writes clear subjects", () => {
    expect(emailSubject([tracking], [])).toBe("Traffic drop: Site B (critical)");
    expect(emailSubject([a({}), a({}), tracking], [problem])).toBe("Traffic monitor: 1 critical, 2 warnings, 1 data problem");
  });
  it("sorts critical first, then by size of drop", () => {
    expect(sortAlerts([a({ dropPct: 30 }), a({ dropPct: 40 }), tracking]).map((x) => x.dropPct)).toEqual([100, 40, 30]);
  });
});
