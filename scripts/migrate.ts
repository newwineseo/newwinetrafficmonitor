import "./env";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;

async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
}
main().catch((e) => { console.error(e); process.exit(1); });
