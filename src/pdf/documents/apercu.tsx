import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fichesEquipe } from "../../engine/kit";
import { remplir } from "../../engine/texte";
import type { Enigme, Kit } from "../../engine/types";
import { GUIDE } from "../../contenu/guide";
import { theme } from "../../contenu/themes";
import { Icone, PiedDePage, Puce } from "../composants/base";
import { VueEnigme } from "../composants/enigmes";
import { FicheTechnique, VueCarte, VueInvitation, valeursTextes } from "../composants/sections";
import { deroule } from "../deroule";
import { COULEURS, HAUTEUR_PAGE, LARGEUR_PAGE, styles } from "../styles";

const s = StyleSheet.create({
  filigrane: {
    position: "absolute",
    top: HAUTEUR_PAGE / 2 - 70,
    left: -LARGEUR_PAGE * 0.1,
    width: LARGEUR_PAGE * 1.2,
    textAlign: "center",
    fontFamily: "Fredoka",
    fontSize: 104,
    color: "#000000",
    opacity: 0.12,
    transform: "rotate(-32deg)",
  },
  bandeau: {
    borderWidth: 1,
    borderColor: COULEURS.accent,
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  ligneDeroule: { flexDirection: "row", marginBottom: 3 },
  minute: { width: 62, fontWeight: 700, fontSize: 9.5 },
});

function Filigrane() {
  return (
    <Text style={s.filigrane} fixed>
      {GUIDE.apercuFiligrane}
    </Text>
  );
}

/** Choisit une énigme représentative : la plus riche parmi celles de l'équipe. */
function enigmeVitrine(kit: Kit): Enigme | null {
  const equipe = kit.equipes[0]!;
  const fiches = fichesEquipe(equipe);
  const surFiche = fiches.find((f) => f.enigme.role !== "bonus") ?? fiches[0];
  if (surFiche) return surFiche.enigme;
  for (const carte of equipe.cartes) {
    if (carte.bonus) return carte.bonus;
    if (carte.code) return carte.code;
  }
  return equipe.cartes[0]?.navigation ?? null;
}

/**
 * Aperçu gratuit : quatre pages représentatives, filigranées.
 *
 * Aucune solution, aucun code final, aucun tableau récapitulatif : c'est la
 * seule différence avec le kit complet, qui est produit à partir du même kit
 * et de la même graine.
 */
export function documentApercu(kit: Kit) {
  const contenu = theme(kit.configuration.theme);
  const textes = contenu.formats[kit.format];
  const equipe = kit.equipes[0]!;
  const carte = equipe.cartes.find((c) => !c.versTresor) ?? equipe.cartes[0]!;
  const vitrine = enigmeVitrine(kit);
  const moments = deroule(kit).slice(0, 5);

  return (
    <Document
      title={`Aperçu — ${textes.titreKit}`}
      author="Mission Gâteau"
      subject="Aperçu gratuit d'un kit de jeu d'anniversaire"
      creator="Mission Gâteau"
      producer="Mission Gâteau"
    >
      <Page size="A4" style={styles.page}>
        <Filigrane />
        <PiedDePage note="Aperçu" />
        <Text style={styles.titre1}>{textes.titreKit}</Text>
        <Text style={{ fontSize: 13, color: COULEURS.encreClaire, marginBottom: 6 }}>{GUIDE.apercuTitre}</Text>
        <Text style={styles.paragraphe}>{GUIDE.apercuIntro}</Text>
        <FicheTechnique kit={kit} />
        <Text style={styles.titre2}>Début du guide de l&apos;organisateur</Text>
        {moments.map((moment, i) => (
          <View key={i} style={s.ligneDeroule}>
            <Text style={s.minute}>{`${moment.debut}–${moment.debut + moment.duree} min`}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 700, fontSize: 9.5 }}>{moment.titre}</Text>
              <Text style={{ fontSize: 9.5 }}>{moment.detail}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.titre2}>{GUIDE.titreMateriel}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 6 }}>
          <Icone cle="ciseaux" taille={16} />
          <Icone cle="trombone" taille={16} />
          <Icone cle="enveloppe" taille={16} />
        </View>
        {GUIDE.materiel.slice(0, 3).map((ligne) => (
          <Puce key={ligne}>
            <Text>{ligne}</Text>
          </Puce>
        ))}
        <View style={[s.bandeau, { marginTop: 14 }]}>
          <Text style={{ fontSize: 9.5 }}>{GUIDE.apercuSansSolution}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Filigrane />
        <PiedDePage note="Aperçu" />
        <Text style={styles.titre2}>{GUIDE.titreInvitations}</Text>
        <Text style={styles.petit}>
          Dans le kit complet : {kit.nombreInvitations} invitations, quatre par page, avec les traits de coupe.
        </Text>
        <View style={{ marginTop: 10 }}>
          <VueInvitation kit={kit} invite={kit.configuration.fete?.invites?.[0] || undefined} />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Filigrane />
        <PiedDePage note="Aperçu" />
        <Text style={styles.titre2}>{GUIDE.titreCartes}</Text>
        <Text style={styles.petit}>
          Dans le kit complet : {kit.etapes.length * kit.equipes.length} cartes numérotées, deux par page.
        </Text>
        <View style={{ marginTop: 10 }}>
          <VueCarte kit={kit} equipe={equipe} carte={carte} />
        </View>
      </Page>

      {vitrine ? (
        <Page size="A4" style={styles.page}>
          <Filigrane />
          <PiedDePage note="Aperçu" />
          <Text style={styles.titre2}>{GUIDE.titreFiches}</Text>
          <Text style={styles.petit}>{GUIDE.fichesIntro}</Text>
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: COULEURS.trait, borderRadius: 8, padding: 14 }}>
            <VueEnigme enigme={vitrine} />
          </View>
          <View style={[s.bandeau, { marginTop: 16 }]}>
            <Text style={{ fontSize: 9.5 }}>
              {remplir(
                "Le kit complet de {prenom} contient aussi la page du trésor, un diplôme par enfant et la page des solutions réservée à l'adulte.",
                valeursTextes(kit),
              )}
            </Text>
          </View>
        </Page>
      ) : null}
    </Document>
  );
}
