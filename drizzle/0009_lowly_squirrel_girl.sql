CREATE TABLE `admin_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`manageCourses` int NOT NULL DEFAULT 0,
	`manageStudents` int NOT NULL DEFAULT 0,
	`manageContent` int NOT NULL DEFAULT 0,
	`manageAdmins` int NOT NULL DEFAULT 0,
	`manageSettings` int NOT NULL DEFAULT 0,
	`viewAnalytics` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_permissions_userId_unique` UNIQUE(`userId`)
);
