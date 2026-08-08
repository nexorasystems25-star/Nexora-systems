CREATE TABLE `attendance_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`member_id` integer,
	`person_type` text DEFAULT 'Member' NOT NULL,
	`visitor_name` text,
	`attendance_status` text DEFAULT 'Present' NOT NULL,
	`check_in_method` text DEFAULT 'Manual' NOT NULL,
	`checked_in_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`notes` text,
	FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_session_member_unique` ON `attendance_records` (`session_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_code` text NOT NULL,
	`title` text NOT NULL,
	`service_type` text DEFAULT 'Sunday Service' NOT NULL,
	`service_date` text NOT NULL,
	`start_time` text NOT NULL,
	`campus` text DEFAULT 'Grace Centre' NOT NULL,
	`venue` text DEFAULT 'Main Auditorium' NOT NULL,
	`status` text DEFAULT 'Scheduled' NOT NULL,
	`expected_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_sessions_session_code_unique` ON `attendance_sessions` (`session_code`);