-- CreateTable
CREATE TABLE `mensajes_limpios` (
    `id_mensaje` INTEGER NOT NULL AUTO_INCREMENT,
    `id_centro_comercial` INTEGER NOT NULL,
    `contenido_original` VARCHAR(191) NOT NULL,
    `contenido_limpio` VARCHAR(191) NOT NULL,
    `remitente` VARCHAR(191) NULL,
    `fecha_envio` DATETIME(3) NOT NULL,
    `procesado` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id_mensaje`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mensajes_limpios` ADD CONSTRAINT `mensajes_limpios_id_centro_comercial_fkey` FOREIGN KEY (`id_centro_comercial`) REFERENCES `centros_comerciales`(`id_centro_comercial`) ON DELETE RESTRICT ON UPDATE CASCADE;
