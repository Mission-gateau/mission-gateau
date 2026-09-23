import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { imageIcone } from "../ressources";
import { COULEURS, MENTION_PIED, styles } from "../styles";

const local = StyleSheet.create({
  pied: {
    position: "absolute",
    bottom: 16,
    left: 34,
    right: 34,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COULEURS.encreClaire,
  },
  traitDecoupe: {
    borderTopWidth: 1,
    borderTopColor: COULEURS.traitLeger,
    borderStyle: "dashed",
    marginVertical: 8,
  },
  etiquette: {
    fontSize: 8,
    color: COULEURS.encreClaire,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});

export function Icone({ cle, taille = 14 }: { cle: string; taille?: number }) {
  return <Image src={imageIcone(cle)} style={{ width: taille, height: taille }} />;
}

/**
 * Pied de page, répété sur chaque feuille d'une même section, y compris
 * lorsqu'une section déborde sur une page supplémentaire.
 *
 * Le texte est volontairement statique : un `<Text render={...}>` numérotant
 * les pages empêche @react-pdf/renderer 4.9 de rendre l'élément fixe dès que
 * le document compte plusieurs `<Page>`, et le pied disparaît alors en
 * silence. Un test lit le PDF produit et vérifie que la mention est bien là.
 */
export function PiedDePage({ note }: { note?: string }) {
  return (
    <View style={local.pied} fixed>
      <Text>{MENTION_PIED}</Text>
      <Text>{note ?? ""}</Text>
    </View>
  );
}

export function TraitDeDecoupe() {
  return <View style={local.traitDecoupe} />;
}

export function Etiquette({ children }: { children: string }) {
  return <Text style={local.etiquette}>{children}</Text>;
}

export function Puce({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.puce}>
      <Text style={styles.puceMarque}>•</Text>
      <View style={styles.puceTexte}>{children}</View>
    </View>
  );
}

export function Champ({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 2 }}>
      <Text style={{ width: 120, fontWeight: 700 }}>{libelle}</Text>
      <Text style={{ flex: 1 }}>{valeur}</Text>
    </View>
  );
}

/** Ligne à compléter à la main, quand le parent n'a pas rempli l'information. */
export function LigneACompleter({ libelle, largeur = 150 }: { libelle: string; largeur?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 4 }}>
      <Text style={{ fontSize: 9 }}>{libelle} </Text>
      <View style={{ width: largeur, borderBottomWidth: 0.8, borderBottomColor: COULEURS.trait, height: 11 }} />
    </View>
  );
}
