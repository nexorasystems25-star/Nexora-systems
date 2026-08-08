ALTER TABLE `audit_logs` ADD `request_id` text;--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD `recorded_by_user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD `recorded_by_email` text;--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD `approved_by_user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD `approved_by_email` text;--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD `decision_reason` text;--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD `reversal_of_id` integer;--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD `reversal_reason` text;--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD `immutable_at` text;