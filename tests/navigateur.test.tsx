// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le formulaire et le bloc d'achat dans un vrai DOM : parcours jusqu'à
 * l'aperçu, bloc d'achat, départ chez Stripe, retour après annulation, pays
 * refusé, accords obligatoires, et oubli de la sauvegarde une fois payé. Puis
 * la page d'une commande (envoi de la confirmation, téléchargement) et le
 * formulaire de rétractation.
 */
const navigation = vi.hoisted(() => ({ adresses: [] as string[], rafraichissements: 0 }));
vi.mock("@/composants/navigation", () => ({
  allerVers: (adresse: string) => {
    navigation.adresses.push(adresse);
  },
}));
// Comme celui de Next, le faux routeur est le même objet d'un rendu à l'autre.
const routeur = vi.hoisted(() => ({
  refresh: () => {
    navigation.rafraichissements += 1;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => routeur }));

import { Confirmation } from "@/composants/Confirmation";
import { Formulaire } from "@/composants/Formulaire";
import { FormulaireRetractation } from "@/composants/FormulaireRetractation";
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
  navigation.rafraichissements = 0;
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
    expect(texte()).toContain("Merci de cocher la seconde case");
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
    // La page se met à jour : elle dira désormais quand a eu lieu le premier téléchargement.
    expect(navigation.rafraichissements).toBe(1);
  });

  it("dit pourquoi le téléchargement est refusé", async () => {
    reseau({ "/kit": () => Response.json({ erreur: "Commande remboursée. Le jeu n'est plus disponible." }, { status: 410 }) });
    await rendre(<Telechargement reference="AbCdEfGhIjKlMnOpQrStUv" sessionId={null} />);
    await cliquer(bouton("Télécharger mon jeu (PDF)"));
    expect(texte()).toContain("Commande remboursée.");
    expect(navigation.rafraichissements).toBe(0);
  });
});

describe("page d'une commande payée, avant sa confirmation", () => {
  const REFERENCE = "AbCdEfGhIjKlMnOpQrStUv";
  const EMAIL = "service@exemple.fr";

  it("envoie la confirmation à son chargement, en POST avec la session, puis recharge la page", async () => {
    reseau({ "/confirmation": () => Response.json({ etat: "confirmee" }) });
    await rendre(<Confirmation reference={REFERENCE} sessionId="cs_test_a1b2c3d4e5" email={EMAIL} />);
    expect(appels).toEqual([
      { url: `/api/commande/${REFERENCE}/confirmation`, corps: { session_id: "cs_test_a1b2c3d4e5" } },
    ]);
    expect(navigation.rafraichissements).toBe(1);
    expect(conteneur.querySelectorAll("button")).toHaveLength(0);
  });

  it("si l'envoi échoue, le dit, propose de réessayer ou d'écrire, et n'affiche aucun bouton de téléchargement", async () => {
    reseau({ "/confirmation": () => Response.json({ etat: "echec" }, { status: 503 }) });
    await rendre(<Confirmation reference={REFERENCE} sessionId={null} email={EMAIL} />);
    expect(texte()).toContain("Votre confirmation de commande n'a pas pu vous être envoyée par e-mail pour le moment");
    expect(texte()).toContain(`écrivez-nous à ${EMAIL}`);
    expect(texte()).not.toContain("Télécharger mon jeu");
    expect(navigation.rafraichissements).toBe(0);
    reseau({ "/confirmation": () => Response.json({ etat: "confirmee" }) });
    await cliquer(bouton("Réessayer"));
    expect(navigation.rafraichissements).toBe(1);
  });

  it("confirmation en cours : patiente, puis réessaie", async () => {
    vi.useFakeTimers();
    try {
      let essais = 0;
      reseau({
        "/confirmation": () => {
          essais += 1;
          return essais === 1 ? Response.json({ etat: "en_cours" }, { status: 202 }) : Response.json({ etat: "confirmee" });
        },
      });
      await rendre(<Confirmation reference={REFERENCE} sessionId={null} email={EMAIL} />);
      expect(texte()).toContain("Votre confirmation de commande est en cours d'envoi.");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(essais).toBe(2);
      expect(navigation.rafraichissements).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("confirmation impossible : invite à écrire au service client", async () => {
    reseau({ "/confirmation": () => Response.json({ etat: "impossible" }, { status: 500 }) });
    await rendre(<Confirmation reference={REFERENCE} sessionId={null} email={EMAIL} />);
    expect(texte()).toContain("Votre confirmation de commande ne peut pas être préparée.");
    expect(texte()).toContain(EMAIL);
    expect(conteneur.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("formulaire de rétractation", () => {
  const EMAIL = "service@exemple.fr";

  async function remplir(valeurs: { nom: string; prenom: string; reference: string; email: string }): Promise<void> {
    await saisir(champ<HTMLInputElement>("#nom"), valeurs.nom);
    await saisir(champ<HTMLInputElement>("#prenom"), valeurs.prenom);
    await saisir(champ<HTMLInputElement>("#reference"), valeurs.reference);
    await saisir(champ<HTMLInputElement>("#email"), valeurs.email);
  }

  const ACCUSE = {
    issue: "accuse",
    accuse: {
      objet: "Accusé de réception de votre rétractation — Mission Gâteau",
      blocs: [
        { type: "titre", texte: "Votre déclaration" },
        { type: "lignes", lignes: [{ libelle: "Nom", valeur: "Martin" }] },
      ],
    },
    envoi: { etat: "envoye", adresse: "delivered@resend.dev", saisie: "camille@exemple.fr", remplacee: true, copieAcheteur: true },
  };

  it("vérifie chaque champ, affiche le récapitulatif, puis envoie la déclaration par « Confirmer la rétractation »", async () => {
    reseau({ "/api/renoncer": () => Response.json(ACCUSE) });
    await rendre(<FormulaireRetractation referenceInitiale="AbCdEfGhIjKlMnOpQrStUv" email={EMAIL} />);
    expect(champ<HTMLInputElement>("#reference").value).toBe("AbCdEfGhIjKlMnOpQrStUv");

    // Rien ne part tant qu'un champ manque.
    await saisir(champ<HTMLInputElement>("#reference"), "");
    await cliquer(bouton("Vérifier ma déclaration"));
    for (const erreur of [
      "Indiquez votre nom.",
      "Indiquez votre prénom.",
      "Indiquez la référence de votre commande, ou collez son lien.",
      "Indiquez une adresse e-mail valable",
    ]) {
      expect(texte()).toContain(erreur);
    }
    expect(appels).toHaveLength(0);

    await remplir({ nom: "Martin", prenom: "Camille", reference: "https://site/commande/AbCdEfGhIjKlMnOpQrStUv", email: "camille@exemple.fr" });
    await cliquer(bouton("Vérifier ma déclaration"));
    expect(texte()).toContain("Je renonce au contrat portant sur la commande indiquée ci-dessous.");
    expect(appels).toHaveLength(0);
    const confirmer = bouton("Confirmer la rétractation");
    expect(confirmer.textContent).toBe("Confirmer la rétractation");
    await cliquer(confirmer);

    expect(appels).toEqual([
      {
        url: "/api/renoncer",
        corps: {
          nom: "Martin",
          prenom: "Camille",
          reference: "https://site/commande/AbCdEfGhIjKlMnOpQrStUv",
          email: "camille@exemple.fr",
          champ_libre: "",
        },
      },
    ]);
    expect(texte()).toContain("Votre déclaration est reçue");
    expect(texte()).toContain("Un accusé de réception vous a été envoyé par e-mail à delivered@resend.dev.");
    expect(texte()).toContain("Une copie est aussi partie à l'adresse e-mail donnée lors du paiement.");
    expect(texte()).toContain("l'accusé est parti à delivered@resend.dev au lieu de camille@exemple.fr");
    // Le contenu de l'accusé de réception, tel qu'il est parti.
    expect(texte()).toContain("Accusé de réception de votre rétractation — Mission Gâteau");
    expect(texte()).toContain("Votre déclaration");
  });

  it("si l'accusé n'a pas pu partir, propose de le renvoyer", async () => {
    let essais = 0;
    reseau({
      "/api/renoncer": () => {
        essais += 1;
        return Response.json(essais === 1 ? { ...ACCUSE, envoi: { etat: "echec" } } : ACCUSE);
      },
    });
    await rendre(<FormulaireRetractation referenceInitiale="" email={EMAIL} />);
    await remplir({ nom: "Martin", prenom: "Camille", reference: "AbCdEfGhIjKlMnOpQrStUv", email: "camille@exemple.fr" });
    await cliquer(bouton("Vérifier ma déclaration"));
    await cliquer(bouton("Confirmer la rétractation"));
    expect(texte()).toContain("L'accusé de réception n'a pas pu partir pour le moment.");
    expect(texte()).toContain(`écrivez-nous à ${EMAIL}`);
    await cliquer(bouton("Renvoyer l'accusé de réception"));
    expect(appels).toHaveLength(2);
    expect(appels[1]!.corps).toEqual(appels[0]!.corps);
    expect(texte()).toContain("Un accusé de réception vous a été envoyé par e-mail");
  });

  it("rappelle une rétractation déjà enregistrée, sans nouvel e-mail", async () => {
    reseau({
      "/api/renoncer": () =>
        Response.json({ issue: "deja_enregistree", date: "24 septembre 2026", heure: "10\u00a0h\u00a030", remboursement: "effectue" }),
    });
    await rendre(<FormulaireRetractation referenceInitiale="AbCdEfGhIjKlMnOpQrStUv" email={EMAIL} />);
    await remplir({ nom: "Martin", prenom: "Camille", reference: "AbCdEfGhIjKlMnOpQrStUv", email: "camille@exemple.fr" });
    await cliquer(bouton("Vérifier ma déclaration"));
    await cliquer(bouton("Confirmer la rétractation"));
    expect(texte()).toContain("Votre rétractation est déjà enregistrée");
    expect(texte().replace(/\u00a0/g, " ")).toContain("enregistrée le 24 septembre 2026 à 10 h 30");
    expect(texte()).toContain("Remboursement : effectué par Stripe".replace(" :", "\u00a0:"));
  });

  it("dit quand la déclaration n'a pas pu partir", async () => {
    reseau({ "/api/renoncer": () => Response.json({ erreur: "x" }, { status: 400 }) });
    await rendre(<FormulaireRetractation referenceInitiale="" email={EMAIL} />);
    await remplir({ nom: "Martin", prenom: "Camille", reference: "AbCdEfGhIjKlMnOpQrStUv", email: "camille@exemple.fr" });
    await cliquer(bouton("Vérifier ma déclaration"));
    await cliquer(bouton("Confirmer la rétractation"));
    expect(texte()).toContain("Votre déclaration n'a pas pu être envoyée.");
    expect(texte()).toContain(EMAIL);
  });
});
