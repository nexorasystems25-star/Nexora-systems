CREATE TABLE `finance_funds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`purpose` text DEFAULT 'Church operations' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_funds_name_unique` ON `finance_funds` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `finance_funds_code_unique` ON `finance_funds` (`code`);--> statement-breakpoint
CREATE TABLE `finance_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`fund_id` integer NOT NULL,
	`amount_pesewas` integer NOT NULL,
	`transaction_date` text NOT NULL,
	`payment_method` text DEFAULT 'Cash' NOT NULL,
	`description` text NOT NULL,
	`payer_payee` text,
	`receipt_number` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`recorded_by` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`fund_id`) REFERENCES `finance_funds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_transactions_reference_unique` ON `finance_transactions` (`reference`);