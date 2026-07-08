CREATE TABLE `beginbalans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`boekjaar_id` integer NOT NULL,
	`grootboek_id` integer NOT NULL,
	`bedrag_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`boekjaar_id`) REFERENCES `boekjaren`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grootboek_id`) REFERENCES `grootboekrekeningen`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_beginbalans_boekjaar_grootboek` ON `beginbalans` (`boekjaar_id`,`grootboek_id`);--> statement-breakpoint
CREATE TABLE `boekjaren` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jaar` integer NOT NULL,
	`btw_periode` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boekjaren_jaar_unique` ON `boekjaren` (`jaar`);--> statement-breakpoint
CREATE TABLE `grootboekrekeningen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`naam` text NOT NULL,
	`type` text NOT NULL,
	`is_systeem` integer DEFAULT false NOT NULL,
	`actief` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grootboekrekeningen_code_unique` ON `grootboekrekeningen` (`code`);--> statement-breakpoint
CREATE TABLE `relaties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nr` integer NOT NULL,
	`naam` text NOT NULL,
	`adres` text,
	`postcode` text,
	`plaats` text,
	`telefoon` text,
	`email` text,
	`actief` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relaties_nr_unique` ON `relaties` (`nr`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bedrijfsnaam` text,
	`contactpersoon` text,
	`adres` text,
	`postcode` text,
	`plaats` text,
	`telefoon` text,
	`email` text,
	`website` text,
	`ob_nummer` text,
	`kvk_nummer` text,
	`iban` text,
	`password_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transacties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`boekjaar_id` integer NOT NULL,
	`richting` text NOT NULL,
	`datum` text NOT NULL,
	`soort` text NOT NULL,
	`factuurnummer` text,
	`omschrijving` text,
	`relatie_id` integer,
	`bedrag_excl_cents` integer NOT NULL,
	`btw_tarief` text NOT NULL,
	`btw_cents` integer NOT NULL,
	`status` text NOT NULL,
	`grootboek_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`boekjaar_id`) REFERENCES `boekjaren`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`relatie_id`) REFERENCES `relaties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grootboek_id`) REFERENCES `grootboekrekeningen`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_transacties_boekjaar_richting_datum` ON `transacties` (`boekjaar_id`,`richting`,`datum`);--> statement-breakpoint
CREATE INDEX `idx_transacties_grootboek` ON `transacties` (`grootboek_id`);--> statement-breakpoint
CREATE INDEX `idx_transacties_relatie` ON `transacties` (`relatie_id`);