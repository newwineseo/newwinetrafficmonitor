import {
  pgTable, serial, text, integer, real, boolean, timestamp, date, jsonb,
  primaryKey, unique, index,
} from "drizzle-orm/pg-core";

export const METRICS = ["gsc_clicks", "gsc_impressions", "ga4_sessions", "ga4_organic"] as const;
export type Metric = (typeof METRICS)[number];

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  gscProperty: text("gsc_property"),
  ga4PropertyId: text("ga4_property_id"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  thresholdPct: real("threshold_pct"),
  minBaseline: real("min_baseline"),
  metrics: text("metrics").array().$type<Metric[]>().notNull()
    .default(["gsc_clicks", "gsc_impressions", "ga4_sessions", "ga4_organic"]),
  extraRecipients: text("extra_recipients").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  lastFetchAt: timestamp("last_fetch_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyMetrics = pgTable("daily_metrics", {
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  metric: text("metric").$type<Metric>().notNull(),
  date: date("date", { mode: "string" }).notNull(),
  value: real("value").notNull(),
}, (t) => [primaryKey({ columns: [t.siteId, t.metric, t.date] })]);

export type Severity = "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  metric: text("metric").$type<Metric>().notNull(),
  date: date("date", { mode: "string" }).notNull(),
  value: real("value").notNull(),
  baseline: real("baseline").notNull(),
  dropPct: real("drop_pct").notNull(),
  thresholdPct: real("threshold_pct").notNull(),
  severity: text("severity").$type<Severity>().notNull(),
  status: text("status").$type<AlertStatus>().notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  emailedAt: timestamp("emailed_at", { withTimezone: true }),
  pushedAt: timestamp("pushed_at", { withTimezone: true }),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (t) => [
  unique("alerts_site_metric_date").on(t.siteId, t.metric, t.date),
  index("alerts_status_idx").on(t.status),
]);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  deviceLabel: text("device_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
});

export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").$type<"cron" | "manual">().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").$type<"running" | "success" | "partial" | "failed">().notNull().default("running"),
  sitesChecked: integer("sites_checked").notNull().default(0),
  alertsCreated: integer("alerts_created").notNull().default(0),
  emailsSent: integer("emails_sent").notNull().default(0),
  pushesSent: integer("pushes_sent").notNull().default(0),
  log: text("log").notNull().default(""),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export type Site = typeof sites.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Run = typeof runs.$inferSelect;
