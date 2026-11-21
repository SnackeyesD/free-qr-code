import { describe, it, expect } from "vitest";
import {
  construireReponseContenu,
  estVCardValide,
  nomFichierVCard,
  normaliserVCard,
  preparerContenuDynamique,
} from "../src/services/contenu-dynamique.js";

describe("contenu dynamique", () => {
  const vcard =
    "BEGIN:VCARD\nVERSION:3.0\nFN:Gloire Messia SAYI\n" +
    "TEL:+24206718028\nURL:https://momo-calc.getcongo.com/\nEND:VCARD";

  it("normalise les fins de ligne d'une vCard en CRLF", () => {
    const resultat = normaliserVCard(vcard);
    expect(resultat.endsWith("\r\n")).toBe(true);
    expect(resultat).not.toMatch(/[^\r]\n/);
  });

  it("dérive un nom de fichier .vcf sûr depuis FN", () => {
    expect(nomFichierVCard(vcard)).toBe("Gloire-Messia-SAYI.vcf");
    expect(nomFichierVCard("BEGIN:VCARD\nFN:Élodie O'Connor\nEND:VCARD")).toBe(
      "Elodie-O-Connor.vcf",
    );
    expect(nomFichierVCard("BEGIN:VCARD\nFN:\nEND:VCARD")).toBe("contact.vcf");
  });

  it("reconnait une vCard complete", () => {
    expect(estVCardValide(vcard)).toBe(true);
    expect(estVCardValide("BEGIN:VCARD\nVERSION:3.0\nFN:Incomplet")).toBe(false);
  });

  it("prepare une vCard dynamique sans la transformer en URL", () => {
    const resultat = preparerContenuDynamique("vcard", vcard);
    expect(resultat).toContain("BEGIN:VCARD");
    expect(resultat).toContain("URL:https://momo-calc.getcongo.com/");
  });

  it("enveloppe un nom nu en vCard valide", () => {
    const resultat = preparerContenuDynamique("vcard", "Jean Dupont");
    expect(resultat).toContain("BEGIN:VCARD");
    expect(resultat).toContain("FN:Jean Dupont");
    expect(resultat).toContain("END:VCARD");
  });

  it("normalise une URL dynamique sans schema", () => {
    expect(preparerContenuDynamique("url", "www.example.com")).toBe(
      "https://www.example.com",
    );
  });

  it("refuse une URL dynamique invalide ou avec saut de ligne", () => {
    expect(() => preparerContenuDynamique("url", "javascript:alert(1)")).toThrow();
    expect(() =>
      preparerContenuDynamique("url", "https://e.test/a\nb"),
    ).toThrow();
  });

  it("accepte le texte et le WiFi sans redirection", () => {
    expect(preparerContenuDynamique("texte", "Bonjour")).toBe("Bonjour");
    expect(
      preparerContenuDynamique("wifi", "WIFI:T:WPA;S:MonReseau;P:secret;;"),
    ).toContain("WIFI:");
  });

  it("encode les types URI connus", () => {
    expect(preparerContenuDynamique("email", "a@b.test")).toBe(
      "mailto:a@b.test",
    );
    expect(preparerContenuDynamique("telephone", "+24206718028")).toContain(
      "tel:",
    );
    expect(preparerContenuDynamique("sms", "+24206718028:Bonjour")).toContain(
      "smsto:",
    );
    expect(preparerContenuDynamique("geo", "0,0")).toContain("geo:");
  });

  it("refuse un mailto contenant un saut de ligne (injection de header)", () => {
    expect(() =>
      preparerContenuDynamique("email", "mailto:a@b.test\nBcc:x@y.test"),
    ).toThrow();
  });

  it("sert une vCard en corps text/vcard avec nom de fichier", () => {
    const reponse = construireReponseContenu("vcard", vcard);
    expect(reponse.type).toBe("corps");
    if (reponse.type !== "corps") return;
    expect(reponse.contentType).toContain("text/vcard");
    expect(reponse.nomFichier).toBe("Gloire-Messia-SAYI.vcf");
    expect(reponse.corps).toContain("\r\n");
  });

  it("sert le texte et le WiFi en text/plain", () => {
    const texte = construireReponseContenu("texte", "Bonjour");
    expect(texte.type).toBe("corps");
    if (texte.type !== "corps") return;
    expect(texte.contentType).toContain("text/plain");

    const wifi = construireReponseContenu("wifi", "WIFI:T:WPA;S:x;P:y;;");
    expect(wifi.type).toBe("corps");
  });

  it("redirige les types URI et les URL valides", () => {
    expect(construireReponseContenu("url", "https://e.test/fr")).toEqual({
      type: "redirect",
      destination: "https://e.test/fr",
    });
    expect(construireReponseContenu("email", "mailto:a@b.test")).toEqual({
      type: "redirect",
      destination: "mailto:a@b.test",
    });
  });

  it("renvoie 404 pour une URL stockee invalide", () => {
    expect(() => construireReponseContenu("url", "javascript:alert(1)")).toThrow();
  });
});
