CREATE TABLE `church_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_code` text NOT NULL,
	`title` text NOT NULL,
	`event_type` text DEFAULT 'Service' NOT NULL,
	`start_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`campus` text DEFAULT 'Grace Centre' NOT NULL,
	`venue` text DEFAULT 'Main Auditorium' NOT NULL,
	`coordinator` text DEFAULT 'Unassigned' NOT NULL,
	`expected_attendance` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Planning' NOT NULL,
	`attendance_session_id` integer,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `church_events_event_code_unique` ON `church_events` (`event_code`);--> statement-breakpoint
CREATE TABLE `event_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`team_name` text NOT NULL,
	`leader_name` text DEFAULT 'Unassigned' NOT NULL,
	`required_count` integer DEFAULT 1 NOT NULL,
	`confirmed_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `church_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `event_programme_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`sequence` integer NOT NULL,
	`title` text NOT NULL,
	`owner` text DEFAULT 'Unassigned' NOT NULL,
	`duration_minutes` integer DEFAULT 10 NOT NULL,
	`status` text DEFAULT 'Ready' NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `church_events`(`id`) ON UPDATE no action ON DELETE cascade
);
