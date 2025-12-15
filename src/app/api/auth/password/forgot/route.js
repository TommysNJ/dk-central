import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/mailer";

export async function POST(req) {
  const { correo } = await req.json();

  if (!correo) {
    return NextResponse.json(
      { message: "Correo requerido" },
      { status: 400 }
    );
  }

  const user = await prisma.usuarios.findUnique({
    where: { correo },
  });

  // ❌ NO EXISTE EL CORREO
  if (!user) {
    return NextResponse.json({
      exists: false,
      message: "No existe ningún usuario asociado a ese correo.",
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // 🕐 Hora Ecuador (UTC-5)
  const nowUtc = new Date();
  const nowEcuador = new Date(nowUtc.getTime() - 5 * 60 * 60 * 1000);

  // ⏱ Expira en 15 minutos
  const expiresEcuador = new Date(
    nowEcuador.getTime() + 15 * 60 * 1000
  );

  await prisma.usuarios.update({
    where: { id_usuario: user.id_usuario },
    data: {
      reset_password_token: hashedToken,
      reset_password_expires: expiresEcuador,
    },
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${token}`;

  await sendPasswordResetEmail({
    to: correo,
    nombre: user.nombre,
    resetUrl,
  });

  // ✅ CORREO ENVIADO
  return NextResponse.json({
    exists: true,
    message: "Se envió el correo de recuperación, revisa tu bandeja de entrada.",
  });
}