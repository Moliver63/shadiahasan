CREATE TABLE `adminInvites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('admin','superadmin') NOT NULL DEFAULT 'admin',
	`token` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`invitedBy` int NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminInvites_id` PRIMARY KEY(`id`),
	CONSTRAINT `adminInvites_token_unique` UNIQUE(`token`)
);
