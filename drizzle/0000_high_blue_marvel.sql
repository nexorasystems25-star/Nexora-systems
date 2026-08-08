CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` text NOT NULL,
	`name` text NOT NULL,
	`initials` text NOT NULL,
	`group_name` text DEFAULT 'General' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_church_id_unique` ON `members` (`church_id`);