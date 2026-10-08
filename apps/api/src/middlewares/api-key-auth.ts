import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../services/auth.js";
import { verifyApiKey } from "../services/api-keys.js";
import type { AppContext, AppEnv } from "../types/index.js";
import type { PermissionCleApi } from "@free-qr/shared-types";

function extractApiKey(c: AppContext): string | null {
  const header = c.req.header("X-API-Key");
  if (header && header.trim().length > 0) return header.trim();
  const authorization = c.req.header("Authorization");
  if (authorization) {
    const match = authorization.match(/^ApiKey\s+(.+)$/i);
    if (match && match[1].trim().length > 0) return match[1].trim();
  }
  return null;
}

/**
 * Authentification JWT (Bearer / cookie, comportement inchangé) OU clé API
 * (`X-API-Key` ou `Authorization: ApiKey <clé>`), avec contrôle de la
 * permission requise pour les appels par clé. Le JWT garde plein accès aux
 * ressources propres de l'utilisateur.
 */
export function requirePermission(permission: PermissionCleApi) {
  return async function apiKeyOrJwtAuth(
    c: AppContext,
    next: () => Promise<void>,
  ) {
    const apiKey = extractApiKey(c);
    if (apiKey) {
      const verified = await verifyApiKey(c.env, apiKey);
      if (!verified) {
        throw new HTTPException(401, { message: "Invalid API key" });
      }
      if (!verified.permissions.includes(permission)) {
        throw new HTTPException(403, { message: "Insufficient permissions" });
      }
      c.set("userId", String(verified.userId));
      c.set("role", verified.role);
      c.set("permissions", verified.permissions);
      c.set("authType", "apikey");
      await next();
      return;
    }
    await authMiddleware(c, async () => {
      c.set("permissions", null);
      c.set("authType", "jwt");
      await next();
    });
  };
}

export type { AppEnv };
