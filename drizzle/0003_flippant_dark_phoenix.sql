CREATE TABLE `household_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`relationship` text DEFAULT 'Member' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_code` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`primary_phone` text DEFAULT '' NOT NULL,
	`campus` text DEFAULT 'Grace Centre' NOT NULL,
	`pastoral_zone` text DEFAULT 'Unassigned' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `households_household_code_unique` ON `households` (`household_code`);--> statement-breakpoint
CREATE TABLE `organisation_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'Ministry' NOT NULL,
	`leader_name` text DEFAULT 'Unassigned' NOT NULL,
	`member_count` integer DEFAULT 0 NOT NULL,
	`meeting_schedule` text DEFAULT 'To be scheduled' NOT NULL,
	`campus` text DEFAULT 'Grace Centre' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organisation_units_name_unique` ON `organisation_units` (`name`);