import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signAuthToken } from "@/lib/jwt";

export async function POST(req) {
  try {
    const { usuario, password } = await req.json();
    if (!usuario || !password) {
      return NextResponse.json({ message: "Usuario y contraseña requeridos" }, { status: 400 });
    }

    const user = await prisma.usuarios.findUnique({ where: { usuario } });
    if (!user) return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });

    const token = signAuthToken({
      sub: user.id_usuario,
      nombre: user.nombre,
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
  } catch (e) {
    return NextResponse.json({ message: "Error interno en login" }, { status: 500 });
  }
}