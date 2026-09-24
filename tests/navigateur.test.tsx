// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le formulaire et le bloc d'achat dans un vrai DOM : parcours jusqu'à
 * l'aperçu, bloc d'achat, départ chez Stripe, retour après annulation, pays
 * refusé, accords obligatoires, et oubli de la sauvegarde une fois payé.
 */
const navigation = vi.hoisted(() => ({ adresses: [] as string[] }));
vi.mock("@/composants/navigation", () => ({
  allerVers: (adresse: string) => {
    navigation.adresses.push(adresse);
  },
}));

import { Formulaire } from "@/composants/Formulaire";
import { OublierSauvegarde, Telechargement } from "@/composants/Telechargement";
import { VENDEUR } from "@/contenu/vendeur";
import { PRIX_AFFICHE } from "@/vente/prix";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OFFRE = { prix: PRIX_AFFICHE, tva: VENDEUR.tva };
const GRAINE = "k7m2p9q4rs";
const CLE_SAUVEGARDE = "mission-gateau:commande-en-cours";

interface Appel {
  url: string;
  corps: Record<string, unknown>;
}

let conteneur: HTMLDivElement;
let racine: Root;
let appels: Appel[];

/** Un faux réseau : l'aperçu renvoie un PDF et sa graine, la commande l'adresse de Stripe. */
function reseau(reponses: Partial<Record<string, () => Response>> = {}) {
  appels = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      appels.push({ url, corps: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
      const cle = Object.keys(reponses).find((motif) => url.includes(motif));
      if (cle) return reponses[cle]!();
      if (url === "/api/apercu") {
        return new Response("%PDF-1.7 aperçu", {
          headers: { "Content-Type": "application/pdf", "X-Graine": GRAINE },
        });
      }
      if (url === "/api/commande") return Response.json({ url: "https://checkout.stripe.com/c/pay/cs_test_faux" });
      return new Response("inconnu", { status: 404 });
    }),
  );
}

beforeEach(() => {
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
  sessionStorage.clear();
  navigation.adresses = [];
  URL.createObjectURL = vi.fn(() => "blob:faux");
  URL.revokeObjectURL = vi.fn();
  reseau();
});

afterEach(async () => {
  await act(async () => racine.unmount());
  conteneur.remove();
  vi.unstubAllGlobals();
});

async function rendre(element: ReactElement): Promise<void> {
  await act(async () => {
    racine.render(element);
  });
}

function texte(): string {
  return conteneur.textContent ?? "";
}

function bouton(libelle: string): HTMLButtonElement {
  const trouve = [...conteneur.querySelectorAll("button")].find((b) => b.textContent?.includes(libelle));
  if (!trouve) throw new Error(`bouton « ${libelle} » absent : ${texte().slice(0, 300)}`);
  return trouve;
}

async function cliquer(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
  });
}

function champ<T extends Element>(selecteur: string): T {
  const trouve = conteneur.querySelector<T>(selecteur);
  if (!trouve) throw new Error(`champ ${selecteur} absent`);
  return trouve;
}

/** Saisit une valeur comme le ferait le clavier : React ne voit que les vrais événements. */
async function saisir(element: HTMLInputElement | HTMLSelectElement, valeur: string): Promise<void> {
  const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, valeur);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

/** Remplit les sept étapes et demande l'aperçu. */
async function composerUnApercu(): Promise<void> {
  await cliquer(champ<HTMLInputElement>('input[name="theme"][value="pirates"]'));
  await cliquer(bouton("Continuer"));
  await cliquer(champ<HTMLInputElement>('input[name="age"][value="8"]'));
  await cliquer(bouton("Continuer"));
  await saisir(champ<HTMLInputElement>("#prenom"), "Zéphyrine");
  await cliquer(bouton("Continuer"));
  await cliquer(champ<HTMLInputElement>('input[name="nombreEnfants"][value="8"]'));
  await cliquer(bouton("Continuer"));
  await cliquer(champ<HTMLInputElement>('input[name="duree"][value="45"]'));
  await cliquer(bouton("Continuer"));
  await cliquer(bouton("Continuer"));
  await cliquer(bouton("Voir l'aperçu gratuit"));
}

/** Les deux cases d'accord du bloc d'achat, dans l'ordre. */
function casesAcocher(): HTMLInputElement[] {
  return [...conteneur.querySelectorAll<HTMLInputElement>('section[aria-labelledby="titre-achat"] input[type="checkbox"]')];
}

describe("de l'aperçu au paiement", () => {
  it("le bloc d'achat apparaît après l'aperçu et achète exactement sa configuration et sa graine", async () => {
    await rendre(<Formulaire vente={OFFRE} />);
    expect(texte()).not.toContain("Commander et payer");
    await composerUnApercu();

    expect(texte()).toContain("Votre aperçu est prêt");
    expect(texte()).toContain(GRAINE);
    expect(texte()).toContain(`Commander et payer ${PRIX_AFFICHE}`);
    const apercu = appels.find((appel) => appel.url === "/api/apercu")!;
    expect(apercu.corps.graine).toBeUndefined();

    // Sans les deux accords, rien ne part.
    await cliquer(bouton("Commander et payer"));
    expect(texte()).toContain("Merci d'accepter les conditions générales de vente.");
    expect(texte()).toContain("Merci de demander l'accès immédiat à votre jeu");
    expect(appels.filter((appel) => appel.url === "/api/commande")).toHaveLength(0);

    const [cgv, acces] = casesAcocher();
    expect(cgv!.checked).toBe(false);
    expect(acces!.checked).toBe(false);
    await cliquer(cgv!);
    await cliquer(bouton("Commander et payer"));
    expect(appels.filter((appel) => appel.url === "/api/commande")).toHaveLength(0);
    await cliquer(acces!);
    await cliquer(bouton("Commander et payer"));

    const commande = appels.find((appel) => appel.url === "/api/commande")!;
    expect(commande.corps).toEqual({
      configuration: apercu.corps.configuration,
      graine: GRAINE,
      pays: "FR",
      accordCgv: true,
      accordAccesImmediat: true,
    });
    expect(navigation.adresses).toEqual(["https://checkout.stripe.com/c/pay/cs_test_faux"]);

    // L'aller-retour chez Stripe est gardé dans l'onglet, et nulle part ailleurs.
    const garde = JSON.parse(sessionStorage.getItem(CLE_SAUVEGARDE)!) as Record<string, unknown>;
    expect(garde.graine).toBe(GRAINE);
    expect(garde.configuration).toEqual(apercu.corps.configuration);
    expect((garde.brouillon as { prenom: string }).prenom).toBe("Zéphyrine");
    expect(document.cookie).toBe("");
    expect(localStorage.length).toBe(0);
  });

  it("vente fermée : après l'aperçu, la vente « ouvre bientôt », sans prix ni bouton", async () => {
    await rendre(<Formulaire vente={null} />);
    await composerUnApercu();
    expect(texte()).toContain("Votre aperçu est prêt");
    expect(texte()).toContain("La vente du jeu complet ouvre bientôt.");
    expect(texte()).not.toMatch(/€|Commander et payer/);
  });

  it("un pays hors de la liste affiche le message et bloque l'achat", async () => {
    await rendre(<Formulaire vente={OFFRE} />);
    await composerUnApercu();
    const pays = champ<HTMLSelectElement>("#pays");
    expect(pays.value).toBe("FR");
    await saisir(pays, "AUTRE");
    expect(texte()).toContain("Nous ne pouvons pas encore vendre dans votre pays.");
    expect(bouton("Commander et payer").disabled).toBe(true);
    await saisir(pays, "CH");
    expect(texte()).not.toContain("Nous ne pouvons pas encore vendre dans votre pays.");
    expect(bouton("Commander et payer").disabled).toBe(false);
  });

  it("revenu de Stripe par « retour », le bouton de paiement se réactive", async () => {
    await rendre(<Formulaire vente={OFFRE} />);
    await composerUnApercu();
    for (const caseACocher of casesAcocher()) await cliquer(caseACocher);
    await cliquer(bouton("Commander et payer"));
    expect(navigation.adresses).toHaveLength(1);
    expect(bouton("Préparation du paiement").disabled).toBe(true);
    // Le navigateur restitue la page depuis son cache d'historique.
    await act(async () => {
      window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    });
    expect(bouton("Commander et payer").disabled).toBe(false);
  });

  it("affiche le refus du serveur sans quitter la page", async () => {
    reseau({
      "/api/commande": () => Response.json({ erreur: "La vente du jeu complet n'est pas encore ouverte." }, { status: 503 }),
    });
    await rendre(<Formulaire vente={OFFRE} />);
    await composerUnApercu();
    for (const caseACocher of casesAcocher()) await cliquer(caseACocher);
    await cliquer(bouton("Commander et payer"));
    expect(texte()).toContain("La vente du jeu complet n'est pas encore ouverte.");
    expect(navigation.adresses).toEqual([]);
    expect(sessionStorage.getItem(CLE_SAUVEGARDE)).toBeNull();
  });
});

describe("retour d'un paiement annulé", () => {
  async function partirChezStripe(): Promise<Record<string, unknown>> {
    await rendre(<Formulaire vente={OFFRE} />);
    await composerUnApercu();
    await saisir(champ<HTMLSelectElement>("#pays"), "BE");
    for (const caseACocher of casesAcocher()) await cliquer(caseACocher);
    await cliquer(bouton("Commander et payer"));
    const configuration = appels.find((appel) => appel.url === "/api/commande")!.corps.configuration;
    // Le parent annule chez Stripe : il revient sur /creer, dans le même onglet.
    await act(async () => racine.unmount());
    racine = createRoot(conteneur);
    appels = [];
    return configuration as Record<string, unknown>;
  }

  it("retrouve son jeu, son pays, et peut acheter sans rien ressaisir", async () => {
    const configuration = await partirChezStripe();
    await rendre(<Formulaire vente={OFFRE} />);

    expect(texte()).toContain("Votre aperçu est prêt");
    expect(texte()).toContain(GRAINE);
    expect(champ<HTMLSelectElement>("#pays").value).toBe("BE");
    // Les accords se redonnent à chaque commande : les cases repartent décochées.
    expect(casesAcocher().every((caseACocher) => !caseACocher.checked)).toBe(true);

    for (const caseACocher of casesAcocher()) await cliquer(caseACocher);
    await cliquer(bouton("Commander et payer"));
    expect(appels.find((appel) => appel.url === "/api/commande")!.corps).toEqual({
      configuration,
      graine: GRAINE,
      pays: "BE",
      accordCgv: true,
      accordAccesImmediat: true,
    });
  });

  it("recompose l'aperçu à l'identique, avec la même graine", async () => {
    const configuration = await partirChezStripe();
    await rendre(<Formulaire vente={OFFRE} />);
    await cliquer(bouton("Revoir l'aperçu"));
    expect(appels).toEqual([{ url: "/api/apercu", corps: { configuration, graine: GRAINE } }]);
    expect(texte()).toContain("Ouvrir l'aperçu");
  });

  it("« Composer un autre jeu » oublie la sauvegarde et garde les réponses", async () => {
    await partirChezStripe();
    await rendre(<Formulaire vente={OFFRE} />);
    await cliquer(bouton("Composer un autre jeu"));
    expect(sessionStorage.getItem(CLE_SAUVEGARDE)).toBeNull();
    expect(texte()).toContain("Étape 1 sur 7");
    expect(champ<HTMLInputElement>('input[name="theme"][value="pirates"]').checked).toBe(true);
  });

  it("une sauvegarde abîmée est ignorée", async () => {
    sessionStorage.setItem(CLE_SAUVEGARDE, '{"version":1,"graine":"PAS UNE GRAINE"}');
    await rendre(<Formulaire vente={OFFRE} />);
    expect(texte()).toContain("Étape 1 sur 7");
  });
});

describe("page d'une commande payée", () => {
  it("oublie ce que l'onglet gardait pour le paiement", async () => {
    sessionStorage.setItem(CLE_SAUVEGARDE, "{}");
    await rendre(<OublierSauvegarde />);
    expect(sessionStorage.getItem(CLE_SAUVEGARDE)).toBeNull();
  });

  it("le bouton demande le kit en POST, avec la session, et le propose au téléchargement", async () => {
    reseau({
      "/kit": () =>
        new Response("%PDF-1.7 kit", {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="mission-gateau-pirates-mission.pdf"',
          },
        }),
    });
    const telecharges: string[] = [];
    const clicOrigine = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      telecharges.push(this.download);
    };
    try {
      await rendre(<Telechargement reference="AbCdEfGhIjKlMnOpQrStUv" sessionId="cs_test_a1b2c3d4e5" />);
      await cliquer(bouton("Télécharger mon jeu (PDF)"));
    } finally {
      HTMLAnchorElement.prototype.click = clicOrigine;
    }
    expect(appels).toEqual([
      { url: "/api/commande/AbCdEfGhIjKlMnOpQrStUv/kit", corps: { session_id: "cs_test_a1b2c3d4e5" } },
    ]);
    expect(telecharges).toEqual(["mission-gateau-pirates-mission.pdf"]);
  });

  it("dit pourquoi le téléchargement est refusé", async () => {
    reseau({ "/kit": () => Response.json({ erreur: "Commande remboursée. Le jeu n'est plus disponible." }, { status: 410 }) });
    await rendre(<Telechargement reference="AbCdEfGhIjKlMnOpQrStUv" sessionId={null} />);
    await cliquer(bouton("Télécharger mon jeu (PDF)"));
    expect(texte()).toContain("Commande remboursée.");
  });
});
