CREATE TABLE "wallets" (
	"address" text PRIMARY KEY NOT NULL,
	"score" numeric(6, 4),
	"band" text,
	"confidence" text,
	"label_tier" text,
	"decision_status" text,
	"last_analysed" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "wallets_score_idx" ON "wallets" USING btree ("score");