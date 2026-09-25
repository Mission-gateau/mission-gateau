import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { cachette } from "../../engine/cachettes";
import { fichesEquipe } from "../../engine/kit";
import { remplir } from "../../engine/texte";
import type { Kit } from "../../engine/types";
import { GUIDE } from "../../contenu/guide";
import { selonEquipes, theme } from "../../contenu/themes";
import { Icone, LettresDetachees, PiedDePage, Puce, TraitDeDecoupe } from "../composants/base";
import { VueEnigme } from "../composants/enigmes";
import {
  FicheTechnique,
  PlanDePose,
  TableauSolutions,
  VueCarte,
  VueDiplome,
  VueInvitation,
  valeursTextes,
} from "../composants/sections";
import { deroule } from "../deroule";
import { indicesProgressifs } from "../indices";
import { COULEURS, HAUTEUR_PAGE, LARGEUR_PAGE, LARGEUR_UTILE, styles } from "../styles";

const s = StyleSheet.create({
  ligneDeroule: { flexDirection: "row", marginBottom: 3 },
  minute: { width: 62, fontWeight: 700, fontSize: 9.5 },
  deuxColonnes: { flexDirection: "row", gap: 12 },
  demiPage: { width: (LARGEUR_UTILE - 12) / 2 },
  etape: {
    borderLeftWidth: 2,
    borderLeftColor: COULEURS.accent,
    paddingLeft: 8,
    marginBottom: 10,
  },
  fiche: { borderWidth: 1, borderColor: COULEURS.trait, borderRadius: 8, padding: 14 },
  tresor: { alignItems: "center", justifyContent: "center", flexGrow: 1 },
  essai: {
    position: "absolute",
    top: HAUTEUR_PAGE / 2 - 60,
    left: -LARGEUR_PAGE * 0.1,
    width: LARGEUR_PAGE * 1.2,
    textAlign: "center",
    fontFamily: "Fredoka",
    fontSize: 40,
    lineHeight: 1.2,
    color: "#000000",
    opacity: 0.16,
    transform: "rotate(-32deg)",
  },
});

/**
 * Hors production, chaque page du kit porte « Exemplaire d'essai — sans
 * valeur commerciale », par le même mécanisme que le filigrane de l'aperçu :
 * un texte fixe, en travers de la page, sous le contenu.
 */
function FiligraneEssai() {
  return (
    <Text style={s.essai} fixed>
      {GUIDE.essaiFiligrane}
    </Text>
  );
}

/** Découpe une liste en paquets de n. */
function paquets<T>(liste: T[], n: number): T[][] {
  const resultat: T[][] = [];
  for (let i = 0; i < liste.length; i += n) resultat.push(liste.slice(i, i + n));
  return resultat;
}

/**
 * Construit l'élément du kit complet, prêt pour renderToBuffer. Avec
 * `essai`, chaque page porte le filigrane d'essai ; sans, le kit est
 * exactement celui des lots précédents.
 */
export function documentKit(kit: Kit, options: { essai?: boolean } = {}) {
  const essai = options.essai ? <FiligraneEssai /> : null;
  const contenu = theme(kit.configuration.theme);
  const textes = contenu.formats[kit.format];
  const moments = deroule(kit);
  const plusieurs = kit.equipes.length > 1;
  const invites = kit.configuration.fete?.invites ?? [];

  const nomsDiplomes: (string | undefined)[] = [
    kit.configuration.prenom,
    ...Array.from({ length: kit.nombreInvitations }, (_, i) => invites[i] || undefined),
  ];

  return (
    <Document
      title={`${textes.titreKit} — ${kit.configuration.prenom}`}
      author="Mission Gâteau"
      subject="Kit de jeu d'anniversaire à imprimer"
      creator="Mission Gâteau"
      producer="Mission Gâteau"
    >
      {/* ---------------------------------------------------- 1. Guide ---- */}
      <Page size="A4" style={styles.page}>
        <PiedDePage note="Guide" />
        {essai}
        <Text style={styles.titre1}>{textes.titreKit}</Text>
        <Text style={{ fontSize: 13, color: COULEURS.encreClaire, marginBottom: 4 }}>{GUIDE.sousTitre}</Text>
        <Text style={styles.paragraphe}>{GUIDE.intro}</Text>
        <FicheTechnique kit={kit} />

        <Text style={styles.titre2}>Déroulé minute par minute</Text>
        {moments.map((moment, i) => (
          <View key={i} style={s.ligneDeroule}>
            <Text style={s.minute}>{moment.duree > 0 ? `${moment.debut}–${moment.debut + moment.duree} min` : "ensuite"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 700, fontSize: 9.5 }}>{moment.titre}</Text>
              <Text style={{ fontSize: 9.5 }}>{moment.detail}</Text>
            </View>
          </View>
        ))}

        <View wrap={false}>
          <Text style={styles.titre2}>{GUIDE.titreMateriel}</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 6 }}>
            <Icone cle="ciseaux" taille={16} />
            <Icone cle="trombone" taille={16} />
            <Icone cle="enveloppe" taille={16} />
            <Icone cle="cadenas" taille={16} />
          </View>
          {GUIDE.materiel.map((ligne) => (
            <Puce key={ligne}>
              <Text>{ligne}</Text>
            </Puce>
          ))}
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <PiedDePage note="Guide" />
        {essai}
        <View wrap={false}>
          <Text style={styles.titre2}>{GUIDE.titrePreparation}</Text>
          {GUIDE.preparation.map((ligne) => (
            <Puce key={ligne}>
              <Text>{ligne}</Text>
            </Puce>
          ))}
        </View>
        <View wrap={false}>
          <PlanDePose kit={kit} />
        </View>
        <View wrap={false}>
          <Text style={styles.titre2}>{GUIDE.titreMaitreDuJeu}</Text>
          {kit.codeFinal ? (
            GUIDE.maitreDuJeu.map((ligne) => (
              <Puce key={ligne}>
                <Text>{ligne}</Text>
              </Puce>
            ))
          ) : (
            <Text style={styles.paragraphe}>{GUIDE.maitreDuJeuSansCode}</Text>
          )}
        </View>
        <View wrap={false}>
          <Text style={styles.titre2}>{GUIDE.titreSecurite}</Text>
          {GUIDE.securite.map((ligne) => (
            <Puce key={ligne}>
              <Text>{ligne}</Text>
            </Puce>
          ))}
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <PiedDePage note="Guide" />
        {essai}
        <Text style={styles.titre1}>{GUIDE.titreLecture}</Text>
        <View style={styles.encadre}>
          <Text style={{ fontSize: 12, lineHeight: 1.6 }}>{remplir(selonEquipes(textes.histoire, kit.equipes.length), valeursTextes(kit))}</Text>
        </View>
        <Text style={styles.titre2}>{GUIDE.titreBriefing}</Text>
        <View style={styles.encadre}>
          <Text style={{ fontSize: 11.5, lineHeight: 1.6 }}>{remplir(selonEquipes(textes.briefing, kit.equipes.length), valeursTextes(kit))}</Text>
        </View>
        <Text style={styles.titre2}>{GUIDE.titreDepart}</Text>
        <View style={styles.encadre}>
          <VueEnigme enigme={kit.depart} />
          <Text style={{ fontSize: 9, color: COULEURS.encreClaire }}>
            Réponse : {cachette(kit.etapes[0]!.cachette).libelle}.
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <PiedDePage note="Guide" />
        {essai}
        {/* Un titre ne doit jamais rester seul en bas de page : on exige
            derrière lui la place d'entrer dans le vif du sujet. */}
        <View minPresenceAhead={110}>
          <Text style={styles.titre1}>{GUIDE.titreEtapes}</Text>
          <Text style={styles.paragraphe}>{GUIDE.etapesIntro}</Text>
        </View>
        {kit.etapes.map((etape) => {
          const indices = indicesProgressifs(etape.cachette);
          const suivante = etape.cachetteSuivante ? cachette(etape.cachetteSuivante) : null;
          return (
            <View key={etape.numero} style={s.etape} wrap={false}>
              <Text style={styles.titre3}>
                Étape {etape.numero} — {cachette(etape.cachette).libelle}
              </Text>
              <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
                {suivante
                  ? `La carte posée ici mène à : ${suivante.libelle} (réponse attendue : ${suivante.motCle}).`
                  : "Dernière carte : les enfants reviennent vous voir pour le trésor."}
              </Text>
              {indices.map((indice, i) => (
                <Text key={i} style={{ fontSize: 9, color: COULEURS.encreClaire }}>
                  {GUIDE.indiceTitres[i]} : {indice}
                </Text>
              ))}
            </View>
          );
        })}
      </Page>

      {/* ---------------------------------------------- 2. Invitations ---- */}
      {paquets(Array.from({ length: kit.nombreInvitations }, (_, i) => i), 4).map((groupe, page) => (
        <Page key={`inv-${page}`} size="A4" style={styles.page}>
          <PiedDePage note="Invitations" />
          {essai}
          {page === 0 ? <Text style={styles.titre2}>{GUIDE.titreInvitations}</Text> : null}
          {paquets(groupe, 2).map((paire, ligne) => (
            <View key={ligne}>
              <View style={s.deuxColonnes}>
                {paire.map((index) => (
                  <VueInvitation key={index} kit={kit} invite={invites[index] || undefined} />
                ))}
              </View>
              {ligne === 0 ? <TraitDeDecoupe /> : null}
            </View>
          ))}
        </Page>
      ))}

      {/* -------------------------------------------- 3. Cartes-indices ---- */}
      {kit.equipes.map((equipe) =>
        paquets(equipe.cartes, 2).map((paire, page) => (
          <Page key={`cartes-${equipe.id}-${page}`} size="A4" style={styles.page}>
            <PiedDePage note="Cartes" />
            {essai}
            {page === 0 ? (
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.titre2}>
                  {GUIDE.titreCartes}
                  {plusieurs ? ` — équipe ${equipe.nom}` : ""}
                </Text>
                <Text style={styles.petit}>{GUIDE.cartesIntro}</Text>
              </View>
            ) : null}
            {paire.map((carte, i) => (
              <View key={carte.etape}>
                <VueCarte kit={kit} equipe={equipe} carte={carte} />
                {i === 0 ? <TraitDeDecoupe /> : null}
              </View>
            ))}
          </Page>
        )),
      )}

      {/* ------------------------------------------ 4. Fiches d'énigmes ---- */}
      {kit.equipes.flatMap((equipe) =>
        fichesEquipe(equipe).map((fiche) => (
          <Page key={`fiche-${equipe.id}-${fiche.numero}`} size="A4" style={styles.page}>
            <PiedDePage note="Fiches" />
            {essai}
            {fiche.numero === 1 ? (
              <View style={{ marginBottom: 4 }}>
                <Text style={styles.titre2}>{GUIDE.titreFiches}</Text>
                <Text style={styles.petit}>{GUIDE.fichesIntro}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={styles.titre3}>
                {GUIDE.ficheNumero} {fiche.numero} — étape {fiche.etape}
              </Text>
              {plusieurs ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Icone cle={equipe.symbole} taille={14} />
                  <Text style={{ fontSize: 10 }}>Équipe {equipe.nom}</Text>
                </View>
              ) : null}
            </View>
            <View style={s.fiche}>
              <VueEnigme enigme={fiche.enigme} />
            </View>
          </Page>
        )),
      )}

      {/* ------------------------------------- 5. Trésor et diplômes ------- */}
      <Page size="A4" style={styles.page}>
        <PiedDePage note="Trésor" />
        {essai}
        <View style={s.tresor}>
          <View style={{ flexDirection: "row", gap: 14, marginBottom: 14 }}>
            <Icone cle="gateau" taille={46} />
            <Icone cle="cadeau" taille={46} />
            <Icone cle="coupe" taille={46} />
          </View>
          <Text style={[styles.titre1, { textAlign: "center" }]}>{GUIDE.titreTresor}</Text>
          <Text style={{ fontSize: 13, lineHeight: 1.7, textAlign: "center", paddingHorizontal: 30 }}>
            {remplir(selonEquipes(textes.tresor, kit.equipes.length), valeursTextes(kit))}
          </Text>
          {kit.codeFinal ? (
            <View style={{ marginTop: 20, borderWidth: 1.4, borderColor: COULEURS.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 }}>
              <LettresDetachees mot={kit.codeFinal} taille={26} />
            </View>
          ) : null}
        </View>
      </Page>

      {paquets(nomsDiplomes, 2).map((paire, page) => (
        <Page key={`dip-${page}`} size="A4" style={styles.page}>
          <PiedDePage note="Diplômes" />
          {essai}
          {page === 0 ? <Text style={styles.titre2}>{GUIDE.titreDiplomes}</Text> : null}
          {paire.map((nom, i) => (
            <View key={i}>
              <VueDiplome kit={kit} nom={nom} />
              {i === 0 ? <TraitDeDecoupe /> : null}
            </View>
          ))}
        </Page>
      ))}

      {/* -------------------------------------------- 6. Solutions --------- */}
      <Page size="A4" style={styles.page}>
        <PiedDePage note="Solutions" />
        {essai}
        <Text style={styles.titre1}>{GUIDE.titreSolutions}</Text>
        <Text style={styles.paragraphe}>{GUIDE.solutionsIntro}</Text>
        <TableauSolutions kit={kit} />
        <Text style={styles.titre2}>{GUIDE.codeFinalLibelle}</Text>
        {kit.codeFinal ? (
          <LettresDetachees mot={kit.codeFinal} taille={24} />
        ) : (
          <Text style={styles.paragraphe}>{GUIDE.sansCode}</Text>
        )}
        <Text style={styles.titre2} minPresenceAhead={60}>
          Solution de chaque énigme
        </Text>
        {kit.equipes.map((equipe) => (
          <View key={equipe.id} style={{ marginBottom: 8 }} wrap={false}>
            {plusieurs ? <Text style={styles.titre3}>Équipe {equipe.nom}</Text> : null}
            <Text style={{ fontSize: 9, marginBottom: 2 }}>Départ — {kit.depart.solution}</Text>
            {equipe.cartes.map((carte) =>
              [carte.navigation, carte.code, carte.bonus]
                .filter((e) => e !== null)
                .map((enigme) => (
                  <Text key={enigme.id} style={{ fontSize: 9, marginBottom: 2 }}>
                    Étape {carte.etape} — {enigme.titre} : {enigme.solution}
                  </Text>
                )),
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}
