// Loads .env.local for standalone scripts (Next.js loads it itself).
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
