/**
 * Ce que le site lit de son environnement.
 *
 * `STRIPE_SECRET_KEY` est la seule variable propre au site ; les autres sont
 * posées par Vercel. Rien n'est lu au moment du build : ces fonctions ne sont
 * appelées que pendant une requête, et le build, les tests et l'intégration
 * continue passent sans clé.
 */

export interface Environnement {
  /** STRIPE_SECRET_KEY : clé secrète ou restreinte de Stripe. */
  cleStripe: string | undefined;
  /** VERCEL_ENV : « production », « preview » ou « development ». Absent en local. */
  vercelEnv: string | undefined;
  /** VERCEL_PROJECT_PRODUCTION_URL : domaine de production, sans protocole. */
  domaineProduction: string | undefined;
  /** VERCEL_URL : domaine propre au déploiement en cours, sans protocole. */
  domaineDeploiement: string | undefined;
  /** PORT : port du serveur local. */
  port: string | undefined;
}

export function lireEnvironnement(env: Record<string, string | undefined> = process.env): Environnement {
  return {
    cleStripe: env.STRIPE_SECRET_KEY?.trim() || undefined,
    vercelEnv: env.VERCEL_ENV?.trim() || undefined,
    domaineProduction: env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || undefined,
    domaineDeploiement: env.VERCEL_URL?.trim() || undefined,
    port: env.PORT?.trim() || undefined,
  };
}

export function enProduction(env: Environnement): boolean {
  return env.vercelEnv === "production";
}

export type NatureCle = "reelle" | "test";

/** Clé réelle (`sk_live_`, `rk_live_`) ou clé de test (`sk_test_`, `rk_test_`). */
export function natureCle(cle: string | undefined): NatureCle | null {
  if (!cle) return null;
  const trouve = /^(?:sk|rk)_(live|test)_[A-Za-z0-9_]+$/.exec(cle);
  if (!trouve) return null;
  return trouve[1] === "live" ? "reelle" : "test";
}

/**
 * La clé est-elle de la bonne nature pour cet environnement ? Une clé réelle
 * en production, une clé de test partout ailleurs. Une clé de test en
 * production, ou une clé réelle hors production, ferme la vente.
 */
export function cleConforme(env: Environnement): boolean {
  const nature = natureCle(env.cleStripe);
  if (!nature) return false;
  return enProduction(env) ? nature === "reelle" : nature === "test";
}

/** Un nom d'hôte simple, sans protocole ni chemin : rien d'autre n'est accepté. */
const MOTIF_DOMAINE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/**
 * Adresse du déploiement qui crée la commande : c'est elle que visent les
 * retours de Stripe et le lien de téléchargement.
 *
 * - en production, le domaine de production donné par Vercel, qui suivra le
 *   domaine du site quand il sera branché ;
 * - en préversion, l'adresse propre à cette préversion ;
 * - en local, localhost.
 *
 * L'en-tête Host de la requête n'est jamais utilisé : il vient du navigateur.
 * Renvoie null si l'adresse ne peut pas être établie ; la commande est alors
 * refusée plutôt que d'envoyer le client ailleurs.
 */
export function adresseDuSite(env: Environnement): string | null {
  if (env.vercelEnv === "production") {
    return env.domaineProduction && MOTIF_DOMAINE.test(env.domaineProduction)
      ? `https://${env.domaineProduction}`
      : null;
  }
  if (env.vercelEnv === "preview") {
    return env.domaineDeploiement && MOTIF_DOMAINE.test(env.domaineDeploiement)
      ? `https://${env.domaineDeploiement}`
      : null;
  }
  const port = env.port && /^\d{2,5}$/.test(env.port) ? env.port : "3000";
  return `http://localhost:${port}`;
}
