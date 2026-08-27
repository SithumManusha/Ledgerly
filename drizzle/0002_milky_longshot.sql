CREATE TABLE `savingsGoals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`targetCents` int NOT NULL,
	`currentCents` int NOT NULL DEFAULT 0,
	`targetDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savingsGoals_id` PRIMARY KEY(`id`),
	CONSTRAINT `savingsGoals_userId_unique` UNIQUE(`userId`)
);
