// Sends the per-run email digest and push notification. Implemented in Phase 3.
import type { Site } from "@/db/schema";
import type { NewAlert } from "./detect";

export interface AlertForNotify extends NewAlert { id: number; site: Site }
export interface DataProblem { site: Site; error: string }

export async function notifyRun(alerts: AlertForNotify[], problems: DataProblem[], log: (m: string) => void) {
  if (alerts.length || problems.length) {
    log(`Notifications not set up yet: ${alerts.length} new alert(s), ${problems.length} new data problem(s)`);
  }
  return { emailsSent: 0, pushesSent: 0 };
}
