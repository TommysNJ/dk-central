import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/authorize";

// 🔹 PUT: editar centro comercial
export async function PUT(req, { params }) {
  const session = await authorize(req, ["admin_sistema"]);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const data = await req.json();
  const { nombre, ciudad, ubicacion, id_grupo_telegram } = data;

  if (!nombre || !ciudad || !id_grupo_telegram) {
    return NextResponse.json(
      { message: "Campos obligatorios faltantes." },
      { status: 400 }
    );
  }

  // Validación del formato del ID del grupo
  const regexGrupo = /^-\d{5,15}$/;
  if (!regexGrupo.test(id_grupo_telegram)) {
    return NextResponse.json(
      { message: "El ID del grupo debe comenzar con '-' y contener entre 5 a 15 dígitos." },
      { status: 400 }
    );
  }


  try {
    const duplicado = await prisma.centros_comerciales.findFirst({
      where: {
        OR: [{ nombre }, { id_grupo_telegram }],
        NOT: { id_centro_comercial: Number(id) },
      },
    });

    if (duplicado) {
      let campo = duplicado.nombre === nombre ? "nombre" : "id del grupo";
      return NextResponse.json(
        { message: `El ${campo} del centro comercial ya existe.` },
        { status: 400 }
      );
    }

    const actualizado = await prisma.centros_comerciales.update({
      where: { id_centro_comercial: Number(id) },
      data: { nombre, ciudad, ubicacion: ubicacion || "", id_grupo_telegram },
    });

    return NextResponse.json(actualizado, { status: 200 });
  } catch (error) {
    console.error("Error actualizando centro comercial:", error);
    return NextResponse.json(
      { message: "Error interno al actualizar centro comercial" },
      { status: 500 }
    );
  }
}

// 🔹 DELETE: eliminar centro comercial
export async function DELETE(req, { params }) {
  const session = await authorize(req, ["admin_sistema"]);
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    const centro = await prisma.centros_comerciales.findUnique({
      where: { id_centro_comercial: Number(id) },
    });

    if (!centro) {
      return NextResponse.json(
        { message: "Centro comercial no encontrado." },
        { status: 404 }
      );
    }

    await prisma.centros_comerciales.delete({
      where: { id_centro_comercial: Number(id) },
    });

    return NextResponse.json(
      { message: "Centro comercial eliminado correctamente." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error eliminando centro comercial:", error);
    return NextResponse.json(
      { message: "Error interno al eliminar centro comercial" },
      { status: 500 }
    );
  }
}