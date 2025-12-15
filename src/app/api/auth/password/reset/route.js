import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json(
      { message: "Datos incompletos" },
      { status: 400 }
    );
  }

  // 🔒 Validación contraseña segura
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[^\s]{8,}$/;

  if (!passwordRegex.test(password)) {
    return NextResponse.json(
      {
        message:
          "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.",
      },
      { status: 400 }
    );
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // 🕐 Hora Ecuador (UTC-5)
  const nowUtc = new Date();
  const nowEcuador = new Date(nowUtc.getTime() - 5 * 60 * 60 * 1000);

  const user = await prisma.usuarios.findFirst({
    where: {
      reset_password_token: hashedToken,
      reset_password_expires: {
        gt: nowEcuador,
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { message: "Token inválido o expirado" },
      { status: 400 }
    );
  }

  await prisma.usuarios.update({
    where: { id_usuario: user.id_usuario },
    data: {
      password: await bcrypt.hash(password, 10),
      reset_password_token: null,
      reset_password_expires: null,
    },
  });

  return NextResponse.json({ message: "Contraseña actualizada" });
}