-- CreateTable
CREATE TABLE `ScanLog` (
    `id` VARCHAR(191) NOT NULL,
    `registrationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `scannedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ScanLog` ADD CONSTRAINT `ScanLog_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `Registration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScanLog` ADD CONSTRAINT `ScanLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
