import speakeasy from "speakeasy";

/**
 * Genera un secreto TOTP
 */
export function generateTwoFactorSecret(usuario) {
  return speakeasy.generateSecret({
    name: `DKMS (${usuario})`,
    length: 20,
  });
}

/**
 * Verifica código TOTP
 */
export function verifyTwoFactorToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1,
  });
}