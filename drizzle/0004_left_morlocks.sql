CREATE TABLE `sharedBillShares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billId` int NOT NULL,
	`memberId` int NOT NULL,
	`inputValue` int NOT NULL DEFAULT 0,
	`shareCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sharedBillShares_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_bill_member_unique` UNIQUE(`billId`,`memberId`)
);
--> statement-breakpoint
CREATE TABLE `sharedBills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`description` varchar(240) NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'Other',
	`totalCents` int NOT NULL,
	`allocationMethod` varchar(24) NOT NULL,
	`billDate` timestamp NOT NULL,
	`payerMemberId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sharedBills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sharedGroupMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`displayName` varchar(120) NOT NULL,
	`linkedUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sharedGroupMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sharedGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'LKR',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sharedGroups_id` PRIMARY KEY(`id`)
);
