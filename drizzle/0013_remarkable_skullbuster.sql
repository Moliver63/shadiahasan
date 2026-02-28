CREATE TABLE `admin_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` enum('PROMOTE_ADMIN','DEMOTE_ADMIN','PROMOTE_SUPERADMIN','DEMOTE_SUPERADMIN') NOT NULL,
	`performedByUserId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`ip` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','superadmin') NOT NULL DEFAULT 'user';