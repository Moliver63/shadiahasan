CREATE TABLE `connection_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromUserId` int NOT NULL,
	`toUserId` int NOT NULL,
	`message` text,
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`respondedAt` timestamp,
	CONSTRAINT `connection_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId1` int NOT NULL,
	`userId2` int NOT NULL,
	`status` enum('active','blocked') NOT NULL DEFAULT 'active',
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`reason` text,
	`duration` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reporterId` int NOT NULL,
	`reportedUserId` int NOT NULL,
	`reason` varchar(100) NOT NULL,
	`description` text,
	`status` enum('pending','reviewed','resolved','dismissed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`reviewedBy` int,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bio` text,
	`city` varchar(100),
	`interests` text,
	`goals` text,
	`isPublic` int NOT NULL DEFAULT 0,
	`showCity` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_userId_unique` UNIQUE(`userId`)
);
