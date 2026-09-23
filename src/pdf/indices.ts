import { cachette } from "../engine/cachettes";
import { LIBELLES_PIECES } from "../engine/cachettes";
import { GABARITS_INDICES, INDICES_CACHETTES } from "../contenu/indices";
import { remplir } from "../engine/texte";

/** Les trois indices d'une étape, du plus vague au plus précis. */
export function indicesProgressifs(idCachette: string): [string, string, string] {
  const lieu = cachette(idCachette);
  const moyen = INDICES_CACHETTES[idCachette];
  if (!moyen) throw new Error(`Indice manquant pour la cachette ${idCachette}`);
  return [
    remplir(GABARITS_INDICES.premier, { piece: LIBELLES_PIECES[lieu.piece] }),
    moyen,
    remplir(GABARITS_INDICES.troisieme, { libelle: lieu.libelle }),
  ];
}
