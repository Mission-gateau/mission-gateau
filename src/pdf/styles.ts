import { StyleSheet } from "@react-pdf/renderer";

/**
 * Charte des documents imprimés.
 *
 * Peu d'aplats, beaucoup de blanc : le kit doit rester lisible et bon marché
 * à imprimer. Aucune information n'est portée par la couleur seule ; les
 * équipes se reconnaissent à leur symbole, jamais à une teinte.
 */
export const COULEURS = {
  encre: "#1A1A1A",
  encreClaire: "#555555",
  trait: "#9A9A9A",
  traitLeger: "#D5D5D5",
  accent: "#0F4C5C",
  fondLeger: "#F1EFEA",
};

/** Marges : 34 pt, soit 12 mm, au-delà du minimum de 10 mm. */
export const MARGE = 34;
export const LARGEUR_PAGE = 595.28;
export const HAUTEUR_PAGE = 841.89;
export const LARGEUR_UTILE = LARGEUR_PAGE - 2 * MARGE;

export const styles = StyleSheet.create({
  page: {
    paddingTop: MARGE,
    paddingBottom: MARGE + 14,
    paddingHorizontal: MARGE,
    fontFamily: "Nunito",
    fontSize: 10.5,
    lineHeight: 1.45,
    color: COULEURS.encre,
  },
  titre1: { fontFamily: "Fredoka", fontSize: 23, lineHeight: 1.25, marginBottom: 8, color: COULEURS.accent },
  titre2: { fontFamily: "Fredoka", fontSize: 14.5, lineHeight: 1.3, marginTop: 14, marginBottom: 6, color: COULEURS.accent },
  titre3: { fontFamily: "Fredoka", fontSize: 11.5, lineHeight: 1.3, marginBottom: 3 },
  paragraphe: { marginBottom: 6, textAlign: "left" },
  petit: { fontSize: 8.5, color: COULEURS.encreClaire },
  gras: { fontWeight: 700 },
  filet: { borderBottomWidth: 1, borderBottomColor: COULEURS.trait, marginVertical: 8 },
  ligne: { flexDirection: "row" },
  colonne: { flexDirection: "column" },
  piedDePage: {
    position: "absolute",
    bottom: 16,
    left: MARGE,
    right: MARGE,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COULEURS.encreClaire,
  },
  encadre: {
    borderWidth: 1,
    borderColor: COULEURS.trait,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  puce: { flexDirection: "row", marginBottom: 3 },
  puceMarque: { width: 12 },
  puceTexte: { flex: 1 },
});

export const MENTION_PIED = "Mission Gâteau — usage familial, revente interdite";
