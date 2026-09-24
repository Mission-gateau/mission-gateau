import type { Metadata } from "next";
import { PageLegale } from "@/composants/PageLegale";
import { conditionsGenerales } from "@/contenu/legal";
import { VENDEUR } from "@/contenu/vendeur";
import { venteOuverteMaintenant } from "@/vente/ouverture";
import { PRIX_AFFICHE } from "@/vente/prix";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  description: "Les conditions de vente du jeu complet Mission Gâteau.",
  robots: { index: false, follow: false },
};

/** Le montant n'y figure que lorsque la vente est ouverte : sinon, aucun prix n'est affiché. */
export default function Cgv() {
  const ouverte = venteOuverteMaintenant();
  return (
    <PageLegale
      document={conditionsGenerales(VENDEUR, { prix: ouverte ? PRIX_AFFICHE : null })}
      venteOuverte={ouverte}
    />
  );
}
