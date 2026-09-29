import { Hono } from "hono";
import {
  corsMiddleware,
  errorHandler,
  requestIdMiddleware,
} from "./middlewares/common.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/user.js";
import { qrCodeRoutes } from "./routes/qrcode.js";
import { redirectRoutes } from "./routes/redirect.js";
import { statsRoutes } from "./routes/stats.js";
import { adminRoutes, trackingRoutes } from "./routes/admin.js";
import { adminDashboardRoutes, dashboardRoutes } from "./routes/dashboard.js";
import { apiKeyRoutes } from "./routes/api-keys.js";
import { logRoutes } from "./routes/logs.js";
import { previewRoutes } from "./routes/preview.js";
import type { AppEnv } from "./types/index.js";
import r2Routes from "./routes/r2.js";

const app = new Hono<AppEnv>();

app.use("*", requestIdMiddleware);
app.use("*", corsMiddleware);

app.onError(errorHandler);

app.get("/", (c) => c.json({ ok: true, service: "free-qr-api" }));
app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/auth", authRoutes);
app.route("/qrcodes", qrCodeRoutes);
app.route("/qrcodes", statsRoutes);
app.route("/r2", r2Routes);
app.route("/q", redirectRoutes);
app.route("/me", userRoutes);
app.route("/admin", adminRoutes);
app.route("/admin/dashboard", adminDashboardRoutes);
app.route("/tracking", trackingRoutes);
app.route("/api-keys", apiKeyRoutes);
app.route("/logs", logRoutes);
app.route("/preview", previewRoutes);
app.route("/dashboard", dashboardRoutes);

export default app;
