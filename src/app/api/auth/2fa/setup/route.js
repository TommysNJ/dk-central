import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";
import {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
} from "@/lib/twoFactor";

import { encrypt, decrypt } from "@/lib/crypto";

export async function POST(req) {
  const userId = req.cookies.get("2fa_setup_user")?.value;

  if (!userId) {
    return NextResponse.json(
      { message: "Sesión de configuración expirada" },
      { status: 401 }
    );
  }

  let token = null;
  try {
    const body = await req.json();
    token = body?.token ?? null;
  } catch {}

  const user = await prisma.usuarios.findUnique({
    where: { id_usuario: Number(userId) },
  });

  if (!user) {
    return NextResponse.json(
      { message: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  // =============================
  // 🔐 SI AÚN NO ESTÁ ACTIVADO → MOSTRAR QR SIEMPRE
  // =============================
  if (!user.two_factor_enabled) {
    let secret = user.two_factor_secret
        ? decrypt(user.two_factor_secret)
        : null;

        if (!secret) {
        const generated = generateTwoFactorSecret(user.usuario);
        secret = generated.base32;

        await prisma.usuarios.update({
            where: { id_usuario: user.id_usuario },
            data: { two_factor_secret: encrypt(secret) },
        });
  } 

    // si NO hay token → devolver QR
    if (!token) {
      const otpauth = `otpauth://totp/DKMS:${user.usuario}?secret=${secret}&issuer=DKMS`;
      const qrImage = await QRCode.toDataURL(otpauth);

      return NextResponse.json({ qr: qrImage });
    }

    // si HAY token → validar
    const valid = verifyTwoFactorToken(secret, token);
    if (!valid) {
      return NextResponse.json(
        { message: "Código incorrecto" },
        { status: 400 }
      );
    }

    await prisma.usuarios.update({
      where: { id_usuario: user.id_usuario },
      data: { two_factor_enabled: true },
    });

    const res = NextResponse.json({ message: "2FA activado correctamente" });
    res.cookies.delete("2fa_setup_user");
    return res;
  }

  return NextResponse.json({ message: "2FA ya activado" });
}