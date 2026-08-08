CREATE TABLE `communication_campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_code` text NOT NULL,
	`name` text NOT NULL,
	`channel` text NOT NULL,
	`audience` text NOT NULL,
	`subject` text,
	`message` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`scheduled_at` text,
	`sent_at` text,
	`recipient_count` integer DEFAULT 0 NOT NULL,
	`delivered_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` integer,
	`created_by_name` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `communication_campaigns_campaign_code_unique` ON `communication_campaigns` (`campaign_code`);