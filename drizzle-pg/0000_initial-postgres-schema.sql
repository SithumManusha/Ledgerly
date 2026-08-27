CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"monthKey" varchar(7) NOT NULL,
	"category" varchar(64) NOT NULL,
	"limitCents" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"amountCents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'LKR' NOT NULL,
	"convertedAmountCents" integer,
	"conversionRateBps" integer,
	"transactionDate" timestamp NOT NULL,
	"description" varchar(240) NOT NULL,
	"category" varchar(64) NOT NULL,
	"aiSuggestedCategory" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passwordResetTokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurringExpenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"amountCents" integer NOT NULL,
	"description" varchar(240) NOT NULL,
	"category" varchar(64) NOT NULL,
	"frequency" varchar(32) DEFAULT 'monthly' NOT NULL,
	"dayOfMonth" integer DEFAULT 1 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_shared_bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'LKR' NOT NULL,
	"split_mode" varchar(50) DEFAULT 'equal' NOT NULL,
	"frequency" varchar(50) DEFAULT 'monthly' NOT NULL,
	"payer_user_id" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"next_due_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savingsGoals" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"targetCents" integer NOT NULL,
	"currentCents" integer DEFAULT 0 NOT NULL,
	"targetDate" varchar(10) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "savingsGoals_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "sharedBillShares" (
	"id" serial PRIMARY KEY NOT NULL,
	"billId" integer NOT NULL,
	"memberId" integer NOT NULL,
	"inputValue" integer DEFAULT 0 NOT NULL,
	"shareCents" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sharedBills" (
	"id" serial PRIMARY KEY NOT NULL,
	"groupId" integer NOT NULL,
	"createdByUserId" integer NOT NULL,
	"description" varchar(240) NOT NULL,
	"category" varchar(64) DEFAULT 'Other' NOT NULL,
	"totalCents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'LKR' NOT NULL,
	"reportingCurrency" varchar(3) DEFAULT 'LKR' NOT NULL,
	"conversionRateBps" integer DEFAULT 10000 NOT NULL,
	"allocationMethod" varchar(24) NOT NULL,
	"billDate" timestamp NOT NULL,
	"payerMemberId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_group_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"inviter_user_id" varchar(255) NOT NULL,
	"invitee_email" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"token" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_group_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sharedGroupMembers" (
	"id" serial PRIMARY KEY NOT NULL,
	"groupId" integer NOT NULL,
	"displayName" varchar(120) NOT NULL,
	"linkedUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sharedGroups" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerUserId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"currency" varchar(3) DEFAULT 'LKR' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sharedSettlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"groupId" integer NOT NULL,
	"fromMemberId" integer NOT NULL,
	"toMemberId" integer NOT NULL,
	"amountCents" integer NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"paymentMethod" varchar(64),
	"referenceNote" varchar(240),
	"evidenceUrl" varchar(500),
	"updatedByUserId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userAlertSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"budgetWarningThresholdPercent" integer DEFAULT 80 NOT NULL,
	"emailAlertsEnabled" integer DEFAULT 0 NOT NULL,
	"scheduleCronTaskUid" varchar(65),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userAlertSettings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"passwordHash" varchar(255),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_user_month_category" ON "budgets" USING btree ("userId","monthKey","category");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_token_hash" ON "passwordResetTokens" USING btree ("tokenHash");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_bill_member_unique" ON "sharedBillShares" USING btree ("billId","memberId");