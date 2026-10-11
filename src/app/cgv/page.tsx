import type { Metadata } from "next";
import { metadonneesDePage } from "@/site/referencement";
import { PageLegale } from "@/composants/PageLegale";
import { conditionsGenerales } from "@/contenu/legal";
import { VENDEUR } from "@/contenu/vendeur";
import { venteOuverteMaintenant } from "@/vente/ouverture";
import { PRIX_AFFICHE } from "@/vente/prix";

/** Titre, description, adresse canonique, Open Graph ; visible des moteurs en production seulement. */
export function generateMetadata(): Metadata {
  return metadonneesDePage("/cgv");
}

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
