import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Bloc, DocumentLegal, Morceau } from "../../contenu/document";
import { POLICES_CGV } from "../ressources";
import { COULEURS, MARGE } from "../styles";

/**
 * Le PDF des conditions générales de vente, joint à la confirmation de
 * commande : le même document que la page /cgv, dans la version acceptée par
 * l'acheteur. Il n'emploie que les polices réservées de preparerPolicesCgv,
 * et sa date de création est celle de la version : deux rendus donnent le
 * même fichier, octet pour octet.
 */

const s = StyleSheet.create({
  page: {
    paddingTop: MARGE,
    paddingBottom: MARGE + 16,
    paddingHorizontal: MARGE + 6,
    fontFamily: POLICES_CGV.texte,
    fontSize: 9.5,
    lineHeight: 1.45,
    color: COULEURS.encre,
  },
  titre: { fontFamily: POLICES_CGV.titre, fontSize: 20, lineHeight: 1.25, color: COULEURS.accent, marginBottom: 2 },
  date: { fontSize: 9, color: COULEURS.encreClaire, marginBottom: 8 },
  section: {
    fontFamily: POLICES_CGV.titre,
    fontSize: 12.5,
    lineHeight: 1.3,
    color: COULEURS.accent,
    marginTop: 10,
    marginBottom: 4,
  },
  paragraphe: { marginBottom: 5 },
  puce: { flexDirection: "row", marginBottom: 3 },
  puceMarque: { width: 10 },
  puceTexte: { flex: 1 },
  coordonnees: { borderWidth: 1, borderColor: COULEURS.traitLeger, borderRadius: 4, padding: 7, marginBottom: 6 },
  ligne: { flexDirection: "row", marginBottom: 1.5 },
  libelle: { width: 88, fontWeight: 700 },
  valeur: { flex: 1 },
  encadre: {
    borderWidth: 1.2,
    borderColor: COULEURS.accent,
    borderRadius: 4,
    padding: 8,
    marginTop: 2,
    marginBottom: 6,
    fontSize: 8.8,
  },
  pied: {
    position: "absolute",
    bottom: 16,
    left: MARGE + 6,
    right: MARGE + 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COULEURS.encreClaire,
  },
});

/** Dans le PDF, un lien n'est que son texte : l'adresse d'une page du site n'y aurait pas de sens. */
function texteDe(morceaux: Morceau[]): string {
  return morceaux.map((morceau) => (typeof morceau === "string" ? morceau : morceau.texte)).join("");
}

function VueBloc({ bloc }: { bloc: Bloc }) {
  switch (bloc.type) {
    case "paragraphe":
      return <Text style={s.paragraphe}>{texteDe(bloc.morceaux)}</Text>;
    case "liste":
      return (
        <View style={{ marginBottom: 3 }}>
          {bloc.elements.map((element, index) => (
            <View key={index} style={s.puce} wrap={false}>
              <Text style={s.puceMarque}>•</Text>
              <Text style={s.puceTexte}>{texteDe(element)}</Text>
            </View>
          ))}
        </View>
      );
    case "coordonnees":
      return (
        <View style={s.coordonnees} wrap={false}>
          {bloc.lignes.map((ligne) => (
            <View key={ligne.libelle} style={s.ligne}>
              <Text style={s.libelle}>{ligne.libelle}</Text>
              <Text style={s.valeur}>{texteDe(ligne.valeur)}</Text>
            </View>
          ))}
        </View>
      );
    case "encadre":
      return (
        <View style={s.encadre}>
          {bloc.paragraphes.map((paragraphe, index) => (
            <Text key={index} style={{ marginBottom: index === bloc.paragraphes.length - 1 ? 0 : 3 }}>
              {paragraphe}
            </Text>
          ))}
        </View>
      );
  }
}

export function documentCgv(document: DocumentLegal, options: { creation: Date }) {
  return (
    <Document
      title={`${document.titre} — Mission Gâteau`}
      author="Mission Gâteau"
      subject={document.date}
      creator="Mission Gâteau"
      producer="Mission Gâteau"
      language="fr"
      creationDate={options.creation}
    >
      <Page size="A4" style={s.page}>
        <View style={s.pied} fixed>
          <Text>{`${document.titre} — ${document.date}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
        <Text style={s.titre}>{document.titre}</Text>
        <Text style={s.date}>{document.date}</Text>
        {document.sections.map((section) => (
          <View key={section.titre}>
            <Text style={s.section} minPresenceAhead={40}>
              {section.titre}
            </Text>
            {section.blocs.map((bloc, index) => (
              <VueBloc key={index} bloc={bloc} />
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
