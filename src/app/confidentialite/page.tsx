import type { Metadata } from "next";
import { PageLegale } from "@/composants/PageLegale";
import { politiqueDeConfidentialite } from "@/contenu/legal";
import { VENDEUR } from "@/contenu/vendeur";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Ce que Mission Gâteau fait de vos données, et combien de temps elles sont gardées.",
  robots: { index: false, follow: false },
};

export default function Confidentialite() {
  return <PageLegale document={politiqueDeConfidentialite(VENDEUR)} />;
}
