import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyAuthToken } from "@/lib/jwt";

export async function POST(req) {
  const token = req.cookies.get("auth_token")?.value;
  const session = token ? verifyAuthToken(token) : null;

  if (!session) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const { password } = await req.json();

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

  await prisma.usuarios.update({
    where: { id_usuario: session.sub },
    data: {
      password: await bcrypt.hash(password, 10),
      must_change_password: false,
    },
  });

  return NextResponse.json({ message: "Contraseña actualizada" });
}