-- CreateTable
CREATE TABLE `centros_comerciales` (
    `id_centro_comercial` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `ciudad` VARCHAR(191) NOT NULL,
    `ubicacion` VARCHAR(191) NULL,
    `id_grupo_telegram` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `centros_comerciales_nombre_key`(`nombre`),
    UNIQUE INDEX `centros_comerciales_id_grupo_telegram_key`(`id_grupo_telegram`),
    PRIMARY KEY (`id_centro_comercial`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id_usuario` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `usuario` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `rol` ENUM('admin_sistema', 'admin_centro', 'usuario_operativo') NOT NULL,
    `area` ENUM('recepcion', 'administracion', 'mantenimiento', 'seguridad', 'mercadeo', 'sso', 'otros') NULL,
    `id_centro_comercial` INTEGER NULL,
    `two_factor_enabled` BOOLEAN NOT NULL DEFAULT false,
    `two_factor_secret` VARCHAR(191) NULL,
    `reset_password_token` VARCHAR(191) NULL,
    `reset_password_expires` DATETIME(3) NULL,
    `must_change_password` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `usuarios_correo_key`(`correo`),
    UNIQUE INDEX `usuarios_telefono_key`(`telefono`),
    UNIQUE INDEX `usuarios_usuario_key`(`usuario`),
    INDEX `idx_usuarios_rol_centro`(`rol`, `id_centro_comercial`),
    INDEX `idx_usuarios_usuario`(`usuario`),
    PRIMARY KEY (`id_usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensajes_limpios` (
    `id_mensaje` INTEGER NOT NULL AUTO_INCREMENT,
    `id_mensaje_telegram` INTEGER NOT NULL,
    `id_centro_comercial` INTEGER NOT NULL,
    `contenido_original` TEXT NOT NULL,
    `contenido_limpio` TEXT NOT NULL,
    `remitente` VARCHAR(191) NULL,
    `fecha_envio` DATETIME(3) NOT NULL,
    `fecha_envio_date` DATE NULL,
    `fecha_envio_time` VARCHAR(191) NULL,
    `procesado` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `unique_msg_per_centro`(`id_centro_comercial`, `id_mensaje_telegram`),
    PRIMARY KEY (`id_mensaje`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incidentes` (
    `id_incidente` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `area` ENUM('recepcion', 'administracion', 'mantenimiento', 'seguridad', 'mercadeo', 'sso', 'otros') NOT NULL,

    UNIQUE INDEX `incidentes_nombre_key`(`nombre`),
    PRIMARY KEY (`id_incidente`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `keywords_incidentes` (
    `id_keyword` INTEGER NOT NULL AUTO_INCREMENT,
    `palabra` VARCHAR(191) NOT NULL,
    `id_incidente` INTEGER NOT NULL,

    UNIQUE INDEX `keywords_incidentes_palabra_key`(`palabra`),
    PRIMARY KEY (`id_keyword`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensajes_clasificados` (
    `id_mensaje_clasificado` INTEGER NOT NULL AUTO_INCREMENT,
    `id_mensaje_limpio` INTEGER NOT NULL,
    `id_incidente` INTEGER NOT NULL,
    `confianza` DOUBLE NOT NULL,
    `estado` ENUM('nuevo', 'en_proceso', 'completado') NOT NULL DEFAULT 'nuevo',
    `observaciones` TEXT NULL,

    UNIQUE INDEX `mensajes_clasificados_id_mensaje_limpio_key`(`id_mensaje_limpio`),
    PRIMARY KEY (`id_mensaje_clasificado`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historial_incidentes` (
    `id_historial` INTEGER NOT NULL AUTO_INCREMENT,
    `id_mensaje_clasificado` INTEGER NOT NULL,
    `id_usuario` INTEGER NOT NULL,
    `estado` ENUM('nuevo', 'en_proceso', 'completado') NOT NULL,
    `observaciones` TEXT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_cambio` DATE NULL,
    `hora_cambio` VARCHAR(191) NULL,

    PRIMARY KEY (`id_historial`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resumenes_diarios` (
    `id_resumen` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATE NOT NULL,
    `id_centro_comercial` INTEGER NOT NULL,
    `area` ENUM('recepcion', 'administracion', 'mantenimiento', 'seguridad', 'mercadeo', 'sso', 'otros') NOT NULL,
    `resumen` TEXT NOT NULL,
    `id_usuario` INTEGER NULL,
    `fecha_actualizacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_resumenes_centro_area_fecha`(`id_centro_comercial`, `area`, `fecha`),
    UNIQUE INDEX `unique_resumen_por_dia_centro_area`(`fecha`, `id_centro_comercial`, `area`),
    PRIMARY KEY (`id_resumen`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_id_centro_comercial_fkey` FOREIGN KEY (`id_centro_comercial`) REFERENCES `centros_comerciales`(`id_centro_comercial`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensajes_limpios` ADD CONSTRAINT `mensajes_limpios_id_centro_comercial_fkey` FOREIGN KEY (`id_centro_comercial`) REFERENCES `centros_comerciales`(`id_centro_comercial`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `keywords_incidentes` ADD CONSTRAINT `keywords_incidentes_id_incidente_fkey` FOREIGN KEY (`id_incidente`) REFERENCES `incidentes`(`id_incidente`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensajes_clasificados` ADD CONSTRAINT `mensajes_clasificados_id_mensaje_limpio_fkey` FOREIGN KEY (`id_mensaje_limpio`) REFERENCES `mensajes_limpios`(`id_mensaje`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensajes_clasificados` ADD CONSTRAINT `mensajes_clasificados_id_incidente_fkey` FOREIGN KEY (`id_incidente`) REFERENCES `incidentes`(`id_incidente`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_incidentes` ADD CONSTRAINT `historial_incidentes_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_incidentes` ADD CONSTRAINT `historial_incidentes_id_mensaje_clasificado_fkey` FOREIGN KEY (`id_mensaje_clasificado`) REFERENCES `mensajes_clasificados`(`id_mensaje_clasificado`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resumenes_diarios` ADD CONSTRAINT `resumenes_diarios_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resumenes_diarios` ADD CONSTRAINT `resumenes_diarios_id_centro_comercial_fkey` FOREIGN KEY (`id_centro_comercial`) REFERENCES `centros_comerciales`(`id_centro_comercial`) ON DELETE RESTRICT ON UPDATE CASCADE;
