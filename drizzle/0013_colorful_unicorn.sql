CREATE TABLE `celebration_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reminder_code` text NOT NULL,
	`member_id` integer NOT NULL,
	`celebration_type` text NOT NULL,
	`occurrence_date` text NOT NULL,
	`channel` text DEFAULT 'In-app' NOT NULL,
	`status` text DEFAULT 'Prepared' NOT NULL,
	`campaign_id` integer,
	`prepared_by_user_id` integer,
	`prepared_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `communication_campaigns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`prepared_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `celebration_reminders_reminder_code_unique` ON `celebration_reminders` (`reminder_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `celebration_member_occurrence_unique` ON `celebration_reminders` (`member_id`,`celebration_type`,`occurrence_date`);--> statement-breakpoint
ALTER TABLE `members` ADD `wedding_date` text;