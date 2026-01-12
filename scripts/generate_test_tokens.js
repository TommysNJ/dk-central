// scripts/generate_test_tokens.js
import { signAuthToken } from "../src/lib/jwt.js";

function makeToken(rol, mustChangePassword = false) {
  return signAuthToken({
    sub: 999,
    nombre: "Playwright",
    correo: "playwright@test.local",
    rol,
    area: "seguridad",
    id_centro_comercial: 1,
    must_change_password: mustChangePassword,
  });
}

console.log("ADMIN_SISTEMA_TOKEN=", makeToken("admin_sistema", false));
console.log("ADMIN_CENTRO_TOKEN=", makeToken("admin_centro", false));
console.log("USUARIO_OPERATIVO_TOKEN=", makeToken("usuario_operativo", false));

console.log("ADMIN_SISTEMA_MUST_CHANGE_TOKEN=", makeToken("admin_sistema", true));
console.log("ADMIN_CENTRO_MUST_CHANGE_TOKEN=", makeToken("admin_centro", true));
console.log("USUARIO_OPERATIVO_MUST_CHANGE_TOKEN=", makeToken("usuario_operativo", true));