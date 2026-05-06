-- AlterTable: add number to Team with default, then set unique values, then add unique constraint
ALTER TABLE `Team` ADD COLUMN `number` INTEGER NOT NULL DEFAULT 0;

-- Set unique values for existing rows
SET @counter = 0;
UPDATE `Team` SET `number` = (@counter := @counter + 1) ORDER BY `name`;

-- Add unique constraint
CREATE UNIQUE INDEX `Team_number_key` ON `Team`(`number`);

-- AlterTable: add allAccessGranted to Registration
ALTER TABLE `Registration` ADD COLUMN `allAccessGranted` BOOLEAN NOT NULL DEFAULT false;
