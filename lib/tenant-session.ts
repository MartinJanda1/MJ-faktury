export const TENANT_COOKIE = "mj-faktury-tenant";

/** Prefer test/env override, then HttpOnly session cookie. */
export async function getTenantIdFromCookie(): Promise<string | null> {
  const fromEnv = process.env.FAKTURA_TENANT_ID?.trim();
  if (fromEnv) return fromEnv;

  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const value = jar.get(TENANT_COOKIE)?.value?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export async function requireTenantId(): Promise<string> {
  const id = await getTenantIdFromCookie();
  if (!id) throw new Error("Nejste přihlášeni k firmě.");
  return id;
}

export function tenantCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.VERCEL === "1",
    maxAge: maxAgeSeconds,
  };
}

export function clearTenantCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.VERCEL === "1",
    maxAge: 0,
  };
}
