-- AlterTable: Add business profile fields for AI keyword targeting
ALTER TABLE `Client` ADD COLUMN `businessDescription` TEXT NULL;
ALTER TABLE `Client` ADD COLUMN `primaryServices` TEXT NULL;
ALTER TABLE `Client` ADD COLUMN `idealClientProfile` TEXT NULL;
ALTER TABLE `Client` ADD COLUMN `priceRange` VARCHAR(191) NULL;
ALTER TABLE `Client` ADD COLUMN `industryVertical` VARCHAR(191) NULL;
