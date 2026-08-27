CREATE TABLE `recurring_shared_bills` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`group_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`amount_cents` int NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'LKR',
	`split_mode` varchar(50) NOT NULL DEFAULT 'equal',
	`frequency` varchar(50) NOT NULL DEFAULT 'monthly',
	`payer_user_id` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`next_due_date` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurring_shared_bills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shared_group_invitations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`group_id` int NOT NULL,
	`inviter_user_id` varchar(255) NOT NULL,
	`invitee_email` varchar(255) NOT NULL,
	`role` varchar(50) NOT NULL DEFAULT 'member',
	`token` varchar(255) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shared_group_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_group_invitations_token_unique` UNIQUE(`token`)
);
