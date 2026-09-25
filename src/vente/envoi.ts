import { Resend } from "resend";
import type { FicheVendeur } from "../contenu/vendeur";
import { enProduction, type Environnement } from "./environnement";

/**
 * L'envoi des e-mails passe par cette petite interface, comme Stripe passe
 * par la sienne : en production, le SDK officiel de Resend (creerClientEmail,
 * plus bas) ; dans les tests, un faux client qui enregistre chaque envoi.
 */

export interface PieceJointe {
  nom: string;
  contenu: Buffer;
  type: string;
}

export interface MessageEmail {
  de: string;
  a: string[];
  copieCachee: string[];
  repondreA: string;
  objet: string;
  texte: string;
  html: string;
  piecesJointes: PieceJointe[];
}

/**
 * Ce que l'envoi a donné.
 * - `en_cours` : une requête de même clé d'idempotence est encore en cours
 *   chez Resend (409 concurrent_idempotent_requests) ;
 * - `requete_differente` : la même clé a déjà servi, dans les dernières 24
 *   heures, pour une requête différente (409 invalid_idempotent_request) ;
 * - `refus` : Resend refuse l'envoi (domaine de l'expéditeur non vérifié,
 *   adresse invalide, clé refusée…) ;
 * - `panne` : Resend ne répond pas, est surchargé, ou le quota est atteint.
 */
export type ResultatEnvoi =
  | { ok: true; id: string }
  | { ok: false; raison: "en_cours" | "requete_differente" | "refus" | "panne"; code: string };

export interface ClientEmail {
  envoyer(message: MessageEmail, cleIdempotence: string): Promise<ResultatEnvoi>;
}

/** Le code d'une erreur de Resend, jamais son message, qui pourrait citer une adresse. */
function codeSur(valeur: unknown): string {
  return typeof valeur === "string" && /^[a-z_]{1,60}$/.test(valeur) ? valeur : "inconnu";
}

const PANNES = new Set(["rate_limit_exceeded", "daily_quota_exceeded", "monthly_quota_exceeded", "internal_server_error", "application_error"]);

/** Le client réel. Null sans RESEND_API_KEY : aucune confirmation ne peut partir, donc rien n'est livré. */
export function creerClientEmail(env: Environnement): ClientEmail | null {
  if (!env.cleResend) return null;
  const resend = new Resend(env.cleResend);
  return {
    async envoyer(message, cleIdempotence) {
      try {
        const { data, error } = await resend.emails.send(
          {
            from: message.de,
            to: message.a,
            bcc: message.copieCachee,
            replyTo: message.repondreA,
            subject: message.objet,
            text: message.texte,
            html: message.html,
            // En base64 : le SDK passe la pièce jointe telle quelle à JSON.stringify.
            attachments: message.piecesJointes.map((piece) => ({
              filename: piece.nom,
              content: piece.contenu.toString("base64"),
              contentType: piece.type,
            })),
          },
          { idempotencyKey: cleIdempotence },
        );
        if (data?.id) return { ok: true, id: data.id };
        const code = codeSur(error?.name);
        if (code === "concurrent_idempotent_requests") return { ok: false, raison: "en_cours", code };
        if (code === "invalid_idempotent_request") return { ok: false, raison: "requete_differente", code };
        const statut = error?.statusCode ?? null;
        if (statut === null || statut >= 500 || PANNES.has(code)) return { ok: false, raison: "panne", code };
        return { ok: false, raison: "refus", code };
      } catch {
        return { ok: false, raison: "panne", code: "exception" };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Les adresses
// ---------------------------------------------------------------------------

/** L'adresse de test de Resend qui reçoit, hors production, ce qui n'a pas le droit de partir. */
export const ADRESSE_DE_TEST = "delivered@resend.dev";

function normaliser(adresse: string): string {
  return adresse.trim().toLowerCase();
}

/**
 * Hors production, les e-mails ne partent qu'aux adresses de test de Resend
 * (…@resend.dev) et à l'e-mail du vendeur ; toute autre adresse est remplacée
 * par delivered@resend.dev. En production, toutes les adresses partent.
 */
export function adresseDEnvoi(
  adresse: string,
  env: Environnement,
  fiche: FicheVendeur,
): { adresse: string; remplacee: boolean } {
  const propre = adresse.trim();
  if (enProduction(env)) return { adresse: propre, remplacee: false };
  const forme = normaliser(propre);
  if (/@resend\.dev$/.test(forme) || forme === normaliser(fiche.email)) return { adresse: propre, remplacee: false };
  return { adresse: ADRESSE_DE_TEST, remplacee: true };
}

/** Une liste d'adresses sans doublon, dans l'ordre, la casse ignorée. */
export function sansDoublon(adresses: string[]): string[] {
  const vues = new Set<string>();
  return adresses.filter((adresse) => {
    const forme = normaliser(adresse);
    if (vues.has(forme)) return false;
    vues.add(forme);
    return true;
  });
}

/** « q•••@gmail.com » : assez pour reconnaître son adresse, pas assez pour la lire. */
export function adresseMasquee(adresse: string): string {
  const propre = adresse.trim();
  const arobase = propre.lastIndexOf("@");
  if (arobase < 1) return "•••";
  return `${propre[0]}•••${propre.slice(arobase)}`;
}
