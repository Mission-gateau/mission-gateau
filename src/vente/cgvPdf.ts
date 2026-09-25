import { renderToBuffer } from "@react-pdf/renderer";
import type { VersionCgv } from "../contenu/cgv";
import type { FicheVendeur } from "../contenu/vendeur";
import { documentCgv } from "../pdf/documents/cgv";
import { preparerPolicesCgv } from "../pdf/ressources";

/** « cgv-mission-gateau-2026-09-25.pdf » : le nom de la pièce jointe. */
export function nomDuPdfCgv(version: VersionCgv): string {
  return `cgv-mission-gateau-${version.identifiant}.pdf`;
}

const rendus = new Map<string, Promise<Buffer>>();

/**
 * Le PDF des CGV dans une version donnée, prix compris, tel qu'il part avec
 * la confirmation de commande. Il est identique d'un rendu à l'autre (voir
 * preparerPolicesCgv) ; il n'est donc rendu qu'une fois par processus pour
 * une même version, un même prix et une même fiche du vendeur.
 */
export function pdfDesCgv(version: VersionCgv, fiche: FicheVendeur, prix: string): Promise<Buffer> {
  const cle = JSON.stringify([version.identifiant, prix, fiche]);
  let rendu = rendus.get(cle);
  if (!rendu) {
    rendu = (async () => {
      await preparerPolicesCgv();
      return renderToBuffer(documentCgv(version.conditions(fiche, { prix }), { creation: version.date }));
    })();
    rendus.set(cle, rendu);
    rendu.catch(() => rendus.delete(cle));
  }
  return rendu;
}
