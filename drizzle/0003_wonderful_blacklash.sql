CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`certificateNumber` varchar(100) NOT NULL,
	`pdfUrl` text,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificates_certificateNumber_unique` UNIQUE(`certificateNumber`)
);
--> statement-breakpoint
CREATE TABLE `course_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ebooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`thumbnail` text,
	`courseId` int,
	`isPublished` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ebooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`badgeType` varchar(100) NOT NULL,
	`badgeName` varchar(255) NOT NULL,
	`badgeDescription` text,
	`badgeIcon` text,
	`earnedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_badges_id` PRIMARY KEY(`id`)
);
