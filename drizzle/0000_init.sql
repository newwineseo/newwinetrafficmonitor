CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"metric" text NOT NULL,
	"date" date NOT NULL,
	"value" real NOT NULL,
	"baseline" real NOT NULL,
	"drop_pct" real NOT NULL,
	"threshold_pct" real NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"emailed_at" timestamp with time zone,
	"pushed_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "alerts_site_metric_date" UNIQUE("site_id","metric","date")
);
--> statement-breakpoint
CREATE TABLE "daily_metrics" (
	"site_id" integer NOT NULL,
	"metric" text NOT NULL,
	"date" date NOT NULL,
	"value" real NOT NULL,
	CONSTRAINT "daily_metrics_site_id_metric_date_pk" PRIMARY KEY("site_id","metric","date")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"device_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"sites_checked" integer DEFAULT 0 NOT NULL,
	"alerts_created" integer DEFAULT 0 NOT NULL,
	"emails_sent" integer DEFAULT 0 NOT NULL,
	"pushes_sent" integer DEFAULT 0 NOT NULL,
	"log" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"gsc_property" text,
	"ga4_property_id" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"threshold_pct" real,
	"min_baseline" real,
	"metrics" text[] DEFAULT '{"gsc_clicks","gsc_impressions","ga4_sessions","ga4_organic"}' NOT NULL,
	"extra_recipients" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_fetch_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status");