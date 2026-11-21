import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { rateLimitMiddleware } from "../middlewares/rate-limit.js";
import { requirePermission } from "../middlewares/api-key-auth.js";
import {
  createQRCode,
  listQRCodes,
  getQRCodeById,
  updateQRCode,
  deleteQRCode,
} from "../services/qrcode.js";
import { generateQRCodeImage } from "../lib/qr-generator.js";
import {
  createQRCodeSchema,
  updateQRCodeSchema,
  listQRCodesSchema,
  downloadQRCodeSchema,
} from "../validators/qrcode.js";
import type { AppEnv } from "../types/index.js";

export const qrCodeRoutes = new Hono<AppEnv>();

qrCodeRoutes.use(
  "*",
  rateLimitMiddleware as unknown as import("hono").MiddlewareHandler<AppEnv>,
);

type AppMiddleware = import("hono").MiddlewareHandler<AppEnv>;

const canRead = requirePermission("qrcodes:read") as unknown as AppMiddleware;
const canCreate = requirePermission("qrcodes:create") as unknown as AppMiddleware;
const canUpdate = requirePermission("qrcodes:update") as unknown as AppMiddleware;
const canDelete = requirePermission("qrcodes:delete") as unknown as AppMiddleware;

qrCodeRoutes.get("/", canRead, zValidator("query", listQRCodesSchema), async (c) => {
  const userId = c.get("userId") as string;

  const query = c.req.valid("query");
  const result = await listQRCodes(c.env, userId, query);
  return c.json(result);
});

qrCodeRoutes.post("/", canCreate, zValidator("json", createQRCodeSchema), async (c) => {
  const userId = c.get("userId") as string;
  const input = c.req.valid("json");
  const qr = await createQRCode(c.env, userId, input);
  return c.json(qr, 201);
});

qrCodeRoutes.get("/:id", canRead, async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const qr = await getQRCodeById(c.env, userId, id);
  return c.json(qr);
});

qrCodeRoutes.patch(
  "/:id",
  canUpdate,
  zValidator("json", updateQRCodeSchema),
  async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const qr = await updateQRCode(c.env, userId, id, input);
    return c.json(qr);
  },
);

qrCodeRoutes.delete("/:id", canDelete, async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  await deleteQRCode(c.env, userId, id);
  return new Response(null, { status: 204 });
});

qrCodeRoutes.get(
  "/:id/download",
  canRead,
  zValidator("query", downloadQRCodeSchema),
  async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const { format } = c.req.valid("query");
    const qr = await getQRCodeById(c.env, userId, id);

    const parametres = { ...qr.parametres, formatImage: format };
    const baseUrl =
      c.env.API_BASE_URL?.replace(/\/$/, "") ?? "https://api.free-qrcode.app";
    const qrContent =
      qr.estDynamique && qr.aliasCourt
        ? `${baseUrl}/q/${qr.aliasCourt}`
        : qr.contenu;

    const { buffer, mimeType, extension } = await generateQRCodeImage(
      qrContent,
      parametres,
    );
    const filename = `qr-${id}.${extension}`;

    return c.body(buffer, 200, {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=31536000",
    });
  },
);

export default qrCodeRoutes;
