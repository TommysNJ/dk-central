import dns from "dns/promises";

/**
 * Valida si el dominio del correo tiene registros MX
 */
export async function emailDomainExists(email) {
  const domain = email.split("@")[1];
  if (!domain) return false;

  try {
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch {
    return false;
  }
}