-- AlterTable
ALTER TABLE `mensajes_limpios` ADD COLUMN `fecha_envio_date` DATETIME(3) NULL,
    ADD COLUMN `fecha_envio_time` VARCHAR(191) NULL;
