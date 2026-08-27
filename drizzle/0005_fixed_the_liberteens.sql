CREATE TABLE `sharedSettlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`fromMemberId` int NOT NULL,
	`toMemberId` int NOT NULL,
	`amountCents` int NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(64),
	`referenceNote` varchar(240),
	`evidenceUrl` varchar(500),
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sharedSettlements_id` PRIMARY KEY(`id`)
);
