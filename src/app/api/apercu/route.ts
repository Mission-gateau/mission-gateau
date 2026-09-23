import { renderToBuffer } from "@react-pdf/renderer";
import { schemaConfiguration } from "@/engine/configuration";
import { construireKit } from "@/engine/kit";
import { verifierKit } from "@/engine/validation";
import { creerGraine, graineValide } from "@/engine/alea";
import { documentApercu } from "@/pdf/documents/apercu";
import { enregistrerPolices } from "@/pdf/ressources";

/** Le rendu PDF lit des fichiers et utilise fontkit : runtime Node, jamais Edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Une configuration tient très largement dans 8 ko. Au-delà, on refuse. */
const TAILLE_MAX = 8 * 1024;

function erreur(message: string, statut: number, details?: unknown): Response {
  return Response.json(
    { erreur: message, ...(details ? { details } : {}) },
    { status: statut, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Aperçu gratuit.
 *
 * Les données arrivent en POST, jamais dans l'adresse : le prénom de l'enfant
 * n'apparaît ainsi dans aucun journal de serveur. Rien n'est enregistré, rien
 * n'est journalisé, rien n'est transmis ailleurs : la configuration sert à
 * produire le PDF, puis disparaît avec la requête.
 */
export async function POST(requete: Request): Promise<Response> {
  const annonce = requete.headers.get("content-length");
  if (annonce && Number(annonce) > TAILLE_MAX) {
    return erreur("Requête trop volumineuse.", 413);
  }

  let brut: string;
  try {
    brut = await requete.text();
  } catch {
    return erreur("Requête illisible.", 400);
  }
  if (brut.length > TAILLE_MAX) return erreur("Requête trop volumineuse.", 413);

  let charge: unknown;
  try {
    charge = JSON.parse(brut);
  } catch {
    return erreur("Requête illisible.", 400);
  }
  if (typeof charge !== "object" || charge === null) {
    return erreur("Requête illisible.", 400);
  }

  const { configuration, graine } = charge as { configuration?: unknown; graine?: unknown };
  const analyse = schemaConfiguration.safeParse(configuration);
  if (!analyse.success) {
    return erreur(
      "Cette configuration n'est pas valide.",
      422,
      analyse.error.issues.map((souci) => ({
        champ: souci.path.join("."),
        message: souci.message,
      })),
    );
  }

  // La graine est tirée ici, puis renvoyée au navigateur : le kit complet
  // produit plus tard avec la même configuration et la même graine sera
  // exactement celui que le parent a vu en aperçu.
  const grainePartie =
    typeof graine === "string" && graineValide(graine) ? graine : creerGraine();

  try {
    enregistrerPolices();
    const kit = construireKit(analyse.data, grainePartie);
    const problemes = verifierKit(kit);
    if (problemes.length > 0) {
      return erreur("Le jeu produit n'a pas passé ses contrôles.", 500, problemes.slice(0, 5));
    }
    const pdf = await renderToBuffer(documentApercu(kit));
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="apercu-mission-gateau.pdf"',
        "Content-Length": String(pdf.length),
        "Cache-Control": "no-store",
        "X-Graine": grainePartie,
      },
    });
  } catch {
    return erreur("La création de l'aperçu a échoué.", 500);
  }
}

/** Le formulaire poste ; une adresse seule ne doit rien livrer. */
export function GET(): Response {
  return erreur("Cette adresse attend un envoi de formulaire.", 405);
}
