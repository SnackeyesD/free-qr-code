// services/email.ts
import type { AppEnv } from "../types/index.js";

export async function sendVerificationEmail(
  env: AppEnv["Bindings"],
  to: string,
  link: string,
): Promise<void> {
  try {
    const response = await fetch(
      `${env.EMAIL_WORKER_URL}/api/sendVerification`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          link,
          appName: "Free QR Code",
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Échec envoi email de vérification (${response.status}):`,
        errorText,
      );
    }
  } catch (err) {
    console.error(
      "Erreur réseau lors de l'envoi de l'email de vérification:",
      err,
    );
  }
}
