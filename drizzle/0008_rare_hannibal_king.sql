CREATE TABLE `course_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'BRL',
	`stripePaymentIntentId` varchar(255),
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`purchasedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `courses` ADD `price` int;