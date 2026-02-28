CREATE TABLE `activityLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`entity` varchar(100),
	`entityId` int,
	`details` text,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`programType` varchar(100),
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`duration` int NOT NULL,
	`status` enum('scheduled','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
	`location` varchar(255),
	`notes` text,
	`reminderSent` int NOT NULL DEFAULT 0,
	`cancelledBy` int,
	`cancelReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`type` enum('info','success','warning','error','appointment') NOT NULL DEFAULT 'info',
	`read` int NOT NULL DEFAULT 0,
	`actionUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailNotifications` int NOT NULL DEFAULT 1,
	`smsNotifications` int NOT NULL DEFAULT 0,
	`pushNotifications` int NOT NULL DEFAULT 1,
	`reminderEmail` int NOT NULL DEFAULT 1,
	`reminderSms` int NOT NULL DEFAULT 0,
	`marketingEmails` int NOT NULL DEFAULT 0,
	`profilePublic` int NOT NULL DEFAULT 0,
	`shareProgress` int NOT NULL DEFAULT 0,
	`allowAnalytics` int NOT NULL DEFAULT 1,
	`darkMode` int NOT NULL DEFAULT 0,
	`fontSize` varchar(20) NOT NULL DEFAULT 'medium',
	`highContrast` int NOT NULL DEFAULT 0,
	`reduceMotion` int NOT NULL DEFAULT 0,
	`language` varchar(10) NOT NULL DEFAULT 'pt-BR',
	`timezone` varchar(50) NOT NULL DEFAULT 'America/Sao_Paulo',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `userSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `phoneNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `birthDate` date;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `gender` enum('male','female','other','prefer_not_to_say');--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `address` varchar(255);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `state` varchar(2);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `zipCode` varchar(10);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `country` varchar(100) DEFAULT 'Brazil' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `emergencyContactName` varchar(255);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `emergencyContactPhone` varchar(20);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `medicalNotes` text;