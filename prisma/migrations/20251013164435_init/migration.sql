-- CreateTable
CREATE TABLE `centros_comerciales` (
    `id_centro_comercial` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `direccion` VARCHAR(191) NULL,

    UNIQUE INDEX `centros_comerciales_nombre_key`(`nombre`),
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
    `area` ENUM('mantenimiento', 'seguridad', 'limpieza', 'administracion') NULL,
    `id_centro_comercial` INTEGER NULL,

    UNIQUE INDEX `usuarios_correo_key`(`correo`),
    UNIQUE INDEX `usuarios_telefono_key`(`telefono`),
    UNIQUE INDEX `usuarios_usuario_key`(`usuario`),
    INDEX `idx_usuarios_rol_centro`(`rol`, `id_centro_comercial`),
    INDEX `idx_usuarios_usuario`(`usuario`),
    PRIMARY KEY (`id_usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_id_centro_comercial_fkey` FOREIGN KEY (`id_centro_comercial`) REFERENCES `centros_comerciales`(`id_centro_comercial`) ON DELETE SET NULL ON UPDATE CASCADE;
