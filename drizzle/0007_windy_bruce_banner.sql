CREATE TABLE `course_modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`order` int NOT NULL,
	`isPublished` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_modules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lessons` ADD `moduleId` int;