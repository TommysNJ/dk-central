-- CreateTable
CREATE TABLE `historial_incidentes` (
    `id_historial` INTEGER NOT NULL AUTO_INCREMENT,
    `id_mensaje_clasificado` INTEGER NOT NULL,
    `id_usuario` INTEGER NOT NULL,
    `estado` ENUM('revisado', 'en_proceso', 'completado') NOT NULL,
    `observaciones` TEXT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_cambio` DATE NULL,
    `hora_cambio` VARCHAR(191) NULL,

    PRIMARY KEY (`id_historial`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `historial_incidentes` ADD CONSTRAINT `historial_incidentes_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_incidentes` ADD CONSTRAINT `historial_incidentes_id_mensaje_clasificado_fkey` FOREIGN KEY (`id_mensaje_clasificado`) REFERENCES `mensajes_clasificados`(`id_mensaje_clasificado`) ON DELETE RESTRICT ON UPDATE CASCADE;
