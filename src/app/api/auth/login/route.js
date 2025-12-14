import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signAuthToken } from "@/lib/jwt";
import { verifyTwoFactorToken } from "@/lib/twoFactor";

import { decrypt } from "@/lib/crypto";

export async function POST(req) {
  try {
    const { usuario, password, twoFactorCode } = await req.json();

    if (!usuario || !password) {
      return NextResponse.json(
        { message: "Usuario y contraseña requeridos" },
        { status: 400 }
      );
    }

    const user = await prisma.usuarios.findUnique({ where: { usuario } });
    if (!user) {
      return NextResponse.json(
        { message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // =============================
    // 🔐 2FA OBLIGATORIO
    // =============================
    if (!user.two_factor_enabled) {
      const res = NextResponse.json({
        twoFactorSetupRequired: true,
      });

      // 🔥 cookie temporal SOLO para setup 2FA
      res.cookies.set("2fa_setup_user", String(user.id_usuario), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 5, // 5 minutos
      });

      return res;
    }

    if (!twoFactorCode) {
      return NextResponse.json({
        twoFactorRequired: true,
      });
    }

    const secret = decrypt(user.two_factor_secret);

    const twoFactorValid = verifyTwoFactorToken(
      secret,
      twoFactorCode
    );

    if (!twoFactorValid) {
      return NextResponse.json(
        { message: "Código de autenticación inválido" },
        { status: 401 }
      );
    }

    // =============================
    // JWT (NO SE TOCA)
    // =============================
    const token = signAuthToken({
      sub: user.id_usuario,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
      area: user.area,
      id_centro_comercial: user.id_centro_comercial,
    });

    const res = NextResponse.json({ message: "Autenticado", rol: user.rol });
    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return res;
  } catch {
    return NextResponse.json(
      { message: "Error interno en login" },
      { status: 500 }
    );
  }
}