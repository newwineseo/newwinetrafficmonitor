import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ n }] = await db().select({ n: count() }).from(alerts).where(eq(alerts.status, "open"));
  return (
    <>
      <Nav openAlerts={n} />
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </>
  );
}
