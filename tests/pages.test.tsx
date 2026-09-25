import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * Les pages telles que le serveur les rend, vente fermée puis ouverte.
 * L'état de la vente est commandé par le test ; la condition elle-même est
 * éprouvée dans tests/ouverture.test.ts.
 */
const etat = vi.hoisted(() => ({ ouverte: false, deps: null as unknown, kits: 0, rendus: 0 }));

// Hors de Next, le routeur n'est pas monté : les composants qui l'emploient en reçoivent un faux.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/vente/ouverture", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/ouverture")>();
  return { ...original, venteOuverteMaintenant: () => etat.ouverte };
});
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (etat.deps as Dependances | null) ?? original.dependancesReelles() };
});
// Compteurs : la page de commande ne doit jamais composer ni rendre un kit.
vi.mock("@/engine/kit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/engine/kit")>();
  return {
    ...original,
    construireKit: (...args: Parameters<typeof original.construireKit>) => {
      etat.kits += 1;
      return original.construireKit(...args);
    },
  };
});
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const original = await importOriginal<typeof import("@react-pdf/renderer")>();
  return {
    ...original,
    renderToBuffer: (...args: Parameters<typeof original.renderToBuffer>) => {
      etat.rendus += 1;
      return original.renderToBuffer(...args);
    },
  };
});

import Accueil from "@/app/page";
import Cgv from "@/app/cgv/page";
import PageCommande from "@/app/commande/[ref]/page";
import Confidentialite from "@/app/confidentialite/page";
import Creer from "@/app/creer/page";
import Credits from "@/app/credits/page";
import MentionsLegales from "@/app/mentions-legales/page";
import Renoncer from "@/app/renoncer/page";
import { POST as commanderRoute } from "@/app/api/commande/route";
import { BlocAchat } from "@/composants/BlocAchat";
import { PiedDeSite } from "@/composants/Chrome";
import { VENDEUR } from "@/contenu/vendeur";
import { piedDeFacture } from "@/vente/session";
import { PRIX_AFFICHE } from "@/vente/prix";
import { CLES } from "@/vente/metadonnees";
import {
  CLE_REELLE,
  EMAIL_ACHETEUR,
  FauxStripe,
  configurationMarquee,
  corpsDeCommande,
  dependances,
  environnement,
  requeteJson,
} from "./fauxStripe";

const PAGES_FIXES: [string, () => React.ReactElement][] = [
  ["/", () => <Accueil />],
  ["/creer", () => <Creer />],
  ["/credits", () => <Credits />],
  ["/mentions-legales", () => <MentionsLegales />],
  ["/cgv", () => <Cgv />],
  ["/confidentialite", () => <Confidentialite />],
];

async function pageDeRetractation(ref?: string): Promise<string> {
  const element = await Renoncer({ searchParams: Promise.resolve(ref === undefined ? {} : { ref }) });
  return renderToStaticMarkup(element);
}

async function pageDeCommande(ref: string, sessionId?: string): Promise<string> {
  const element = await PageCommande({
    params: Promise.resolve({ ref }),
    searchParams: Promise.resolve(sessionId ? { session_id: sessionId } : {}),
  });
  return renderToStaticMarkup(element);
}

/** Tout le HTML du site, page de commande comprise. */
async function toutLeSite(): Promise<[string, string][]> {
  const pages: [string, string][] = PAGES_FIXES.map(([chemin, rendre]) => [chemin, renderToStaticMarkup(rendre())]);
  pages.push(["/commande/…", await pageDeCommande("AAAAAAAAAAAAAAAAAAAAAA")]);
  pages.push(["/renoncer", await pageDeRetractation()]);
  return pages;
}

/** Un prix, sous quelque forme que ce soit, ou le bouton d'achat. Les CGV peuvent nommer le bouton, pas l'afficher. */
const MARQUES_DE_PRIX = /€|12,90|1290|<button[^>]*>[^<]*Commander et payer/;
const MEDIATEUR = /Médiation Professionnelle|Alteritae|Salvaing|mediateur-consommation-smp/;

beforeEach(() => {
  etat.ouverte = false;
  etat.deps = dependances(new FauxStripe());
  etat.kits = 0;
  etat.rendus = 0;
});

afterEach(() => {
  etat.deps = null;
});

describe("vente fermée", () => {
  it("aucune page n'affiche de prix ni de bouton d'achat", async () => {
    for (const [chemin, html] of await toutLeSite()) {
      expect(html, chemin).not.toMatch(MARQUES_DE_PRIX);
    }
  });

  it("le pied de page dit toujours « site en préparation »", async () => {
    for (const [chemin, html] of await toutLeSite()) {
      expect(html, chemin).toContain("Mission Gâteau — site en préparation");
    }
  });
});

describe("vente ouverte", () => {
  beforeEach(() => {
    etat.ouverte = true;
  });

  it("l'accueil affiche 12,90 € et la mention de TVA", () => {
    const html = renderToStaticMarkup(<Accueil />);
    expect(html).toContain(PRIX_AFFICHE);
    expect(PRIX_AFFICHE).toBe("12,90\u00a0€");
    expect(html).toContain("TVA non applicable, article 293 B du CGI");
  });

  it("le pied de page nomme l'éditeur et ne dit plus « site en préparation »", async () => {
    for (const [chemin, html] of await toutLeSite()) {
      expect(html, chemin).not.toContain("site en préparation");
      expect(html, chemin).toContain("Mission Gâteau — édité par Quentin Courtois EI");
    }
  });

  it("les CGV donnent le prix", () => {
    expect(renderToStaticMarkup(<Cgv />)).toContain(`Le jeu complet coûte ${PRIX_AFFICHE}`);
  });

  it("le bloc d'achat présente le kit, le format, le prix, la livraison, le pays et les deux accords", () => {
    const html = renderToStaticMarkup(
      <BlocAchat
        configuration={configurationMarquee()}
        graine="k7m2p9q4rs"
        brouillon={{}}
        paysInitial={null}
        offre={{ prix: PRIX_AFFICHE, tva: VENDEUR.tva }}
      />,
    );
    for (const attendu of [
      "Le guide de l&#x27;organisateur",
      "Un PDF A4 à imprimer, lisible en noir et blanc\u00a0: un lecteur PDF et une imprimante suffisent.",
      `${PRIX_AFFICHE}</span> — TVA non applicable, article 293 B du CGI`,
      "E-mail de confirmation, puis téléchargement immédiat sur la page de votre commande\u00a0; lien valable 30 jours.",
      "Droit de rétractation\u00a0: 14 jours après le paiement, jusqu&#x27;au début du premier téléchargement. Pour l&#x27;exercer\u00a0: «\u00a0Renoncer au contrat ici\u00a0», en bas de chaque page. Détails\u00a0: article 8 des conditions générales de vente\u00a0; formulaire type\u00a0: en annexe de ces conditions.",
      "Pays de résidence",
      "J&#x27;ai lu et j&#x27;accepte les ",
      ">conditions générales de vente<",
      "Je demande à recevoir mon jeu dès le paiement, avant la fin du délai de rétractation de 14 jours, et je reconnais que je perdrai mon droit de rétractation dès le début de son premier téléchargement (article L221-28, 13° du Code de la consommation).",
      `Commander et payer ${PRIX_AFFICHE}`,
      'href="/cgv"',
      'href="/mentions-legales"',
      'href="/confidentialite"',
    ]) {
      expect(html, attendu).toContain(attendu);
    }
    // Deux cases distinctes, non cochées au départ ; la France par défaut.
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).not.toMatch(/checked/);
    expect(html).toMatch(/<option value="FR" selected="">France<\/option>/);
    expect(html.match(/<option /g)).toHaveLength(31);
    expect(html).toContain(">Un autre pays<");
  });
});

describe("pages légales et pied de page", () => {
  it("chaque page porte, dans son pied, les liens vers les trois pages légales, « Renoncer au contrat ici » et les crédits", async () => {
    for (const ouverte of [false, true]) {
      etat.ouverte = ouverte;
      for (const [chemin, html] of await toutLeSite()) {
        const pied = /<footer[\s\S]*<\/footer>/.exec(html)?.[0] ?? "";
        for (const lien of ["/mentions-legales", "/cgv", "/confidentialite", "/renoncer", "/credits"]) {
          expect(pied, `${chemin} → ${lien}`).toContain(`href="${lien}"`);
        }
        // Libellé exact, et aussi visible que les autres liens légaux : même balise, même classe.
        const liens = [...pied.matchAll(/<a class="([^"]*)" href="([^"]*)">([^<]*)<\/a>/g)];
        const renoncer = liens.find((lien) => lien[2] === "/renoncer");
        expect(renoncer?.[3], chemin).toBe("Renoncer au contrat ici");
        const cgv = liens.find((lien) => lien[2] === "/cgv");
        expect(renoncer?.[1], chemin).toBe(cgv?.[1]);
      }
    }
  });

  it("tant que la convention n'est pas signée, le médiateur n'est nommé nulle part", async () => {
    for (const ouverte of [false, true]) {
      etat.ouverte = ouverte;
      for (const [chemin, html] of await toutLeSite()) expect(html, chemin).not.toMatch(MEDIATEUR);
    }
    expect(piedDeFacture(VENDEUR)).not.toMatch(MEDIATEUR);
    expect(renderToStaticMarkup(<PiedDeSite venteOuverte />)).not.toMatch(MEDIATEUR);
  });
});

describe("page d'une commande", () => {
  const MAINTENANT = new Date("2026-09-24T12:00:00.000Z");

  /** Une commande payée la veille, et sa confirmation enregistrée ou non. */
  async function commandePayee(options: { confirmee?: boolean; env?: ReturnType<typeof environnement>; payeLe?: Date } = {}) {
    const stripe = new FauxStripe();
    etat.deps = dependances(stripe, { env: options.env ?? environnement(), maintenant: () => MAINTENANT });
    await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()));
    const reglee = stripe.payer({ payeLe: options.payeLe ?? new Date("2026-09-23T12:00:00.000Z") });
    if (options.confirmee !== false) {
      stripe.paiements.get(reglee.paiement.id)!.metadonnees[CLES.confirmation] = "2026-09-23T12:00:05.000Z";
    }
    etat.kits = 0;
    etat.rendus = 0;
    return { stripe, ...reglee };
  }

  it("payée mais pas encore confirmée : envoie la confirmation à son chargement, sans aucun bouton de téléchargement", async () => {
    const { reference, sessionId } = await commandePayee({ confirmee: false });
    const html = await pageDeCommande(reference, sessionId);
    expect(html).toContain("Merci pour votre commande");
    expect(html).toContain("Envoi de votre confirmation de commande…");
    expect(html).not.toContain("Télécharger mon jeu");
    expect(html).not.toContain("Votre jeu est prêt");
    expect(etat.kits).toBe(0);
    expect(etat.rendus).toBe(0);
  });

  it("confirmée, avant le premier téléchargement : l'adresse masquée, la fin du droit au premier téléchargement, le lien pour renoncer, puis le bouton", async () => {
    const { reference, sessionId } = await commandePayee({
      env: environnement({ vercelEnv: "production", cleStripe: CLE_REELLE }),
    });
    const html = (await pageDeCommande(reference, sessionId)).replace(/\u00a0/g, " ");
    expect(html).toContain("Votre jeu est prêt");
    const confirmation = html.indexOf("Votre confirmation de commande vous a été envoyée par e-mail à p•••@exemple.fr.");
    const droit = html.indexOf(
      "Le téléchargement commence l&#x27;exécution de votre commande : comme vous l&#x27;avez demandé, votre droit de rétractation prend fin au début du premier téléchargement. D&#x27;ici là, vous pouvez renoncer au contrat :",
    );
    const lien = html.indexOf(`href="/renoncer?ref=${reference}">Renoncer au contrat ici</a>`);
    const bouton = html.indexOf("Télécharger mon jeu (PDF)");
    expect(confirmation).toBeGreaterThan(-1);
    expect(droit).toBeGreaterThan(confirmation);
    expect(lien).toBeGreaterThan(droit);
    expect(bouton).toBeGreaterThan(lien);
    expect(html).toContain("jusqu&#x27;au 23 octobre 2026");
    expect(html).toContain("Le lien de cette page figure dans votre e-mail de confirmation.");
    expect(html).toContain(VENDEUR.email);
    // Plus aucune mention de l'e-mail de Stripe comme confirmation ; aucune adresse en clair ; aucun kit produit.
    expect(html).not.toMatch(/envoyé par Stripe/);
    expect(html).not.toContain(EMAIL_ACHETEUR);
    expect(html).not.toContain("Exemplaire d&#x27;essai");
    expect(etat.kits).toBe(0);
    expect(etat.rendus).toBe(0);
    // La configuration déchiffrée ne quitte pas le serveur : aucun prénom dans la page.
    expect(html).not.toContain("Zéphyrine");
    expect(html).not.toContain("Mésanges");
  });

  it("hors production, dit que la confirmation est partie à l'adresse de test de Resend", async () => {
    const { reference, sessionId } = await commandePayee();
    const html = (await pageDeCommande(reference, sessionId)).replace(/\u00a0/g, " ");
    expect(html).toContain("Votre confirmation de commande vous a été envoyée par e-mail à d•••@resend.dev.");
    expect(html).toContain(
      "Exemplaire d&#x27;essai : hors production, les e-mails ne partent qu&#x27;aux adresses de test de notre prestataire d&#x27;envoi ; celui-ci est parti à delivered@resend.dev au lieu de p•••@exemple.fr.",
    );
  });

  it("depuis le lien de l'e-mail, sans session, retrouve l'adresse de l'acheteur par le paiement", async () => {
    const { reference, stripe } = await commandePayee({ env: environnement({ vercelEnv: "production", cleStripe: CLE_REELLE }) });
    const html = await pageDeCommande(reference);
    expect(html).toContain("p•••@exemple.fr");
    expect(stripe.sessionsCherchees.length).toBeGreaterThan(0);
  });

  it("délai expiré sans téléchargement : la date de fin du délai, sans le lien pour renoncer", async () => {
    // Payée le jeudi 3 septembre 2026 : dernier jour du délai, le jeudi 17 septembre.
    const { reference } = await commandePayee({ payeLe: new Date("2026-09-03T10:00:00.000Z") });
    const html = (await pageDeCommande(reference)).replace(/\u00a0/g, " ");
    expect(html).toContain("Votre délai de rétractation a pris fin le 17 septembre 2026.");
    expect(html).not.toContain("/renoncer?ref=");
    expect(html).toContain("Télécharger mon jeu (PDF)");
  });

  it("après le premier téléchargement : la date et l'heure où le droit de rétractation a pris fin", async () => {
    const { reference, paiement, stripe } = await commandePayee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = "2026-09-23T16:05:00.000Z";
    const html = (await pageDeCommande(reference)).replace(/\u00a0/g, " ");
    expect(html).toContain(
      "Premier téléchargement le 23 septembre 2026 à 18 h 05 : votre droit de rétractation a pris fin à ce moment.",
    );
    expect(html).not.toContain("/renoncer?ref=");
    expect(html).toContain("Télécharger mon jeu (PDF)");
  });

  it("rétractée : la date de la rétractation et l'état du remboursement lu chez Stripe, sans bouton", async () => {
    const { reference, paiement, stripe } = await commandePayee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.retractation] = "2026-09-24T08:30:00.000Z";
    let html = (await pageDeCommande(reference)).replace(/\u00a0/g, " ");
    expect(html).toContain("Commande rétractée");
    expect(html).toContain("Votre rétractation a été enregistrée le 24 septembre 2026 à 10 h 30.");
    expect(html).toContain("Remboursement : pas encore effectué");
    expect(html).not.toContain("Télécharger mon jeu");
    stripe.rembourserHorsSite(paiement.id);
    html = (await pageDeCommande(reference)).replace(/\u00a0/g, " ");
    expect(html).toContain("Remboursement : 12,90 € remboursés par Stripe sur la carte utilisée pour le paiement.");
  });

  it("litige : aucune livraison, et une invitation à écrire au service client", async () => {
    const { reference, paiement, stripe } = await commandePayee();
    stripe.contester(paiement.id);
    const html = await pageDeCommande(reference);
    expect(html).toContain("Paiement contesté");
    expect(html).toContain("contestation auprès de votre banque");
    expect(html).toContain(VENDEUR.email);
    expect(html).not.toContain("Télécharger mon jeu");
  });

  it("dit « commande introuvable » pour une référence inventée, et renvoie à l'e-mail de confirmation", async () => {
    for (const ref of ["AAAAAAAAAAAAAAAAAAAAAA", "une-reference-inventee"]) {
      const html = await pageDeCommande(ref);
      expect(html).toContain("Commande introuvable");
      expect(html).toContain("Vérifiez le lien reçu dans l&#x27;e-mail de confirmation de votre commande.");
      expect(html).not.toContain("Télécharger mon jeu");
    }
  });

  it("dit « commande introuvable » sans clé, et « momentanément impossible » quand Stripe ne répond pas", async () => {
    etat.deps = dependances(null);
    expect(await pageDeCommande("AAAAAAAAAAAAAAAAAAAAAA")).toContain("Commande introuvable");
    const stripe = new FauxStripe();
    stripe.enPanne = true;
    etat.deps = dependances(stripe);
    expect(await pageDeCommande("AAAAAAAAAAAAAAAAAAAAAA")).toContain("Vérification momentanément impossible");
  });

  it("ne recopie pas une référence mal formée", async () => {
    const html = await pageDeCommande("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("Référence de la commande");
  });
});

describe("page de rétractation", () => {
  it("dit en deux phrases ce qu'est le droit, puis présente le formulaire et son premier bouton", async () => {
    const html = (await pageDeRetractation()).replace(/\u00a0/g, " ");
    expect(html).toContain("<h1");
    expect(html).toContain("Renoncer au contrat</h1>");
    expect(html).toContain(
      "Vous pouvez renoncer à votre commande pendant 14 jours après le paiement, jusqu&#x27;au début du premier téléchargement de votre jeu, sans avoir à vous justifier.",
    );
    expect(html).toContain(
      "Nous vous remboursons alors la totalité du prix, sur la carte utilisée pour le paiement, sous 14 jours au plus.",
    );
    for (const champ of ['id="nom"', 'id="prenom"', 'id="reference"', 'id="email"', 'id="champ_libre"']) {
      expect(html, champ).toContain(champ);
    }
    expect(html).toContain("Vérifier ma déclaration");
    // Le piège est hors de l'écran, hors du clavier et des lecteurs d'écran.
    expect(html).toMatch(/<div aria-hidden="true" class="absolute -left-\[10000px\][^"]*">[\s\S]*?tabindex="-1"/i);
  });

  it("préremplit une référence valable passée par ?ref=, et rien d'autre", async () => {
    expect(await pageDeRetractation("AbCdEfGhIjKlMnOpQrStUv")).toContain('value="AbCdEfGhIjKlMnOpQrStUv"');
    const douteuse = await pageDeRetractation("<b>x</b>");
    expect(douteuse).not.toContain("<b>x</b>");
    expect(douteuse).toMatch(/id="reference"[^>]*value=""/);
  });

  it("reste accessible sans clé ni vente ouverte, sans prix ni médiateur", async () => {
    etat.deps = dependances(null, { env: environnement({ cleStripe: undefined, cleResend: undefined }) });
    const html = await pageDeRetractation();
    expect(html).toContain("Renoncer au contrat");
    expect(html).not.toMatch(MARQUES_DE_PRIX);
    expect(html).not.toMatch(MEDIATEUR);
  });
});
