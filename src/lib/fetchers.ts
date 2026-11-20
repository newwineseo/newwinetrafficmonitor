// Single entry point for metric data. "demo:" properties use the synthetic generator;
// real Google Search Console / GA4 fetchers are added in Phase 5.
import { demoGa4, demoGsc, isDemoProperty, type Ga4Row, type GscRow } from "./demo";

export type { Ga4Row, GscRow };

export async function fetchGsc(property: string, start: string, end: string): Promise<GscRow[]> {
  if (isDemoProperty(property)) return demoGsc(property, start, end);
  throw new Error("Google Search Console access is not set up yet");
}

export async function fetchGa4(propertyId: string, start: string, end: string): Promise<Ga4Row[]> {
  if (isDemoProperty(propertyId)) return demoGa4(propertyId, start, end);
  throw new Error("Google Analytics access is not set up yet");
}
