import type { Metadata } from "next";
import { PageLegale } from "@/composants/PageLegale";
import { mentionsLegales } from "@/contenu/legal";
import { VENDEUR } from "@/contenu/vendeur";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "L'éditeur du site Mission Gâteau, son hébergeur et son prestataire de paiement.",
  robots: { index: false, follow: false },
};

export default function MentionsLegales() {
  return <PageLegale document={mentionsLegales(VENDEUR)} />;
}
