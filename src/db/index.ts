import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Send queries to the database host itself. The default "api.<region>" host is IPv6-only for some
// Neon regions, which fails on networks without IPv6.
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add your Neon connection string to .env.local.");
  return drizzle(neon(url), { schema });
}

let instance: ReturnType<typeof createDb> | undefined;

/** Lazily created so builds and tests do not need DATABASE_URL. */
export function db() {
  instance ??= createDb();
  return instance;
}
