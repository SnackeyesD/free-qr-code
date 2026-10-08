import type { Context, Env, Hono, Next, Handler } from "hono";
import type { D1Database, R2Bucket, Fetcher } from "@cloudflare/workers-types";

declare global {
  interface KVNamespace {
    get(
      key: string,
      type?: "text" | "json" | "arrayBuffer" | "stream",
    ): Promise<unknown | null>;
    put(
      key: string,
      value: string | ArrayBuffer | ReadableStream,
      options?: { expiration?: number; expirationTtl?: number },
    ): Promise<void>;
    delete(key: string): Promise<void>;
  }
}

export interface AppEnv {
  Bindings: {
    DB: D1Database;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_SALT?: string;
    API_BASE_URL: string;
    CORS_ORIGINS: string;
    FRONTEND_URL: String;
    EMAIL_WORKER_URL?: string;
    EMAIL_WORKER?: Fetcher;
    ACCESS_TOKEN_TTL_SECONDS: string;
    REFRESH_TOKEN_TTL_DAYS: string;
    RATE_LIMIT_WINDOW_SECONDS: string;
    RATE_LIMIT_MAX_REQUESTS: string;
    RATE_LIMIT_KV?: KVNamespace;
    JWT_TRACKING_SECRET: string;
    SMTP_API_URL?: string;
    SMTP_FROM?: string;
    R2_PUBLIC_URL?: string;
    QR_IMAGES?: R2Bucket;
  };
  Variables: {
    userId?: string;
    role?: string;
    jti?: string;
    requestId?: string;
    permissions?: string[] | null;
    authType?: "jwt" | "apikey";
  };
}

export type AppContext = Context<AppEnv>;

export interface JWTPayload {
  sub: string;
  role: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface RefreshJWTPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface UserDoc {
  id: number;
  publicId: string;
  email: string;
  motDePasse: string;
  nom: string;
  estVerifie: boolean;
  consentementMarketing: boolean;
  dateConsentementMarketing?: Date | string;
  dateInscription: Date | string;
  dateDerniereConnexion?: Date | string;
  preferences?: Record<string, unknown>;
  estActif: boolean;
  role: "utilisateur" | "admin";
}

export interface RefreshTokenDoc {
  id?: number;
  idUtilisateur: number;
  tokenHash: string;
  userAgent?: string;
  adresseIP?: string;
  dateCreation: Date | string;
  dateExpiration: Date | string;
  dateRevocation?: Date | string;
  estRevoke: boolean;
}

export type TypeContenuQR =
  | "url"
  | "texte"
  | "email"
  | "telephone"
  | "sms"
  | "wifi"
  | "vcard"
  | "geo"
  | "pdf";

export interface QRCodeDoc {
  id: number;
  publicId: string;
  idUtilisateur: number;
  contenu: string;
  typeContenu: TypeContenuQR;
  estDynamique: boolean;
  aliasCourt?: string;
  parametres: Record<string, unknown>;
  estActif: boolean;
  dateCreation: Date | string;
  dateExpiration?: Date | string;
  nombreScansTotal: number;
  urlImage?: string;
  idModele?: number;
}

export interface ScanDoc {
  id?: number;
  idQRCode: number;
  adresseIP: string;
  userAgent?: string;
  pays?: string;
  ville?: string;
  referer?: string;
  dateScan: Date | string;
  estUnique: boolean;
}

export interface StatistiquesQRCodeDoc {
  id?: number;
  idQRCode: number;
  date: Date | string;
  nombreScans: number;
  nombreScansUniques: number;
  paysTop?: string;
  appareilsTop?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

export interface AuthenticatedContext extends AppContext {
  get var(): AppEnv["Variables"] & { userId: string; role: string };
}

export type AppNext = Next;
export type AppHandler = Handler<AppEnv>;
export type AppHono = Hono<AppEnv>;
