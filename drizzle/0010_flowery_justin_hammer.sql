CREATE TABLE `leadership_appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`appointment_code` text NOT NULL,
	`member_id` integer,
	`leader_name` text NOT NULL,
	`title` text NOT NULL,
	`leadership_level` text NOT NULL,
	`ministry` text NOT NULL,
	`campus` text DEFAULT 'Grace Centre' NOT NULL,
	`start_date` text NOT NULL,
	`term_end_date` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_by_user_id` integer,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leadership_appointments_appointment_code_unique` ON `leadership_appointments` (`appointment_code`);--> statement-breakpoint
CREATE TABLE `volunteer_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`volunteer_id` integer NOT NULL,
	`event_id` integer,
	`assignment_date` text NOT NULL,
	`service_name` text NOT NULL,
	`team_name` text NOT NULL,
	`role` text NOT NULL,
	`call_time` text NOT NULL,
	`status` text DEFAULT 'Assigned' NOT NULL,
	`created_by_user_id` integer,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`volunteer_id`) REFERENCES `volunteers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `volunteers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`volunteer_code` text NOT NULL,
	`member_id` integer,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`skills` text DEFAULT '' NOT NULL,
	`availability` text DEFAULT 'Sundays' NOT NULL,
	`ministry_preference` text DEFAULT 'General Service' NOT NULL,
	`safeguarding_status` text DEFAULT 'Not required' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` integer,
	`created_by_name` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `volunteers_volunteer_code_unique` ON `volunteers` (`volunteer_code`);