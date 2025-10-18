// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminUsuario = "admin";
  const adminCorreo = "admin@dkmanagement.com";
  const adminPassword = "admin123"; // Contraseña por defecto
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Verifica si ya existe un administrador del sistema
  const existing = await prisma.usuarios.findUnique({
    where: { usuario: adminUsuario },
  });

  if (existing) {
    console.log("El Administrador del Sistema ya existe. No se duplicó.");
    return;
  }

  // Crea el usuario administrador del sistema
  await prisma.usuarios.create({
    data: {
      nombre: "Administrador del Sistema",
      correo: adminCorreo,
      telefono: "0999999999",
      usuario: adminUsuario,
      password: hashedPassword,
      rol: "admin_sistema",   // Enum en minúscula, coincide con el schema
      area: null,
    },
  });

  console.log("Administrador del Sistema creado con éxito.");
}

main()
  .catch((e) => {
    console.error("Error al ejecutar el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });