import type { Metadata } from "next";
import { EnTeteSite, PiedDeSite } from "@/composants/Chrome";
import { FormulaireRetractation } from "@/composants/FormulaireRetractation";
import { remplir } from "@/engine/texte";
import { RETRACTATION } from "@/contenu/retractation";
import { VENDEUR } from "@/contenu/vendeur";
import { adresseSurUneLigne } from "@/vente/fiche";
import { referenceValide, sessionValide } from "@/vente/reference";

export const metadata: Metadata = {
  title: RETRACTATION.titre,
  description: RETRACTATION.description,
  robots: { index: false, follow: false },
};

/**
 * La fonction de rétractation, toujours accessible, vente ouverte ou non :
 * le lien « Renoncer au contrat ici » du pied de chaque page, de la page de
 * commande et de l'e-mail de confirmation mène ici. `?ref=` préremplit la
 * référence ; `?session_id=`, que donne le lien de la page de la commande,
 * permet de retrouver un paiement tout neuf, que la recherche de Stripe ne
 * connaît pas encore.
 */
export default async function Renoncer({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const recherche = await searchParams;
  const reference = typeof recherche.ref === "string" && referenceValide(recherche.ref) ? recherche.ref : "";
  const sessionId = reference && sessionValide(recherche.session_id) ? recherche.session_id : null;
  const vendeur = { email: VENDEUR.email, adresse: adresseSurUneLigne(VENDEUR.adresse) };
  return (
    <>
      <EnTeteSite />
      <main id="contenu" className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <h1 className="font-titre text-3xl text-accent sm:text-4xl">{RETRACTATION.titre}</h1>
        {RETRACTATION.intro.map((phrase) => (
          <p key={phrase} className="mt-4 leading-relaxed">
            {phrase}
          </p>
        ))}
        <p className="mt-4 leading-relaxed">{remplir(RETRACTATION.prealable, vendeur)}</p>
        <FormulaireRetractation referenceInitiale={reference} sessionId={sessionId} vendeur={vendeur} />
      </main>
      <PiedDeSite />
    </>
  );
}
