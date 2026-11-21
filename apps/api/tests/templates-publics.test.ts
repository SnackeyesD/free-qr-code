import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestApp,
  createTestEnv,
  createVerifiedUser,
  makeRequest,
  type TestContext,
} from "./setup.js";

const app = createTestApp();

describe("Templates publics API", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  async function login(email: string): Promise<{ token: string; userId: string }> {
    const user = await createVerifiedUser(ctx.env, email, "StrongPass123!", "Test");
    const res = await makeRequest(app, ctx.env, "POST", "/auth/login", {
      body: { email, motDePasse: "StrongPass123!" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string };
    return { token: body.accessToken, userId: user.id };
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function insertModele(options: {
    idUtilisateur?: string;
    nom: string;
    estPublic: boolean;
    typeContenu?: string;
  }): string {
    const publicId = crypto.randomUUID();
    ctx.db
      .prepare(
        `INSERT INTO modeles (
          public_id, id_utilisateur, nom, description, type_contenu,
          parametres_par_defaut, est_public, date_creation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        publicId,
        options.idUtilisateur ? Number(options.idUtilisateur) : null,
        options.nom,
        `Description de ${options.nom}`,
        options.typeContenu ?? "url",
        JSON.stringify({
          couleur: "#123456",
          background: "#FFFFFF",
          taille: 400,
          correction: "Q",
          cadre: false,
        }),
        options.estPublic ? 1 : 0,
        new Date().toISOString(),
      );
    return publicId;
  }

  it("GET /templates/publics exige une session", async () => {
    const res = await makeRequest(app, ctx.env, "GET", "/templates/publics");
    expect(res.status).toBe(401);
  });

  it("liste uniquement les modèles publics, sans données internes", async () => {
    const { token, userId } = await login("galerie@example.com");
    const publicId = insertModele({
      idUtilisateur: userId,
      nom: "Modèle public de test",
      estPublic: true,
      typeContenu: "wifi",
    });
    const privateId = insertModele({
      idUtilisateur: userId,
      nom: "Modèle privé de test",
      estPublic: false,
    });

    const res = await makeRequest(app, ctx.env, "GET", "/templates/publics", {
      headers: auth(token),
    });
    expect(res.status, await res.clone().text()).toBe(200);

    const body = (await res.json()) as {
      data: Array<{
        id: string;
        idUtilisateur?: string;
        nom: string;
        typeContenu: string;
        parametresParDefaut: { couleur?: string; correction?: string };
        estPublic: boolean;
      }>;
      total: number;
    };

    expect(body.total).toBe(body.data.length);
    expect(body.data.every((modele) => modele.estPublic)).toBe(true);
    expect(body.data.some((modele) => modele.id === privateId)).toBe(false);
    expect(body.data.every((modele) => modele.idUtilisateur === undefined)).toBe(true);

    const trouve = body.data.find((modele) => modele.id === publicId);
    expect(trouve).toBeDefined();
    expect(trouve?.nom).toBe("Modèle public de test");
    expect(trouve?.typeContenu).toBe("wifi");
    expect(trouve?.parametresParDefaut.couleur).toBe("#123456");
    expect(trouve?.parametresParDefaut.correction).toBe("Q");
  });

  it("la galerie est accessible à un utilisateur non admin", async () => {
    const { token } = await login("simple@example.com");
    const res = await makeRequest(app, ctx.env, "GET", "/templates/publics", {
      headers: auth(token),
    });
    expect(res.status).toBe(200);
  });

  it("GET /templates/publics/:id sert un modèle public par son identifiant public", async () => {
    const { token, userId } = await login("detail@example.com");
    const publicId = insertModele({
      idUtilisateur: userId,
      nom: "Détail public",
      estPublic: true,
      typeContenu: "vcard",
    });

    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/templates/publics/${publicId}`,
      { headers: auth(token) },
    );
    expect(res.status, await res.clone().text()).toBe(200);

    const modele = (await res.json()) as {
      id: string;
      idUtilisateur?: string;
      nom: string;
      typeContenu: string;
      estPublic: boolean;
    };
    expect(modele.id).toBe(publicId);
    expect(modele.idUtilisateur).toBeUndefined();
    expect(modele.nom).toBe("Détail public");
    expect(modele.typeContenu).toBe("vcard");
    expect(modele.estPublic).toBe(true);
  });

  it("un modèle privé ou inconnu reste introuvable", async () => {
    const { token, userId } = await login("prive@example.com");
    const privateId = insertModele({
      idUtilisateur: userId,
      nom: "Privé",
      estPublic: false,
    });

    const prive = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/templates/publics/${privateId}`,
      { headers: auth(token) },
    );
    expect(prive.status).toBe(404);

    const inconnu = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/templates/publics/${crypto.randomUUID()}`,
      { headers: auth(token) },
    );
    expect(inconnu.status).toBe(404);
  });
});
