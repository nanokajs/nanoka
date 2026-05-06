CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`createdAt` integer NOT NULL
);
