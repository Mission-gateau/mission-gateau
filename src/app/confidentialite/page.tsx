import type { Metadata } from "next";
import { metadonneesDePage } from "@/site/referencement";
import { PageLegale } from "@/composants/PageLegale";
import { politiqueDeConfidentialite } from "@/contenu/legal";
import { VENDEUR } from "@/contenu/vendeur";

/** Titre, description, adresse canonique, Open Graph ; visible des moteurs en production seulement. */
export function generateMetadata(): Metadata {
  return metadonneesDePage("/confidentialite");
}

export default function Confidentialite() {
  return <PageLegale document={politiqueDeConfidentialite(VENDEUR)} />;
}
