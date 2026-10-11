import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageGuide } from "@/composants/Guide";
import { guideParAdresse } from "@/contenu/guides";
import { metadonneesDePage } from "@/site/referencement";
import { dateAParis } from "@/vente/dates";
import { venteOuverteMaintenant } from "@/vente/ouverture";
import { PRIX_AFFICHE } from "@/vente/prix";

interface Proprietes {
  params: Promise<{ adresse: string }>;
}

/** Titre, description, adresse canonique, Open Graph ; visible des moteurs en production seulement. */
export async function generateMetadata({ params }: Proprietes): Promise<Metadata> {
  const { adresse } = await params;
  return guideParAdresse(adresse) ? metadonneesDePage(`/guides/${adresse}`) : {};
}

/** Un guide ; une adresse inconnue mène à la page 404. */
export default async function PageDUnGuide({ params }: Proprietes) {
  const { adresse } = await params;
  const guide = guideParAdresse(adresse);
  if (!guide) notFound();
  const prix = venteOuverteMaintenant() ? PRIX_AFFICHE : null;
  return <PageGuide guide={guide} prix={prix} modifieLe={dateAParis(new Date(`${guide.modifieLe}T12:00:00Z`))} />;
}
