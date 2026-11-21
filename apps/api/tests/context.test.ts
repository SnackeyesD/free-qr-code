import { describe, it, expect } from "vitest";
import {
  detecterAppareil,
  languePreferee,
  negocierLangue,
  extraireContexte,
  type CfProprietes,
} from "../src/services/context.js";
import type { AppContext } from "../src/types/index.js";

function makeContext(
  headers: Record<string, string>,
  cf?: CfProprietes,
): AppContext {
  const request = new Request("https://api.test/q/abc");
  for (const [name, value] of Object.entries(headers)) {
    request.headers.set(name, value);
  }
  if (cf) {
    (request as unknown as { cf?: CfProprietes }).cf = cf;
  }
  return {
    req: {
      raw: request,
      header: (name: string) => request.headers.get(name) ?? undefined,
    },
  } as unknown as AppContext;
}

describe("detecterAppareil", () => {
  it("respecte uaPlatform quand il est fourni", () => {
    expect(detecterAppareil({ uaPlatform: "mobile" }, "Mozilla/5.0 (Windows NT 10.0)")).toBe(
      "mobile",
    );
    expect(detecterAppareil({ uaPlatform: "tablet" }, "Mozilla/5.0 (iPhone)")).toBe("tablet");
  });

  it("retombe sur le User-Agent", () => {
    expect(detecterAppareil(undefined, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
    expect(detecterAppareil(undefined, "Mozilla/5.0 (Linux; Android 14)")).toBe("mobile");
    expect(detecterAppareil(undefined, "Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(detecterAppareil(undefined, "Mozilla/5.0 (Windows NT 10.0)")).toBe("desktop");
    expect(detecterAppareil(undefined, "")).toBe("desktop");
  });
});

describe("languePreferee", () => {
  it("extrait la langue principale", () => {
    expect(languePreferee("fr-CG,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(languePreferee("en-US,en;q=0.9")).toBe("en");
  });

  it("renvoie undefined sans en-tete ou pour un joker", () => {
    expect(languePreferee(undefined)).toBeUndefined();
    expect(languePreferee("")).toBeUndefined();
    expect(languePreferee("*")).toBeUndefined();
  });
});

describe("negocierLangue", () => {
  it("choisit la langue disponible la mieux notee", () => {
    expect(negocierLangue("de-DE,de;q=0.9,en;q=0.5", ["fr", "en"])).toBe("en");
    expect(negocierLangue("fr-CG,fr;q=0.9,en;q=0.8", ["en", "fr"])).toBe("fr");
    expect(negocierLangue("es-ES,es;q=0.9,fr;q=0.2", ["en", "fr"])).toBe("fr");
  });

  it("ne devine pas quand aucune langue ne correspond", () => {
    expect(negocierLangue("de-DE,de;q=0.9", ["fr", "en"])).toBeUndefined();
    expect(negocierLangue(undefined, ["fr"])).toBeUndefined();
    expect(negocierLangue("fr", [])).toBeUndefined();
  });
});

describe("extraireContexte", () => {
  it("lit request.cf sans appel reseau", () => {
    const c = makeContext(
      { "User-Agent": "Mozilla/5.0 (Linux; Android 14)", "Accept-Language": "fr-CG,fr;q=0.9" },
      { country: "CG", city: "Brazzaville", region: "Brazzaville", timezone: "Africa/Brazzaville" },
    );

    const ctx = extraireContexte(c, 12);

    expect(ctx.pays).toBe("CG");
    expect(ctx.ville).toBe("Brazzaville");
    expect(ctx.fuseauVisiteur).toBe("Africa/Brazzaville");
    expect(ctx.langue).toBe("fr");
    expect(ctx.appareil).toBe("mobile");
    expect(ctx.scansTotal).toBe(12);
    expect(ctx.maintenant).toBeInstanceOf(Date);
  });

  it("reste utilisable en local sans request.cf", () => {
    const c = makeContext({ "User-Agent": "curl/8.0" });

    const ctx = extraireContexte(c, 0);

    expect(ctx.pays).toBeUndefined();
    expect(ctx.ville).toBeUndefined();
    expect(ctx.langue).toBeUndefined();
    expect(ctx.appareil).toBe("desktop");
  });
});
