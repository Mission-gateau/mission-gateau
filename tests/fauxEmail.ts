import { createHash } from "node:crypto";
import type { ClientEmail, MessageEmail, ResultatEnvoi } from "@/vente/envoi";

/**
 * Le faux Resend des tests. Il enregistre chaque envoi tel que le site le
 * demande, et suit les règles d'idempotence de Resend :
 * - une même clé et une même requête rendent le même identifiant, sans
 *   second e-mail ;
 * - une même clé et une requête différente : 409 invalid_idempotent_request ;
 * - une même clé pendant qu'une requête est en cours : 409
 *   concurrent_idempotent_requests.
 * `delai` ralentit chaque envoi, pour éprouver les appels simultanés.
 */
export class FauxEmail implements ClientEmail {
  /** Chaque appel, même refusé. */
  readonly appels: { message: MessageEmail; cle: string }[] = [];
  /** Les e-mails réellement partis. */
  readonly envoyes: { message: MessageEmail; cle: string; id: string }[] = [];
  private readonly parCle = new Map<string, { empreinte: string; id: string }>();
  private readonly enCours = new Set<string>();
  delai = 0;
  /** Resend refuse l'envoi (domaine de l'expéditeur non vérifié, par exemple). */
  refuse = false;
  /** Resend ne répond pas. */
  enPanne = false;

  async envoyer(message: MessageEmail, cle: string): Promise<ResultatEnvoi> {
    this.appels.push({ message, cle });
    if (this.enPanne) return { ok: false, raison: "panne", code: "application_error" };
    if (this.refuse) return { ok: false, raison: "refus", code: "validation_error" };
    if (this.enCours.has(cle)) return { ok: false, raison: "en_cours", code: "concurrent_idempotent_requests" };
    const empreinte = empreinteDe(message);
    const deja = this.parCle.get(cle);
    if (deja) {
      return deja.empreinte === empreinte
        ? { ok: true, id: deja.id }
        : { ok: false, raison: "requete_differente", code: "invalid_idempotent_request" };
    }
    this.enCours.add(cle);
    try {
      if (this.delai > 0) await new Promise((resoudre) => setTimeout(resoudre, this.delai));
      const id = `email-faux-${String(this.envoyes.length + 1).padStart(4, "0")}`;
      this.parCle.set(cle, { empreinte, id });
      this.envoyes.push({ message, cle, id });
      return { ok: true, id };
    } finally {
      this.enCours.delete(cle);
    }
  }

  /** Resend oublie les clés d'idempotence au bout de 24 heures. */
  oublierLesCles(): void {
    this.parCle.clear();
  }

  /** Les e-mails partis vers une adresse (destinataire ou copie cachée). */
  envoyesA(adresse: string): { message: MessageEmail; cle: string; id: string }[] {
    const forme = adresse.toLowerCase();
    return this.envoyes.filter(({ message }) =>
      [...message.a, ...message.copieCachee].some((a) => a.toLowerCase() === forme),
    );
  }
}

/** L'empreinte d'une requête, pièces jointes comprises, octet pour octet. */
export function empreinteDe(message: MessageEmail): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...message,
        piecesJointes: message.piecesJointes.map((piece) => ({ ...piece, contenu: piece.contenu.toString("base64") })),
      }),
    )
    .digest("hex");
}
