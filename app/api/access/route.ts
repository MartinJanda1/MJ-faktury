import { NextResponse } from "next/server";
import { fetchAresByIco } from "@/lib/ares";
import { normalizeIco } from "@/lib/ico";
import { hashAccessPassword, validateAccessPassword, verifyAccessPassword } from "@/lib/password";
import {
  findTenantByIco,
  readAccessStatus,
  registerCompanyAccess,
  resumeTenantSession,
} from "@/lib/persist";
import { clearTenantCookieOptions, TENANT_COOKIE, tenantCookieOptions } from "@/lib/tenant-session";

export const dynamic = "force-dynamic";

type AccessBody = {
  ico?: string;
  password?: string;
  tenantId?: string;
  /** login = existing firm; register = new firm via ARES */
  intent?: "login" | "register";
  /** Resume unlocked session from localStorage without re-entering password. */
  resume?: boolean;
  logout?: boolean;
};

function jsonWithTenantCookie(
  body: Record<string, unknown>,
  tenantId: string | null,
  init?: { status?: number },
) {
  const response = NextResponse.json(body, init);
  if (tenantId) {
    response.cookies.set(TENANT_COOKIE, tenantId, tenantCookieOptions());
  } else {
    response.cookies.set(TENANT_COOKIE, "", clearTenantCookieOptions());
  }
  return response;
}

/**
 * Access gate:
 * - resume → tenantId + IČO must match a tenant with password
 * - register → new firm when IČO is free; ARES + password
 * - login → find tenant by IČO + password
 * - logout → clear session cookie
 */
export async function GET() {
  const status = await readAccessStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  let body: AccessBody;
  try {
    body = (await request.json()) as AccessBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });
  }

  if (body.logout) {
    return jsonWithTenantCookie({ ok: true, mode: "logout" as const }, null);
  }

  if (body.resume) {
    const tenantId = String(body.tenantId ?? "").trim();
    const ico = normalizeIco(body.ico);
    if (!tenantId || !ico) {
      return jsonWithTenantCookie(
        { ok: false, error: "Relace vypršela. Přihlaste se znovu." },
        null,
        { status: 401 },
      );
    }
    const session = await resumeTenantSession(tenantId, ico);
    if (!session) {
      return jsonWithTenantCookie(
        { ok: false, error: "Relace vypršela. Přihlaste se znovu." },
        null,
        { status: 401 },
      );
    }
    return jsonWithTenantCookie(
      {
        ok: true,
        mode: "resume" as const,
        tenantId: session.tenantId,
        ico: session.ico,
        companyName: session.companyName,
      },
      session.tenantId,
    );
  }

  const ico = normalizeIco(body.ico);
  if (!ico) {
    return NextResponse.json({ ok: false, error: "Zadejte platné IČO (8 číslic)." }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const passwordError = validateAccessPassword(password);
  if (passwordError) {
    return NextResponse.json({ ok: false, error: passwordError }, { status: 400 });
  }

  const intent = body.intent === "register" ? "register" : "login";

  if (intent === "register") {
    const existing = await findTenantByIco(ico);
    if (existing?.company.accessPasswordHash) {
      return NextResponse.json(
        {
          ok: false,
          error: "Firma s tímto IČO už je registrována. Přepněte na Přihlášení.",
        },
        { status: 409 },
      );
    }

    let party;
    try {
      party = await fetchAresByIco(ico);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ARES se nepodařilo načíst.";
      const status = message.includes("nebyl v ARES nalezen") ? 404 : 502;
      return NextResponse.json({ ok: false, error: message }, { status });
    }

    let created: { tenantId: string; ico: string; companyName: string };
    try {
      created = await registerCompanyAccess(ico, hashAccessPassword(password), {
        name: party.name,
        dic: party.dic,
        street: party.street,
        city: party.city,
        zip: party.zip,
        country: party.country,
        vatNote: party.vatNote,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registrace se nepovedla.";
      return NextResponse.json({ ok: false, error: message }, { status: 409 });
    }

    return jsonWithTenantCookie(
      {
        ok: true,
        mode: "register" as const,
        tenantId: created.tenantId,
        ico: created.ico,
        companyName: created.companyName || party.name,
        party,
      },
      created.tenantId,
    );
  }

  // login
  const tenant = await findTenantByIco(ico);
  if (!tenant?.company.accessPasswordHash) {
    return NextResponse.json(
      { ok: false, error: "Firma s tímto IČO ještě není registrována. Nejdřív dokončete registraci." },
      { status: 404 },
    );
  }

  if (!verifyAccessPassword(password, tenant.company.accessPasswordHash)) {
    return NextResponse.json({ ok: false, error: "Neplatné heslo." }, { status: 401 });
  }

  const storedIco = normalizeIco(tenant.company.ico);
  return jsonWithTenantCookie(
    {
      ok: true,
      mode: "login" as const,
      tenantId: tenant.id,
      ico: storedIco,
      companyName: tenant.company.name.trim(),
    },
    tenant.id,
  );
}
