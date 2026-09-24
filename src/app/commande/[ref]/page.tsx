import type { Metadata } from "next";
import { EnTeteSite, PiedDeSite } from "@/composants/Chrome";
import { VueCommande } from "@/composants/VueCommande";
import { VENDEUR } from "@/contenu/vendeur";
import { etatDeLaCommande } from "@/vente/commande";
import { dependancesReelles } from "@/vente/dependances";
import { referenceValide, sessionValide } from "@/vente/reference";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Votre commande",
  description: "Le téléchargement de votre jeu Mission Gâteau.",
  robots: { index: false, follow: false },
};

/**
 * La page d'une commande, où mène le retour de Stripe et le lien de l'e-mail.
 * Elle vérifie la commande chez Stripe, côté serveur, et ne génère rien : le
 * kit n'est produit que lorsque le bouton de téléchargement est actionné.
 */
export default async function PageCommande({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ref } = await params;
  const recherche = await searchParams;
  const sessionId = sessionValide(recherche.session_id) ? recherche.session_id : null;
  const deps = dependancesReelles();
  const etat = await etatDeLaCommande({
    reference: ref,
    sessionId,
    client: deps.client,
    cleStripe: deps.env.cleStripe,
    maintenant: deps.maintenant(),
  });

  return (
    <>
      <EnTeteSite />
      <main id="contenu" className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <VueCommande
          etat={etat.etat}
          expireLe={etat.etat === "payee" ? etat.expireLe : null}
          reference={referenceValide(ref) ? ref : null}
          sessionId={sessionId}
          email={VENDEUR.email}
        />
      </main>
      <PiedDeSite />
    </>
  );
}
