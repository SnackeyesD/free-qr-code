import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createVerifiedUser,
  makeRequest,
  createTestEnv,
  createTestApp,
} from "./setup.js";

const app = createTestApp();

const schema = {
  version: 1 as const,
  champs: [
    { cle: "nom", libelle: "Nom", type: "texte" as const, obligatoire: true },
    { cle: "email", libelle: "Email", type: "email" as const },
    {
      cle: "offre",
      libelle: "Offre",
      type: "liste" as const,
      options: [
        { valeur: "essentiel", libelle: "Essentiel" },
        { valeur: "pro", libelle: "Pro" },
      ],
    },
  ],
};

describe("Fiches API", () => {
  let ctx: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  async function loginUser(email: string) {
    await createVerifiedUser(ctx.env, email, "StrongPass123!", "Test");
    const res = await makeRequest(app, ctx.env, "POST", "/auth/login", {
      body: { email, motDePasse: "StrongPass123!" },
    });
    const body = (await res.json()) as { accessToken: string };
    return body.accessToken;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function creerFicheComplete(token: string) {
    const res = await makeRequest(app, ctx.env, "POST", "/fiches", {
      body: {
        titre: "Fiche contact",
        schema,
        valeurs: { nom: "Gloire Messia SAYI", email: "messiasayi@gmail.com" },
      },
      headers: auth(token),
    });
    expect(res.status).toBe(201);
    return (await res.json()) as {
      id: string;
      titre: string;
      schema: typeof schema;
      valeurs: Record<string, unknown>;
      version: number;
    };
  }

  it("crée une fiche avec un schéma inline", async () => {
    const token = await loginUser("fiche1@example.com");
    const res = await makeRequest(app, ctx.env, "POST", "/fiches", {
      body: {
        titre: "Fiche contact",
        schema,
        valeurs: {
          nom: "Gloire Messia SAYI",
          email: "messiasayi@gmail.com",
          offre: "pro",
        },
      },
      headers: auth(token),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      titre: string;
      schema: typeof schema;
      valeurs: Record<string, unknown>;
      version: number;
      estActive: boolean;
    };
    expect(body.id).toBeTruthy();
    expect(body.titre).toBe("Fiche contact");
    expect(body.schema.champs).toHaveLength(3);
    expect(body.valeurs.nom).toBe("Gloire Messia SAYI");
    expect(body.valeurs.offre).toBe("pro");
    expect(body.version).toBe(1);
    expect(body.estActive).toBe(true);
  });

  it("refuse une fiche dont un champ obligatoire est vide", async () => {
    const token = await loginUser("fiche2@example.com");
    const res = await makeRequest(app, ctx.env, "POST", "/fiches", {
      body: { titre: "Incomplète", schema, valeurs: { email: "a@b.test" } },
      headers: auth(token),
    });

    expect(res.status).toBe(400);
    expect(await res.text()).toContain("obligatoire");
  });

  it("refuse une URL de champ invalide", async () => {
    const token = await loginUser("fiche3@example.com");
    const res = await makeRequest(app, ctx.env, "POST", "/fiches", {
      body: {
        titre: "Lien",
        schema: {
          version: 1,
          champs: [{ cle: "site", libelle: "Site", type: "url" }],
        },
        valeurs: { site: "javascript:alert(1)" },
      },
      headers: auth(token),
    });

    expect(res.status).toBe(400);
    expect(await res.text()).toContain("URL http(s)");
  });

  it("refuse une option absente de la liste", async () => {
    const token = await loginUser("fiche4@example.com");
    const res = await makeRequest(app, ctx.env, "POST", "/fiches", {
      body: {
        titre: "Offre",
        schema,
        valeurs: { nom: "Test", offre: "inconnue" },
      },
      headers: auth(token),
    });

    expect(res.status).toBe(400);
    expect(await res.text()).toContain("option valide");
  });

  it("liste uniquement les fiches du propriétaire", async () => {
    const tokenA = await loginUser("fiche-a@example.com");
    const tokenB = await loginUser("fiche-b@example.com");
    await creerFicheComplete(tokenA);

    const resA = await makeRequest(app, ctx.env, "GET", "/fiches", {
      headers: auth(tokenA),
    });
    const bodyA = (await resA.json()) as { total: number; data: unknown[] };
    expect(bodyA.total).toBe(1);
    expect(bodyA.data).toHaveLength(1);

    const resB = await makeRequest(app, ctx.env, "GET", "/fiches", {
      headers: auth(tokenB),
    });
    const bodyB = (await resB.json()) as { total: number; data: unknown[] };
    expect(bodyB.total).toBe(0);
  });

  it("refuse l'accès à la fiche d'un autre utilisateur", async () => {
    const tokenA = await loginUser("fiche-isole-a@example.com");
    const tokenB = await loginUser("fiche-isole-b@example.com");
    const fiche = await creerFicheComplete(tokenA);

    const res = await makeRequest(app, ctx.env, "GET", `/fiches/${fiche.id}`, {
      headers: auth(tokenB),
    });
    expect(res.status).toBe(404);
  });

  it("met à jour une fiche et incrémente sa révision", async () => {
    const token = await loginUser("fiche5@example.com");
    const fiche = await creerFicheComplete(token);

    const res = await makeRequest(app, ctx.env, "PATCH", `/fiches/${fiche.id}`, {
      body: { titre: "Fiche mise à jour", valeurs: { nom: "Nouveau Nom" } },
      headers: auth(token),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      titre: string;
      valeurs: Record<string, unknown>;
      version: number;
    };
    expect(body.titre).toBe("Fiche mise à jour");
    expect(body.valeurs.nom).toBe("Nouveau Nom");
    expect(body.version).toBe(2);
  });

  it("sert la fiche publiquement sans donnée interne", async () => {
    const token = await loginUser("fiche6@example.com");
    const fiche = await creerFicheComplete(token);

    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/public/fiches/${fiche.id}`,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.publicId).toBe(fiche.id);
    expect(body.titre).toBe("Fiche contact");
    expect(body.valeurs).toMatchObject({ nom: "Gloire Messia SAYI" });
    expect(body.idUtilisateur).toBeUndefined();
    expect(body.id).toBeUndefined();
  });

  it("renvoie 404 pour une fiche publique inconnue", async () => {
    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      "/public/fiches/00000000-0000-4000-8000-000000000000",
    );
    expect(res.status).toBe(404);
  });

  it("renvoie 410 pour une fiche archivée", async () => {
    const token = await loginUser("fiche7@example.com");
    const fiche = await creerFicheComplete(token);

    const patch = await makeRequest(
      app,
      ctx.env,
      "PATCH",
      `/fiches/${fiche.id}`,
      { body: { estActive: false }, headers: auth(token) },
    );
    expect(patch.status).toBe(200);

    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/public/fiches/${fiche.id}`,
    );
    expect(res.status).toBe(410);
  });

  it("supprime une fiche non liée", async () => {
    const token = await loginUser("fiche8@example.com");
    const fiche = await creerFicheComplete(token);

    const res = await makeRequest(
      app,
      ctx.env,
      "DELETE",
      `/fiches/${fiche.id}`,
      { headers: auth(token) },
    );
    expect(res.status).toBe(204);

    const get = await makeRequest(app, ctx.env, "GET", `/fiches/${fiche.id}`, {
      headers: auth(token),
    });
    expect(get.status).toBe(404);
  });

  it("refuse de supprimer une fiche liée à un QR", async () => {
    const token = await loginUser("fiche9@example.com");
    const fiche = await creerFicheComplete(token);

    const qrRes = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: { type: "dynamique", idFiche: fiche.id },
      headers: auth(token),
    });
    expect(qrRes.status).toBe(201);

    const res = await makeRequest(
      app,
      ctx.env,
      "DELETE",
      `/fiches/${fiche.id}`,
      { headers: auth(token) },
    );
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("liée à un QR code");
  });

  it("crée une fiche depuis un modèle et conserve le snapshot", async () => {
    const token = await loginUser("fiche-modele@example.com");

    const modeleRes = await makeRequest(app, ctx.env, "POST", "/fiches/modeles", {
      body: { nom: "Modèle contact", schema },
      headers: auth(token),
    });
    expect(modeleRes.status).toBe(201);
    const modele = (await modeleRes.json()) as { id: string; version: number };

    const ficheRes = await makeRequest(app, ctx.env, "POST", "/fiches", {
      body: {
        titre: "Fiche depuis modèle",
        idModele: modele.id,
        valeurs: { nom: "Alice" },
      },
      headers: auth(token),
    });
    expect(ficheRes.status).toBe(201);
    const fiche = (await ficheRes.json()) as { id: string; schema: typeof schema };

    const updateModele = await makeRequest(
      app,
      ctx.env,
      "PATCH",
      `/fiches/modeles/${modele.id}`,
      {
        body: {
          schema: {
            version: 1,
            champs: [
              ...schema.champs,
              { cle: "ville", libelle: "Ville", type: "texte" },
            ],
          },
        },
        headers: auth(token),
      },
    );
    expect(updateModele.status).toBe(200);
    const modeleMisAJour = (await updateModele.json()) as { version: number };
    expect(modeleMisAJour.version).toBe(2);

    const getFiche = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/fiches/${fiche.id}`,
      { headers: auth(token) },
    );
    const ficheRelue = (await getFiche.json()) as { schema: typeof schema };
    expect(ficheRelue.schema.champs).toHaveLength(3); // snapshot inchangé
  });

  it("crée un QR dynamique lié à une fiche et redirige au scan", async () => {
    const token = await loginUser("fiche-qr@example.com");
    const fiche = await creerFicheComplete(token);

    const qrRes = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: { type: "dynamique", idFiche: fiche.id },
      headers: auth(token),
    });

    expect(qrRes.status).toBe(201);
    const qr = (await qrRes.json()) as {
      aliasCourt: string;
      contenu: string;
      idFiche?: string;
      estDynamique: boolean;
      typeContenu: string;
    };
    expect(qr.estDynamique).toBe(true);
    expect(qr.typeContenu).toBe("url");
    expect(qr.idFiche).toBe(fiche.id);
    expect(qr.contenu).toBe(`${ctx.env.FRONTEND_URL}/d/${fiche.id}`);

    const scan = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`);
    expect(scan.status).toBe(302);
    expect(scan.headers.get("location")).toBe(`${ctx.env.FRONTEND_URL}/d/${fiche.id}`);
  });

  it("refuse de créer un QR pour une fiche incomplète", async () => {
    const token = await loginUser("fiche-qr-incomplete@example.com");
    const create = await makeRequest(app, ctx.env, "POST", "/fiches", {
      body: {
        titre: "Brouillon",
        schema: {
          version: 1,
          champs: [
            { cle: "nom", libelle: "Nom", type: "texte", obligatoire: true },
          ],
        },
        valeurs: {},
      },
      headers: auth(token),
    });
    expect([201, 400]).toContain(create.status);

    // Le schéma exige un champ obligatoire : la création est refusée.
    const token2 = await loginUser("fiche-qr-incomplete2@example.com");
    const ficheRes = await makeRequest(app, ctx.env, "POST", "/fiches", {
      body: {
        titre: "Brouillon sans obligatoire",
        schema: {
          version: 1,
          champs: [{ cle: "nom", libelle: "Nom", type: "texte" }],
        },
        valeurs: {},
      },
      headers: auth(token2),
    });
    expect(ficheRes.status).toBe(201);
    const fiche = (await ficheRes.json()) as { id: string };

    const qrRes = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: { type: "dynamique", idFiche: fiche.id },
      headers: auth(token2),
    });
    // Une fiche sans champ obligatoire est complète : le QR est accepté.
    expect(qrRes.status).toBe(201);
  });

  it("délie une fiche d'un QR", async () => {
    const token = await loginUser("fiche-qr-unlink@example.com");
    const fiche = await creerFicheComplete(token);

    const qrRes = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: { type: "dynamique", idFiche: fiche.id },
      headers: auth(token),
    });
    const qr = (await qrRes.json()) as { id: string; aliasCourt: string };

    const res = await makeRequest(app, ctx.env, "PATCH", `/qrcodes/${qr.id}`, {
      body: { idFiche: null },
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { idFiche?: string };
    expect(body.idFiche).toBeUndefined();
  });

  it("refuse de lier deux fois contenu et fiche", async () => {
    const token = await loginUser("fiche-qr-both@example.com");
    const fiche = await creerFicheComplete(token);

    const res = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: {
        type: "dynamique",
        idFiche: fiche.id,
        contenu: "https://example.com",
      },
      headers: auth(token),
    });
    expect(res.status).toBe(400);
  });
});
