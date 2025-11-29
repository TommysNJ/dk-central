-- AlterTable
ALTER TABLE `mensajes_clasificados` ADD COLUMN `estado` ENUM('revisado', 'en_proceso', 'completado') NOT NULL DEFAULT 'revisado',
    ADD COLUMN `observaciones` TEXT NULL;
