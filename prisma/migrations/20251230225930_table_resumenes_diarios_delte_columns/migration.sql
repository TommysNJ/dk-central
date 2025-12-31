/*
  Warnings:

  - You are about to drop the column `created_at` on the `resumenes_diarios` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `resumenes_diarios` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `resumenes_diarios` DROP COLUMN `created_at`,
    DROP COLUMN `updated_at`;
