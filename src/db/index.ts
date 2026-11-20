import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Send queries to the database host itself. The default "api.<region>" host is IPv6-only for some
// Neon regions, which fails on networks without IPv6.
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;

// Retry a query up to 3 times when the connection itself fails (flaky networks). HTTP error
// responses are not retried. Writes in this app are upserts/updates, so a repeat is harmless.
neonConfig.fetchFunction = async (input: RequestInfo | URL, init?: RequestInit) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
};

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
