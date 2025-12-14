import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authorize } from "@/lib/authorize";

import { sendUserCreatedEmail } from "@/lib/mailer";
import { emailDomainExists } from "@/lib/validateEmail";

// GET - lista de usuarios
export async function GET(req) {
  const session = await authorize(req, ["admin_sistema", "admin_centro"]);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const where = {
    OR: [
      { nombre: { contains: search } },
      { correo: { contains: search } },
      { usuario: { contains: search } },
    ],
  };

  if (session.rol === "admin_centro") {
    where.AND = [
      { id_centro_comercial: session.id_centro_comercial },
      { rol: "usuario_operativo" },
    ];
  }

  const usuarios = await prisma.usuarios.findMany({
    where,
    include: { centro_comercial: true },
    orderBy: { id_usuario: "desc" },
  });

  return NextResponse.json(usuarios);
}

// POST - crear usuario
export async function POST(req) {
  const session = await authorize(req, ["admin_sistema", "admin_centro"]);
  // 🔒 Validación formato correo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const telefonoRegex = /^09\d{8}$/;
  if (session instanceof NextResponse) return session;

  const data = await req.json();
  const {
    nombre,
    correo,
    telefono,
    usuario,
    password,
    rol,
    area,
    nombre_centro_comercial,
  } = data;

  if (!nombre || !correo || !telefono || !usuario || !password || !rol) {
    return NextResponse.json(
      { message: "Campos obligatorios faltantes" },
      { status: 400 }
    );
  }

  if (!emailRegex.test(correo)) {
    return NextResponse.json(
      { message: "Debe ingresar un correo electrónico válido." },
      { status: 400 }
    );
  }

  // 🔥 NUEVO — validar que el dominio del correo exista (MX)
  const dominioValido = await emailDomainExists(correo);
  if (!dominioValido) {
    return NextResponse.json(
      { message: "El correo ingresado no existe o no puede recibir mensajes." },
      { status: 400 }
    );
  }

  // 🔒 Validación teléfono Ecuador
  if (!telefonoRegex.test(telefono)) {
    return NextResponse.json(
      { message: "El número debe comenzar con 09 y tener 10 dígitos." },
      { status: 400 }
    );
  }

  // 🔒 Validación longitud contraseña
  if (!password || password.length < 8) {
    return NextResponse.json(
      { message: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 }
    );
  }

  const hashed = await bcrypt.hash(password, 10);
  let centroId = null;

  // Si es admin_centro - asigna automáticamente su centro
  if (session.rol === "admin_centro") {
    centroId = session.id_centro_comercial;
  }

  // Si es admin_sistema y hay nombre de centro → crear o usar existente
  if (session.rol === "admin_sistema" && nombre_centro_comercial) {
    const existingCentro = await prisma.centros_comerciales.findUnique({
      where: { nombre: nombre_centro_comercial },
    });

    if (existingCentro) {
      centroId = existingCentro.id_centro_comercial;
    } else {
      const nuevoCentro = await prisma.centros_comerciales.create({
        data: { nombre: nombre_centro_comercial },
      });
      centroId = nuevoCentro.id_centro_comercial;
    }
  }

  // 🧩 Validación centro comercial obligatorio
  if (
    (rol === "admin_centro" || rol === "usuario_operativo") &&
    !centroId
  ) {
    return NextResponse.json(
      { message: "Debe asignar un centro comercial válido." },
      { status: 400 }
    );
  }

  // 🧩 Validación área obligatoria
  if (
    (rol === "usuario_operativo" || session.rol === "admin_centro") &&
    (!area || area.trim() === "")
  ) {
    return NextResponse.json(
      { message: "Debe asignar un área válida." },
      { status: 400 }
    );
  }

  // Validación previa: correo, usuario o teléfono repetidos
  const existente = await prisma.usuarios.findFirst({
    where: {
      OR: [{ correo }, { usuario }, { telefono: telefono || "" }],
    },
  });

  if (existente) {
    let campoDuplicado = "";

    if (existente.correo === correo) campoDuplicado = "correo";
    else if (existente.telefono === telefono) campoDuplicado = "teléfono";
    else if (existente.usuario === usuario) campoDuplicado = "usuario";

    return NextResponse.json(
      { message: `El ${campoDuplicado} ya existe. Intenta con otro.` },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.usuarios.create({
      data: {
        nombre,
        correo,
        telefono: telefono || null,
        usuario,
        password: hashed,
        rol,
        area: area || null,
        id_centro_comercial: centroId,
      },
      include: { centro_comercial: true },
    });

    // 🔥 NUEVO — envío de correo SOLO al crear
    try {
      await sendUserCreatedEmail({
        to: correo,
        nombre,
        usuario,
        password,
        adminNombre: session.nombre,
        adminCorreo: session.correo,
      });
    } catch (mailError) {
      console.error("Error enviando correo de creación:", mailError);
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      const target = error.meta?.target?.[0] || "";
      let campo = "campo único";

      if (target.includes("correo")) campo = "correo";
      else if (target.includes("usuario")) campo = "usuario";
      else if (target.includes("telefono")) campo = "teléfono";

      return NextResponse.json(
        { message: `El ${campo} ya existe. Intenta con otro.` },
        { status: 400 }
      );
    }

    console.error("Error creando usuario:", error);
    return NextResponse.json(
      { message: "Error interno al crear usuario" },
      { status: 500 }
    );
  }
}