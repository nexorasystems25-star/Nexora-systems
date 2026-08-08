CREATE TABLE `payroll_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payroll_run_id` integer NOT NULL,
	`staff_id` integer NOT NULL,
	`base_salary_pesewas` integer NOT NULL,
	`allowances_pesewas` integer DEFAULT 0 NOT NULL,
	`deductions_pesewas` integer DEFAULT 0 NOT NULL,
	`net_pay_pesewas` integer NOT NULL,
	`payment_status` text DEFAULT 'Pending' NOT NULL,
	FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `payroll_staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_code` text NOT NULL,
	`pay_period` text NOT NULL,
	`payment_date` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`gross_pesewas` integer DEFAULT 0 NOT NULL,
	`deductions_pesewas` integer DEFAULT 0 NOT NULL,
	`net_pesewas` integer DEFAULT 0 NOT NULL,
	`prepared_by_user_id` integer,
	`prepared_by_name` text NOT NULL,
	`approved_by_user_id` integer,
	`approved_by_name` text,
	`approved_at` text,
	`decision_reason` text,
	`finance_transaction_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`prepared_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`finance_transaction_id`) REFERENCES `finance_transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_runs_run_code_unique` ON `payroll_runs` (`run_code`);--> statement-breakpoint
CREATE TABLE `payroll_staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_code` text NOT NULL,
	`member_id` integer,
	`full_name` text NOT NULL,
	`job_title` text NOT NULL,
	`department` text NOT NULL,
	`employment_type` text DEFAULT 'Full-time' NOT NULL,
	`bank_name` text,
	`bank_account_last4` text,
	`mobile_money_number` text,
	`base_salary_pesewas` integer NOT NULL,
	`recurring_allowance_pesewas` integer DEFAULT 0 NOT NULL,
	`recurring_deduction_pesewas` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_by_user_id` integer,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_staff_staff_code_unique` ON `payroll_staff` (`staff_code`);--> statement-breakpoint
CREATE TABLE `welfare_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_code` text NOT NULL,
	`member_id` integer,
	`beneficiary_name` text NOT NULL,
	`beneficiary_phone` text,
	`support_type` text NOT NULL,
	`amount_requested_pesewas` integer NOT NULL,
	`amount_approved_pesewas` integer,
	`urgency` text DEFAULT 'Normal' NOT NULL,
	`assessment_summary` text NOT NULL,
	`assigned_committee` text DEFAULT 'Welfare Committee' NOT NULL,
	`decision_reason` text,
	`status` text DEFAULT 'Pending assessment' NOT NULL,
	`finance_transaction_id` integer,
	`requested_by_user_id` integer,
	`requested_by_name` text NOT NULL,
	`reviewed_by_user_id` integer,
	`reviewed_by_name` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`finance_transaction_id`) REFERENCES `finance_transactions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `welfare_requests_request_code_unique` ON `welfare_requests` (`request_code`);