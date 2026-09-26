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

const OFFRE = { prix: PRIX_AFFICHE, tva: VENDEUR.tva, mediateur: { nom: VENDEUR.mediateur.nom, site: VENDEUR.mediateur.site } };
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

  it("confirmation partie mais pas enregistrée : un message à part, qui ne dit pas qu'elle n'est pas partie", async () => {
    reseau({ "/confirmation": () => Response.json({ etat: "non_enregistree" }, { status: 503 }) });
    await rendre(<Confirmation reference={REFERENCE} sessionId={null} email={EMAIL} />);
    expect(texte()).toContain(
      "Votre confirmation de commande est partie, mais n'a pas pu être enregistrée : rechargez cette page dans quelques minutes.".replace(" :", "\u00a0:"),
    );
    expect(texte()).not.toContain("n'a pas pu vous être envoyée");
    expect(conteneur.querySelector('[role="alert"]')).not.toBeNull();
    expect(texte()).not.toContain("Télécharger mon jeu");
    reseau({ "/confirmation": () => Response.json({ etat: "confirmee" }) });
    await cliquer(bouton("Réessayer"));
    expect(navigation.rafraichissements).toBe(1);
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
  const VENDEUR_AFFICHE = { email: "service@exemple.fr", adresse: "1 rue du Test, 75000 Paris, France" };
  const REFERENCE = "AbCdEfGhIjKlMnOpQrStUv";
  const SESSION = "cs_test_a1b2c3d4e5";

  async function remplir(valeurs: { nom: string; prenom: string; reference: string; email: string }): Promise<void> {
    await saisir(champ<HTMLInputElement>("#nom"), valeurs.nom);
    await saisir(champ<HTMLInputElement>("#prenom"), valeurs.prenom);
    await saisir(champ<HTMLInputElement>("#reference"), valeurs.reference);
    await saisir(champ<HTMLInputElement>("#email"), valeurs.email);
  }

  const VALABLE = { nom: "Martin", prenom: "Camille", reference: REFERENCE, email: "camille@exemple.fr" };

  const ACCUSE = {
    issue: "accuse",
    accuse: {
      objet: "Accusé de réception de votre rétractation — Mission Gâteau",
      blocs: [
        { type: "titre", texte: "Votre déclaration" },
        { type: "lignes", lignes: [{ libelle: "Nom", valeur: "Martin" }] },
      ],
    },
    envoi: { etat: "envoye", adresse: "delivered@resend.dev", saisie: "camille@exemple.fr", remplacee: true },
  };

  function espaces(texteBrut: string): string {
    return texteBrut.replace(/[  ]/g, " ");
  }

  async function envoyerUneDeclaration(reponse: () => Response, props: { referenceInitiale?: string; sessionId?: string | null } = {}) {
    reseau({ "/api/renoncer": reponse });
    await rendre(
      <FormulaireRetractation referenceInitiale={props.referenceInitiale ?? ""} sessionId={props.sessionId ?? null} vendeur={VENDEUR_AFFICHE} />,
    );
    await remplir(VALABLE);
    await cliquer(bouton("Vérifier ma déclaration"));
    await cliquer(bouton("Confirmer la rétractation"));
  }

  it("refuse chaque entrée douteuse sous son champ, l'annonce, et met le focus sur le premier champ en erreur", async () => {
    await rendre(<FormulaireRetractation referenceInitiale="" sessionId={null} vendeur={VENDEUR_AFFICHE} />);
    await remplir({ nom: "Martin", prenom: "Cam1lle", reference: "A".repeat(21), email: "pas-une-adresse" });
    await cliquer(bouton("Vérifier ma déclaration"));
    const alertes = [...conteneur.querySelectorAll('[role="alert"]')].map((alerte) => alerte.id);
    expect(alertes).toEqual(["erreur-prenom", "erreur-reference", "erreur-email"]);
    expect(espaces(texte())).toContain("Indiquez votre prénom : des lettres, et au besoin des espaces, des apostrophes ou des traits d'union, 60 caractères au plus.");
    expect(espaces(texte())).toContain("Indiquez la référence de votre commande (22 caractères), ou collez le lien de sa page.");
    expect(champ<HTMLInputElement>("#prenom").getAttribute("aria-invalid")).toBe("true");
    expect(champ<HTMLInputElement>("#prenom").getAttribute("aria-describedby")).toBe("erreur-prenom");
    expect(champ<HTMLInputElement>("#reference").getAttribute("aria-describedby")).toBe("aide-reference erreur-reference");
    expect(document.activeElement).toBe(champ<HTMLInputElement>("#prenom"));
    expect(appels).toHaveLength(0);

    for (const [cle, douteux] of [
      ["nom", "Mar@tin"],
      ["nom", "Martin:"],
      ["nom", "Martin/Durand"],
      ["nom", "Mar‮tin"],
      ["nom", "Mar\u0007tin"],
      ["reference", "A".repeat(23)],
    ] as const) {
      await remplir({ ...VALABLE, [cle]: douteux });
      await cliquer(bouton("Vérifier ma déclaration"));
      expect(conteneur.querySelector(`#erreur-${cle}`), `${cle} : ${douteux}`).not.toBeNull();
      expect(document.activeElement).toBe(champ<HTMLInputElement>(`#${cle}`));
    }
    expect(appels).toHaveLength(0);
  });

  it("montre la déclaration normalisée et la référence extraite, met le focus sur chaque nouveau titre, puis l'envoie", async () => {
    reseau({ "/api/renoncer": () => Response.json(ACCUSE) });
    await rendre(<FormulaireRetractation referenceInitiale={REFERENCE} sessionId={SESSION} vendeur={VENDEUR_AFFICHE} />);
    expect(champ<HTMLInputElement>("#reference").value).toBe(REFERENCE);
    await remplir({ nom: " Martin ", prenom: "Hélène", reference: `https://www.missiongateau.com/commande/${REFERENCE}?session_id=${SESSION}`, email: " camille@exemple.fr " });
    await cliquer(bouton("Vérifier ma déclaration"));
    expect(texte()).toContain("Je renonce au contrat portant sur la commande indiquée ci-dessous.");
    expect(document.activeElement?.textContent).toBe("Votre déclaration");
    expect(document.activeElement?.tagName).toBe("H2");
    // Le récapitulatif ne montre que la référence extraite, jamais le lien saisi.
    expect(texte()).toContain(REFERENCE);
    expect(texte()).not.toContain("missiongateau.com");
    expect(texte()).toContain("Hélène");
    expect(appels).toHaveLength(0);
    const confirmer = bouton("Confirmer la rétractation");
    expect(confirmer.textContent).toBe("Confirmer la rétractation");
    await cliquer(confirmer);

    expect(appels).toEqual([
      {
        url: "/api/renoncer",
        corps: { nom: "Martin", prenom: "Hélène", reference: REFERENCE, email: "camille@exemple.fr", session_id: SESSION, champ_libre: "" },
      },
    ]);
    expect(texte()).toContain("Votre déclaration est reçue");
    expect(document.activeElement?.textContent).toBe("Votre déclaration est reçue");
    expect(texte()).toContain("Un accusé de réception vous a été envoyé par e-mail à delivered@resend.dev.");
    expect(texte()).toContain("Si l'adresse e-mail utilisée lors du paiement est différente, une copie y part aussi.");
    expect(texte()).toContain("l'accusé est parti à delivered@resend.dev au lieu de camille@exemple.fr");
    expect(texte()).toContain("Accusé de réception de votre rétractation — Mission Gâteau");

    // « Faire une autre déclaration » ramène au formulaire, focus sur son titre.
    await cliquer(bouton("Faire une autre déclaration"));
    expect(document.activeElement?.textContent).toBe("Vos coordonnées et votre commande");
  });

  it("ne transmet la session que pour la commande dont la page l'a donnée", async () => {
    reseau({ "/api/renoncer": () => Response.json(ACCUSE) });
    await rendre(<FormulaireRetractation referenceInitiale={REFERENCE} sessionId={SESSION} vendeur={VENDEUR_AFFICHE} />);
    await remplir({ ...VALABLE, reference: "ZyXwVuTsRqPoNmLkJiHgFe" });
    await cliquer(bouton("Vérifier ma déclaration"));
    await cliquer(bouton("Confirmer la rétractation"));
    expect(appels[0]!.corps.session_id).toBeUndefined();
    expect(appels[0]!.corps.reference).toBe("ZyXwVuTsRqPoNmLkJiHgFe");
  });

  it("si l'accusé n'a pas pu partir, le dit et propose de renvoyer exactement la même déclaration", async () => {
    let essais = 0;
    await envoyerUneDeclaration(() => {
      essais += 1;
      return Response.json(essais === 1 ? { ...ACCUSE, envoi: { etat: "echec" } } : ACCUSE);
    });
    expect(texte()).toContain("L'accusé de réception n'a pas pu partir pour le moment.");
    expect(texte()).not.toContain("Votre déclaration est reçue");
    expect(texte()).toContain(`écrivez-nous à ${VENDEUR_AFFICHE.email}`);
    await cliquer(bouton("Renvoyer l'accusé de réception"));
    expect(appels).toHaveLength(2);
    expect(appels[1]!.corps).toEqual(appels[0]!.corps);
    expect(texte()).toContain("Un accusé de réception vous a été envoyé par e-mail");
  });

  it("au-delà de trois accusés : affiche l'accusé et dit pourquoi il n'est pas renvoyé par e-mail", async () => {
    await envoyerUneDeclaration(() => Response.json({ ...ACCUSE, envoi: { etat: "plafond" } }));
    expect(espaces(texte())).toContain(
      `Cet accusé de réception s'affiche ici sans être renvoyé par e-mail : trois accusés sont déjà partis pour cette commande. Pour toute question, écrivez au vendeur à ${VENDEUR_AFFICHE.email}.`,
    );
    expect(texte()).not.toContain("vous a été envoyé par e-mail");
    expect(texte()).toContain("Accusé de réception de votre rétractation — Mission Gâteau");
  });

  it("aucune commande payée : rien n'est transmis, la page dit quoi faire et propose l'e-mail prérempli", async () => {
    const mailto = "mailto:service@exemple.fr?subject=R%C3%A9tractation&body=Je%20renonce";
    await envoyerUneDeclaration(() =>
      Response.json({ issue: "non_transmise", cause: "introuvable", date: "26 septembre 2026", heure: "10 h 30", mailto }, { status: 404 }),
    );
    expect(texte()).toContain("Votre déclaration n'a pas été transmise");
    expect(document.activeElement?.textContent).toBe("Votre déclaration n'a pas été transmise");
    expect(espaces(texte())).toContain(
      "Nous ne trouvons aucune commande payée sous cette référence : votre déclaration n'a pas été transmise et aucun accusé de réception ne partira.",
    );
    expect(espaces(texte())).toContain("le lien « Renoncer au contrat ici » de cet e-mail la remplit tout seul");
    expect(texte()).toContain("Si votre paiement vient d'avoir lieu, réessayez dans quelques minutes.");
    expect(texte()).toContain(`par e-mail à ${VENDEUR_AFFICHE.email} ou par courrier à ${VENDEUR_AFFICHE.adresse}`);
    const lien = [...conteneur.querySelectorAll("a")].find((a) => a.textContent === "Envoyer ma déclaration par e-mail")!;
    expect(lien.getAttribute("href")).toBe(mailto);
    expect(texte()).not.toContain("accusé de réception vous a été envoyé");
    // « Corriger ma déclaration » ramène au formulaire, avec ce qui a été saisi.
    await cliquer(bouton("Corriger ma déclaration"));
    expect(champ<HTMLInputElement>("#nom").value).toBe("Martin");
    expect(document.activeElement?.textContent).toBe("Vos coordonnées et votre commande");
  });

  it("Stripe injoignable : rien n'est transmis, et le bouton d'e-mail préserve le droit", async () => {
    const mailto = "mailto:service@exemple.fr?subject=R%C3%A9tractation&body=Je%20renonce";
    let essais = 0;
    await envoyerUneDeclaration(() => {
      essais += 1;
      return Response.json({ issue: "non_transmise", cause: "indisponible", date: "26 septembre 2026", heure: "10 h 30", mailto }, { status: 503 });
    });
    expect(espaces(texte())).toContain(
      "Nous ne pouvons pas vérifier votre commande pour le moment : votre déclaration n'a pas été transmise. Réessayez dans quelques minutes, ou envoyez-la dès maintenant par e-mail : une déclaration envoyée avant la fin du délai de rétractation préserve votre droit.",
    );
    expect([...conteneur.querySelectorAll("a")].find((a) => a.textContent === "Envoyer ma déclaration par e-mail")!.getAttribute("href")).toBe(mailto);
    expect(texte()).toContain("aucun e-mail ne part de notre site, et vous gardez la preuve de votre envoi");
    await cliquer(bouton("Réessayer"));
    expect(essais).toBe(2);
    expect(appels[1]!.corps).toEqual(appels[0]!.corps);
  });

  it("déclaration en cours de traitement : le dit, sans prétendre qu'un accusé est parti", async () => {
    await envoyerUneDeclaration(() => Response.json({ issue: "en_cours", message: "x" }, { status: 202 }));
    expect(espaces(texte())).toContain("Votre déclaration est en cours de traitement : rechargez la page dans quelques instants.");
    expect(texte()).not.toContain("vous a été envoyé");
  });

  it("déclaration déjà enregistrée et accusée : le rappelle", async () => {
    await envoyerUneDeclaration(() => Response.json({ issue: "deja_accusee", date: "24 septembre 2026", heure: "10 h 30" }));
    expect(texte()).toContain("Votre déclaration est déjà enregistrée");
    expect(espaces(texte())).toContain(
      "Votre déclaration du 24 septembre 2026 à 10 h 30 est déjà enregistrée, et son accusé de réception vous a été envoyé par e-mail.",
    );
  });

  it("dit quand la déclaration n'a pas pu partir", async () => {
    await envoyerUneDeclaration(() => Response.json({ erreur: "x" }, { status: 400 }));
    expect(texte()).toContain("Votre déclaration n'a pas pu être envoyée.");
    expect(texte()).toContain(VENDEUR_AFFICHE.email);
    reseau({ "/api/renoncer": () => Response.json({ erreur: "Cette adresse n'accepte que des données envoyées au format JSON." }, { status: 415 }) });
    await cliquer(bouton("Confirmer la rétractation"));
    expect(texte()).toContain("Vérifiez votre connexion et réessayez");
  });
});
