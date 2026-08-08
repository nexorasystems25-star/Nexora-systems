CREATE TABLE `mobile_devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`device_name` text DEFAULT 'ChurchFlow Mobile' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`last_used_at` text,
	`expires_at` text NOT NULL,
	`created_by_user_id` integer,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mobile_devices_token_hash_unique` ON `mobile_devices` (`token_hash`);