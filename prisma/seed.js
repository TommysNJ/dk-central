import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // ==================================================
  // 1. ADMIN
  // ==================================================
  const adminUsuario = "Admin";
  const adminCorreo = "admin@dkmanagement.com";
  const adminPassword = "Admin12.";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const existingAdmin = await prisma.usuarios.findUnique({
    where: { usuario: adminUsuario },
  });

  if (!existingAdmin) {
    await prisma.usuarios.create({
      data: {
        nombre: "Administrador del Sistema",
        correo: adminCorreo,
        telefono: "0999999999",
        usuario: adminUsuario,
        password: hashedPassword,
        rol: "admin_sistema",
        area: null,
      },
    });
    console.log("🟢 Admin creado.");
  } else {
    console.log("ℹ️ Admin ya existía.");
  }

  // ==================================================
  // 2. INCIDENTES SIN TILDES (FORMATO LIMPIO)
  // ==================================================
  console.log("📌 Insertando incidentes...");

  const incidentesData = [
    { nombre: "robo", area: "seguridad" },
    { nombre: "pelea", area: "seguridad" },
    { nombre: "persona sospechosa", area: "seguridad" },
    { nombre: "objeto perdido", area: "seguridad" },

    { nombre: "caida", area: "sso" },
    { nombre: "inconsciencia", area: "sso" },
    { nombre: "accidente en escalera", area: "sso" },
    { nombre: "emergencia medica", area: "sso" },

    { nombre: "fuga de agua", area: "mantenimiento" },
    { nombre: "iluminacion danada", area: "mantenimiento" },
    { nombre: "cableado suelto", area: "mantenimiento" },
    { nombre: "ascensor en falla", area: "mantenimiento" },

    { nombre: "queja de cliente", area: "recepcion" },
    { nombre: "perdida de documentos", area: "administracion" },

    { nombre: "publicidad", area: "mercadeo" },
    { nombre: "montaje de evento", area: "mercadeo" },
    { nombre: "retiro material publicitario", area: "mercadeo" },

    { nombre: "ruido excesivo", area: "administracion" },
    { nombre: "vehiculo mal estacionado", area: "seguridad" },
    { nombre: "otros", area: "otros" },
  ];

  const incidentesCreados = {};

  for (const inc of incidentesData) {
    let existente = await prisma.incidentes.findUnique({
      where: { nombre: inc.nombre },
    });

    if (!existente) {
      existente = await prisma.incidentes.create({ data: inc });
      console.log(`🟢 Incidente creado: ${inc.nombre}`);
    } else {
      console.log(`ℹ️ Incidente ya existía: ${inc.nombre}`);
    }

    incidentesCreados[inc.nombre] = existente;
  }

  // ==================================================
  // 3. KEYWORDS ASOCIADAS A INCIDENTES
  // ==================================================
  console.log("🔑 Insertando keywords...");

  const keywordsData = [
    // =======================
    // ROBO
    // =======================
    ...[
      "robo","asalto","ladron","carterazo","hurtaron","me robaron",
      "se llevaron","robaron","hurto","robado","forzaron","amenaza",
      "pistola","arma","violencia"
    ].map(p => ({ palabra: p, incidente: "robo" })),

    // =======================
    // PELEA
    // =======================
    ...[
      "pelea","rina","golpes","agresion","discutiendo",
      "forcejeo","conflicto","violencia fisica","amenazas","gritando"
    ].map(p => ({ palabra: p, incidente: "pelea" })),

    // =======================
    // PERSONA SOSPECHOSA
    // =======================
    ...[
      "sospechoso","merodeando","raro","actitud sospechosa",
      "vigilado","observando mucho","comportamiento extrano"
    ].map(p => ({ palabra: p, incidente: "persona sospechosa" })),

    // =======================
    // OBJETO PERDIDO
    // =======================
    ...[
      "perdi","objeto perdido","no encuentro","extraviado",
      "se me cayo","recuperar","perdido"
    ].map(p => ({ palabra: p, incidente: "objeto perdido" })),

    // =======================
    // CAIDA
    // =======================
    ...[
      "caida","me cai","resbale","resbalon","tropece",
      "accidente","golpe","lastimado"
    ].map(p => ({ palabra: p, incidente: "caida" })),

    // =======================
    // INCONSCIENCIA
    // =======================
    ...[
      "desmayado","inconsciente","no responde","se desmayo",
      "ambulancia","emergencia","auxilio"
    ].map(p => ({ palabra: p, incidente: "inconsciencia" })),

    // =======================
    // ACCIDENTE ESCALERA
    // =======================
    ...[
      "escalera","se cayo escalera","accidente escalera","tropiezo escalera"
    ].map(p => ({ palabra: p, incidente: "accidente en escalera" })),

    // =======================
    // EMERGENCIA MEDICA
    // =======================
    ...[
      "herido","sangre","urgencia","atencion medica",
      "ayuda medica","dolor fuerte","fractura"
    ].map(p => ({ palabra: p, incidente: "emergencia medica" })),

    // =======================
    // FUGA DE AGUA
    // =======================
    ...[
      "agua","fuga","goteo","inundacion",
      "charco","mojado","tuberia rota"
    ].map(p => ({ palabra: p, incidente: "fuga de agua" })),

    // =======================
    // ILUMINACION DANADA
    // =======================
    ...[
      "luz","foco","apagado","oscuridad","iluminacion",
      "parpadeando","sin luz"
    ].map(p => ({ palabra: p, incidente: "iluminacion danada" })),

    // =======================
    // CABLEADO SUELTO
    // =======================
    ...[
      "cable","cables sueltos","electricidad","expuesto","corto circuito"
    ].map(p => ({ palabra: p, incidente: "cableado suelto" })),

    // =======================
    // ASCENSOR FALLA
    // =======================
    ...[
      "ascensor","elevador","traba","no funciona ascensor","atorado"
    ].map(p => ({ palabra: p, incidente: "ascensor en falla" })),

    // =======================
    // QUEJA CLIENTE
    // =======================
    ...[
      "queja","reclamo","mal servicio","molestia","quejar",
      "insatisfecho","atencion pesima"
    ].map(p => ({ palabra: p, incidente: "queja de cliente" })),

    // =======================
    // PERDIDA DOCUMENTOS
    // =======================
    ...[
      "documento","papeles","carpeta","archivo","perdi documento"
    ].map(p => ({ palabra: p, incidente: "perdida de documentos" })),

    // =======================
    // PUBLICIDAD
    // =======================
    ...[
      "publicidad","promo","promocion","anuncio","flyer"
    ].map(p => ({ palabra: p, incidente: "publicidad" })),

    // =======================
    // EVENTOS
    // =======================
    ...[
      "evento","montaje","escenario","stand","decoracion"
    ].map(p => ({ palabra: p, incidente: "montaje de evento" })),

    // =======================
    // RETIRO PUBLICITARIO
    // =======================
    ...[
      "retirar","quitar publicidad","remover","desmontar"
    ].map(p => ({ palabra: p, incidente: "retiro material publicitario" })),

    // =======================
    // RUIDO EXCESIVO
    // =======================
    ...[
      "ruido","bulla","alto volumen","molestia ruido"
    ].map(p => ({ palabra: p, incidente: "ruido excesivo" })),

    // =======================
    // VEHICULO MAL ESTACIONADO
    // =======================
    ...[
      "estacionado","mal parqueado","obstruyendo","bloqueando","vehiculo"
    ].map(p => ({ palabra: p, incidente: "vehiculo mal estacionado" })),
  ];

  for (const k of keywordsData) {
    const incidente = incidentesCreados[k.incidente];

    try {
      await prisma.keywords_incidentes.create({
        data: {
          palabra: k.palabra.toLowerCase(),
          id_incidente: incidente.id_incidente,
        },
      });
      console.log(`   🔑 Keyword '${k.palabra}' → ${k.incidente}`);
    } catch {
      console.log(`   ℹ️ Keyword '${k.palabra}' ya existía`);
    }
  }

  console.log("🌱 Seed finalizado con exito.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
