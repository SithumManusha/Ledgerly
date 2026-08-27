CREATE TABLE `recurringExpenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amountCents` int NOT NULL,
	`description` varchar(240) NOT NULL,
	`category` varchar(64) NOT NULL,
	`frequency` varchar(32) NOT NULL DEFAULT 'monthly',
	`dayOfMonth` int NOT NULL DEFAULT 1,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurringExpenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userAlertSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`budgetWarningThresholdPercent` int NOT NULL DEFAULT 80,
	`emailAlertsEnabled` int NOT NULL DEFAULT 0,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userAlertSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `userAlertSettings_userId_unique` UNIQUE(`userId`)
);
