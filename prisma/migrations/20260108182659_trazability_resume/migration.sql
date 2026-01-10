-- AlterTable
ALTER TABLE `resumenes_diarios` ADD COLUMN `fecha_actualizacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `id_usuario` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `resumenes_diarios` ADD CONSTRAINT `resumenes_diarios_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;
