// services/email.ts
import type { AppEnv } from "../types/index.js";

async function postToEmailWorker(
  env: AppEnv["Bindings"],
  path: string,
  payload: Record<string, unknown>,
  label: string,
): Promise<void> {
  try {
    const body = JSON.stringify(payload);
     const headers = { "Content-Type": "application/json" };
     const response = env.EMAIL_WORKER
       ? await env.EMAIL_WORKER.fetch(`https://internal${path}`, {
           method: "POST",
           headers,
           body,
         })
       : await (async () => {
           if (!env.EMAIL_WORKER_URL) {
             console.error(`Envoi email ${label} ignoré: ni binding ni EMAIL_WORKER_URL`);
             return null;
           }
           return fetch(`${env.EMAIL_WORKER_URL}${path}`, { method: "POST", headers, body });
         })();
    if (!response) return;
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Échec envoi email ${label} (${response.status}):`,
        errorText,
      );
    }
  } catch (err) {
    console.error(`Erreur réseau lors de l'envoi de l'email ${label}:`, err);
  }
}

export async function sendVerificationEmail(
  env: AppEnv["Bindings"],
  to: string,
  link: string,
): Promise<void> {
  await postToEmailWorker(
    env,
    "/api/sendVerification",
    { to, link, appName: "Free QR Code" },
    "de vérification",
  );
}

export async function sendResetEmail(
  env: AppEnv["Bindings"],
  to: string,
  link: string,
): Promise<void> {
  await postToEmailWorker(
    env,
    "/api/sendReset",
    { to, link, appName: "Free QR Code" },
    "de réinitialisation",
  );
}
