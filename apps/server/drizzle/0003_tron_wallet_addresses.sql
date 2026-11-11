ALTER TABLE "wallets" DROP CONSTRAINT "wallets_address_hex";
--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_address_tron" CHECK ("wallets"."address" ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$');
