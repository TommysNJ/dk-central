/*
  Warnings:

  - A unique constraint covering the columns `[id_centro_comercial,id_mensaje_telegram]` on the table `mensajes_limpios` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_mensaje_telegram` to the `mensajes_limpios` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `mensajes_limpios` ADD COLUMN `id_mensaje_telegram` INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `unique_msg_per_centro` ON `mensajes_limpios`(`id_centro_comercial`, `id_mensaje_telegram`);
