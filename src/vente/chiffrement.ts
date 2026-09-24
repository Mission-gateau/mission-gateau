import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Chiffrement de la configuration confiée à Stripe.
 *
 * La configuration d'un jeu acheté contient le prénom de l'enfant, ceux des
 * invités, la date, l'heure, l'adresse et le contact de la fête. Elle part
 * chez Stripe, dans les métadonnées du paiement, uniquement chiffrée :
 * AES-256-GCM, avec une clé dérivée de STRIPE_SECRET_KEY par HKDF-SHA256 et
 * une étiquette propre à cet usage. Stripe ne garde donc qu'un bloc opaque,
 * que seul ce site sait relire.
 *
 * Le contexte (référence, version du kit, graine) est authentifié avec le
 * contenu : un bloc recopié sur une autre commande, ou une métadonnée
 * modifiée, ne se déchiffre plus.
 *
 * Conséquence à connaître : changer de clé Stripe rend illisibles les
 * commandes chiffrées avec l'ancienne. Voir le README.
 */

/** Étiquette HKDF : une clé dérivée pour cet usage, et pour lui seul. */
export const ETIQUETTE_HKDF = "mission-gateau/configuration-de-commande/v1";

/** Premier octet du bloc : permet de changer de format plus tard. */
const FORMAT = 1;
const TAILLE_IV = 12;
const TAILLE_ETIQUETTE_GCM = 16;

function cleDerivee(cleStripe: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(cleStripe, "utf8"), Buffer.alloc(0), Buffer.from(ETIQUETTE_HKDF, "utf8"), 32),
  );
}

/** Chiffre un texte et renvoie un bloc en base64url. */
export function chiffrer(clair: string, cleStripe: string, contexte: string): string {
  const iv = randomBytes(TAILLE_IV);
  const chiffreur = createCipheriv("aes-256-gcm", cleDerivee(cleStripe), iv, {
    authTagLength: TAILLE_ETIQUETTE_GCM,
  });
  chiffreur.setAAD(Buffer.from(contexte, "utf8"));
  const corps = Buffer.concat([chiffreur.update(clair, "utf8"), chiffreur.final()]);
  const etiquette = chiffreur.getAuthTag();
  return Buffer.concat([Buffer.from([FORMAT]), iv, etiquette, corps]).toString("base64url");
}

/**
 * Déchiffre un bloc. Renvoie null s'il a été altéré, s'il a été chiffré avec
 * une autre clé ou pour un autre contexte : on ne livre jamais un contenu dont
 * l'intégrité n'est pas prouvée.
 */
export function dechiffrer(bloc: string, cleStripe: string, contexte: string): string | null {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(bloc)) return null;
    const octets = Buffer.from(bloc, "base64url");
    if (octets.length < 1 + TAILLE_IV + TAILLE_ETIQUETTE_GCM || octets[0] !== FORMAT) return null;
    const iv = octets.subarray(1, 1 + TAILLE_IV);
    const etiquette = octets.subarray(1 + TAILLE_IV, 1 + TAILLE_IV + TAILLE_ETIQUETTE_GCM);
    const corps = octets.subarray(1 + TAILLE_IV + TAILLE_ETIQUETTE_GCM);
    const dechiffreur = createDecipheriv("aes-256-gcm", cleDerivee(cleStripe), iv, {
      authTagLength: TAILLE_ETIQUETTE_GCM,
    });
    dechiffreur.setAAD(Buffer.from(contexte, "utf8"));
    dechiffreur.setAuthTag(etiquette);
    return Buffer.concat([dechiffreur.update(corps), dechiffreur.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Découpe un texte en morceaux d'au plus `taille` caractères. */
export function decouper(texte: string, taille: number): string[] {
  const morceaux: string[] = [];
  for (let i = 0; i < texte.length; i += taille) morceaux.push(texte.slice(i, i + taille));
  return morceaux;
}
