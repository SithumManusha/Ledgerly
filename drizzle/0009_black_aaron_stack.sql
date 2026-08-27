ALTER TABLE `expenses` ADD `currency` varchar(3) DEFAULT 'LKR' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `convertedAmountCents` int;--> statement-breakpoint
ALTER TABLE `expenses` ADD `conversionRateBps` int;--> statement-breakpoint
ALTER TABLE `sharedBills` ADD `currency` varchar(3) DEFAULT 'LKR' NOT NULL;--> statement-breakpoint
ALTER TABLE `sharedBills` ADD `reportingCurrency` varchar(3) DEFAULT 'LKR' NOT NULL;--> statement-breakpoint
ALTER TABLE `sharedBills` ADD `conversionRateBps` int DEFAULT 10000 NOT NULL;