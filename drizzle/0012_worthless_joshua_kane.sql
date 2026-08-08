CREATE TABLE `archive_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_code` text NOT NULL,
	`asset_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`speaker_author` text,
	`ministry` text DEFAULT 'Church-wide' NOT NULL,
	`event_date` text,
	`scripture_reference` text,
	`tags` text DEFAULT '' NOT NULL,
	`file_key` text,
	`file_name` text,
	`content_type` text,
	`file_size` integer,
	`external_url` text,
	`visibility` text DEFAULT 'Internal' NOT NULL,
	`status` text DEFAULT 'Published' NOT NULL,
	`uploaded_by_user_id` integer,
	`uploaded_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `archive_assets_asset_code_unique` ON `archive_assets` (`asset_code`);--> statement-breakpoint
CREATE TABLE `generated_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_code` text NOT NULL,
	`record_type` text NOT NULL,
	`template_type` text NOT NULL,
	`member_id` integer,
	`subject_name` text NOT NULL,
	`event_date` text,
	`fields_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`issued_at` text,
	`issued_by_user_id` integer,
	`issued_by_name` text,
	`created_by_user_id` integer,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`issued_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generated_records_record_code_unique` ON `generated_records` (`record_code`);