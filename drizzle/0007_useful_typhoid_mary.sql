CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `care_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`activity_type` text NOT NULL,
	`note` text NOT NULL,
	`outcome` text,
	`completed_by` text NOT NULL,
	`completed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `care_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `care_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_code` text NOT NULL,
	`member_id` integer,
	`person_name` text NOT NULL,
	`person_phone` text,
	`person_type` text DEFAULT 'Member' NOT NULL,
	`case_type` text NOT NULL,
	`source` text DEFAULT 'Church office' NOT NULL,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`stage` text DEFAULT 'New' NOT NULL,
	`assigned_to` text DEFAULT 'Pastoral Care Team' NOT NULL,
	`next_action_date` text,
	`summary` text NOT NULL,
	`sensitive_notes` text,
	`is_confidential` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_cases_case_code_unique` ON `care_cases` (`case_code`);