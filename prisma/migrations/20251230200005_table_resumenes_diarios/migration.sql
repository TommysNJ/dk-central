-- CreateTable
CREATE TABLE `resumenes_diarios` (
    `id_resumen` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATE NOT NULL,
    `id_centro_comercial` INTEGER NOT NULL,
    `area` ENUM('recepcion', 'administracion', 'mantenimiento', 'seguridad', 'mercadeo', 'sso') NOT NULL,
    `resumen` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_resumenes_centro_area_fecha`(`id_centro_comercial`, `area`, `fecha`),
    UNIQUE INDEX `unique_resumen_por_dia_centro_area`(`fecha`, `id_centro_comercial`, `area`),
    PRIMARY KEY (`id_resumen`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `resumenes_diarios` ADD CONSTRAINT `resumenes_diarios_id_centro_comercial_fkey` FOREIGN KEY (`id_centro_comercial`) REFERENCES `centros_comerciales`(`id_centro_comercial`) ON DELETE RESTRICT ON UPDATE CASCADE;
