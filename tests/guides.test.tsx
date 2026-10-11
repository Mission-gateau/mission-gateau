import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Hors de Next, le routeur n'est pas monté.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), notFound: () => { throw new Error("404"); } }));

import { PageGuide } from "@/composants/Guide";
import { GUIDE } from "@/contenu/guide";
import { FORMULAIRE } from "@/contenu/formulaire";
import { GUIDES, TEXTES_GUIDES, type Guide } from "@/contenu/guides";
import { EXEMPLES_DES_GUIDES, PRENOM_D_EXEMPLE } from "@/contenu/guides/exemples";
import { construireKit, toutesLesEnigmes } from "@/engine/kit";
import { ressourcesExternes } from "./ressources-externes";

/**
 * Les cinq guides : utiles par eux-mêmes (900 à 1 500 mots), un exemple
 * produit par le vrai moteur avec une graine fixe, un lien vers /creer et
 * l'aperçu gratuit (le prix seulement si la vente est ouverte), aucune
 * ressource d'un autre domaine. L'orthographe et la liste noire sont
 * vérifiées avec tous les textes (tests/textes.test.ts).
 */

/** Les mots du texte propre au guide : titre, chapeau, titres de sections, paragraphes et listes. */
function mots(guide: Guide): number {
  const textes = [guide.titre, guide.chapeau];
  for (const section of guide.sections) {
    textes.push(section.titre);
    for (const bloc of section.blocs) {
      if (bloc.type === "paragraphe") textes.push(bloc.texte);
      if (bloc.type === "liste" || bloc.type === "etapes") textes.push(...bloc.elements);
    }
  }
  return textes
    .join(" ")
    .split(/[\s  ]+/)
    .filter((mot) => /[\p{L}\d]/u.test(mot)).length;
}

function rendre(guide: Guide, prix: string | null = null): string {
  return renderToStaticMarkup(<PageGuide guide={guide} prix={prix} modifieLe="11 octobre 2026" />);
}

function texteVisible(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/[\s  ]+/g, " ");
}

describe("les guides", () => {
  it("sont cinq, chacun à une adresse sobre et unique, avec son exemple", () => {
    expect(GUIDES).toHaveLength(5);
    expect(new Set(GUIDES.map((guide) => guide.adresse)).size).toBe(5);
    for (const guide of GUIDES) {
      expect(guide.adresse).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(EXEMPLES_DES_GUIDES[guide.adresse], guide.adresse).toBeDefined();
      expect(guide.modifieLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  for (const guide of GUIDES) {
    describe(guide.titreCourt, () => {
      it("compte 900 à 1 500 mots", () => {
        const nombre = mots(guide);
        expect(nombre, `${guide.adresse} : ${nombre} mots`).toBeGreaterThanOrEqual(900);
        expect(nombre, `${guide.adresse} : ${nombre} mots`).toBeLessThanOrEqual(1500);
      });

      it("a un titre et une description propres, et chaque bloc obligatoire", () => {
        expect(guide.description.length).toBeGreaterThanOrEqual(70);
        expect(guide.description.length).toBeLessThanOrEqual(160);
        expect(guide.titre.length).toBeLessThanOrEqual(90);
        const types = guide.sections.flatMap((section) => section.blocs.map((bloc) => bloc.type));
        expect(types.filter((type) => type === "exemple")).toHaveLength(1);
        expect(types).toContain("versCreer");
      });

      it("renvoie vers /creer et l'aperçu gratuit, sans prix tant que la vente est fermée", () => {
        const fermee = rendre(guide);
        expect(fermee).toContain('href="/creer"');
        expect(texteVisible(fermee)).toContain(texteVisible(TEXTES_GUIDES.boutonCreer));
        expect(fermee).not.toMatch(/12,90/);
        expect(rendre(guide, "12,90 €")).toMatch(/12,90/);
      });

      it("montre un exemple produit par le vrai moteur, avec un prénom d'exemple", () => {
        const exemple = EXEMPLES_DES_GUIDES[guide.adresse]!;
        const html = rendre(guide);
        expect(html).toContain(`data-exemple="${exemple.genre}"`);
        expect(texteVisible(html)).toContain(PRENOM_D_EXEMPLE);
        const kit = construireKit(exemple.configurations[0]!, exemple.graine);
        const attendu =
          exemple.genre === "pictogrammes"
            ? toutesLesEnigmes(kit).find((enigme) => enigme.type === "pictogrammes")!.solution
            : exemple.genre === "cesar"
              ? toutesLesEnigmes(kit).find((enigme) => enigme.type === "cesar")!.solution
              : exemple.genre === "deroule"
                ? "Le code et le trésor"
                : kit.depart.solution;
        expect(texteVisible(html)).toContain(texteVisible(attendu));
      });

      it("ne charge aucune ressource d'un autre domaine", () => {
        expect(ressourcesExternes(rendre(guide, "12,90 €"))).toEqual([]);
      });
    });
  }

  it("le guide des cachettes reprend exactement les consignes de sécurité des kits et du formulaire, sans en inventer", () => {
    const guide = GUIDES.find((candidat) => candidat.adresse === "cachettes-enigmes-selon-age")!;
    expect(guide.sections.some((section) => section.blocs.some((bloc) => bloc.type === "securite"))).toBe(true);
    const html = texteVisible(rendre(guide));
    for (const consigne of GUIDE.securite) expect(html).toContain(texteVisible(consigne));
    expect(html).toContain(texteVisible(FORMULAIRE.etapes.find((etape) => etape.cle === "cachettes")!.aide));
  });

  it("le test des ressources externes en attrape bien une", () => {
    expect(ressourcesExternes('<img src="https://exemple.fr/a.png"><script src="//cdn.exemple.fr/x.js"></script>')).toHaveLength(2);
    expect(ressourcesExternes('<img src="/icones/a.png"><link rel="canonical" href="https://www.missiongateau.com/"><a href="https://exemple.fr">x</a>')).toEqual([]);
  });
});
