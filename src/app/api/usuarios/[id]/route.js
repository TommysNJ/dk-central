import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authorize } from "@/lib/authorize";

// 🔹 PUT: Actualizar usuario
export async function PUT(req, { params }) {
  const session = await authorize(req, ["admin_sistema", "admin_centro"]);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
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

  // Validaciones básicas
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const telefonoRegex = /^09\d{8}$/;

  // 🔒 Validación contraseña segura
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[^\s]{8,}$/;

  // ✅ REGLA HU: admin_centro NO puede cambiar rol a admin_* (ni poner admin a nadie)
  if (session.rol === "admin_centro" && rol !== "usuario_operativo") {
    return NextResponse.json(
      { message: "No autorizado para asignar este rol." },
      { status: 400 }
    );
  }

  if (!nombre || !correo || !telefono || !usuario || !rol) {
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

  if (!telefonoRegex.test(telefono)) {
    return NextResponse.json(
      { message: "El número debe comenzar con 09 y tener 10 dígitos." },
      { status: 400 }
    );
  }

  // 🔒 Validar contraseña segura si se envía una nueva
  if (password && !passwordRegex.test(password)) {
    return NextResponse.json(
      {
        message:
          "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.",
      },
      { status: 400 }
    );
  }

  // Validar permisos: admin_centro solo puede editar sus propios usuarios
  const userToEdit = await prisma.usuarios.findUnique({
    where: { id_usuario: Number(id) },
    include: { centro_comercial: true },
  });

  if (!userToEdit) {
    return NextResponse.json(
      { message: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  if (
    session.rol === "admin_centro" &&
    userToEdit.id_centro_comercial !== session.id_centro_comercial
  ) {
    return NextResponse.json(
      { message: "No autorizado para editar este usuario" },
      { status: 403 }
    );
  }

  // Verificar duplicados (correo, usuario, teléfono)
  const existente = await prisma.usuarios.findFirst({
    where: {
      OR: [{ correo }, { usuario }, { telefono }],
      NOT: { id_usuario: Number(id) },
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

  // 🧩 Manejo del centro comercial
  let centroId = userToEdit.id_centro_comercial;

  if (session.rol === "admin_centro") {
    centroId = session.id_centro_comercial;
  } else if (session.rol === "admin_sistema") {
    if (nombre_centro_comercial && nombre_centro_comercial.trim() !== "") {
      const centro = await prisma.centros_comerciales.findUnique({
        where: { nombre: nombre_centro_comercial },
      });
      if (centro) {
        centroId = centro.id_centro_comercial;
      } else {
        const nuevo = await prisma.centros_comerciales.create({
          data: { nombre: nombre_centro_comercial },
        });
        centroId = nuevo.id_centro_comercial;
      }
    } else {
      // Si el campo viene vacío → eliminar la asignación
      centroId = null;
    }
  }

  // 🧩 Nueva validación: Centro comercial obligatorio
  if (
    (rol === "admin_centro" || rol === "usuario_operativo") &&
    !centroId
  ) {
    return NextResponse.json(
      { message: "Debe asignar un centro comercial válido." },
      { status: 400 }
    );
  }

  // Validar área (para usuario operativo)
  if (
    (rol === "usuario_operativo" || session.rol === "admin_centro") &&
    (!area || area.trim() === "")
  ) {
    return NextResponse.json(
      { message: "Debe asignar un área válida." },
      { status: 400 }
    );
  }

  // Actualizar datos
  try {
    const updated = await prisma.usuarios.update({
      where: { id_usuario: Number(id) },
      data: {
        nombre,
        correo,
        telefono,
        usuario,
        rol,
        area: area && area.trim() !== "" ? area : null,
        id_centro_comercial: centroId,
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      },
      include: { centro_comercial: true },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error actualizando usuario:", error);
    return NextResponse.json(
      { message: "Error interno al actualizar" },
      { status: 500 }
    );
  }
}

// 🔹 DELETE: Eliminar usuario
export async function DELETE(req, { params }) {
  const session = await authorize(req, ["admin_sistema", "admin_centro"]);
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    const userToDelete = await prisma.usuarios.findUnique({
      where: { id_usuario: Number(id) },
    });

    if (!userToDelete) {
      return NextResponse.json(
        { message: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Restricción: admin_centro solo puede eliminar sus usuarios
    if (
      session.rol === "admin_centro" &&
      userToDelete.id_centro_comercial !== session.id_centro_comercial
    ) {
      return NextResponse.json(
        { message: "No autorizado para eliminar este usuario" },
        { status: 403 }
      );
    }

    await prisma.usuarios.delete({
      where: { id_usuario: Number(id) },
    });

    return NextResponse.json({ message: "Usuario eliminado" }, { status: 200 });
  } catch (error) {
    console.error("Error eliminando usuario:", error);
    return NextResponse.json(
      { message: "Error interno al eliminar usuario" },
      { status: 500 }
    );
  }
}