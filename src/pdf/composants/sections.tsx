import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { cachette } from "../../engine/cachettes";
import { LIBELLES_FORMATS, LIBELLES_THEMES, TRANCHES_AGE, reglesPartie } from "../../engine/configuration";
import { fichesEquipe } from "../../engine/kit";
import { remplir } from "../../engine/texte";
import type { Carte, Equipe, Kit } from "../../engine/types";
import { GUIDE } from "../../contenu/guide";
import { theme } from "../../contenu/themes";
import { COULEURS, LARGEUR_UTILE, styles } from "../styles";
import { Icone, LigneACompleter } from "./base";
import { RenvoiFiche, VueEnigme } from "./enigmes";

const s = StyleSheet.create({
  carte: {
    borderWidth: 1,
    borderColor: COULEURS.trait,
    borderRadius: 8,
    padding: 12,
    // Deux cartes, un trait de coupe et le titre de section doivent tenir sur
    // une page A4 : 2 x 326 + 17 + 69 < 760 pt de hauteur utile.
    height: 326,
    justifyContent: "flex-start",
  },
  carteEnTete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    borderBottomWidth: 0.8,
    borderBottomColor: COULEURS.traitLeger,
    paddingBottom: 4,
  },
  carteEquipe: { flexDirection: "row", alignItems: "center", gap: 5 },
  ambiance: { fontSize: 9.5, color: COULEURS.encreClaire, marginBottom: 6 },
  poser: { fontSize: 7.5, color: COULEURS.encreClaire, marginTop: "auto", paddingTop: 6 },
  invitation: {
    width: (LARGEUR_UTILE - 12) / 2,
    height: 318,
    borderWidth: 0.8,
    borderColor: COULEURS.traitLeger,
    borderStyle: "dashed",
    borderRadius: 6,
    padding: 14,
  },
  diplome: {
    borderWidth: 1.4,
    borderColor: COULEURS.accent,
    borderRadius: 10,
    padding: 18,
    height: 326,
    alignItems: "center",
    justifyContent: "center",
  },
  celluleTete: { fontWeight: 700, fontSize: 9 },
  cellule: { fontSize: 9, paddingVertical: 2.5, paddingRight: 6 },
  ligneTableau: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: COULEURS.traitLeger },
});

export function valeursTextes(kit: Kit, nom = ""): Record<string, string | number> {
  return {
    prenom: kit.configuration.prenom,
    age: kit.configuration.age,
    code: kit.codeFinal ?? "",
    nom,
  };
}

// --------------------------------------------------------------------------
// Cartes-indices
// --------------------------------------------------------------------------

export function VueCarte({ kit, equipe, carte }: { kit: Kit; equipe: Equipe; carte: Carte }) {
  const contenu = theme(kit.configuration.theme);
  const textes = contenu.formats[kit.format];
  const fiches = fichesEquipe(equipe);
  const numeroFiche = (id: string) => fiches.find((f) => f.enigme.id === id)?.numero ?? 0;
  const lieu = cachette(carte.cachette);
  const plusieurs = kit.equipes.length > 1;

  const rendre = (enigme: typeof carte.navigation) => {
    if (!enigme) return null;
    return enigme.surFiche ? (
      <RenvoiFiche key={enigme.id} enigme={enigme} numero={numeroFiche(enigme.id)} />
    ) : (
      <VueEnigme key={enigme.id} enigme={enigme} compact />
    );
  };

  return (
    <View style={s.carte} wrap={false}>
      <View style={s.carteEnTete}>
        <Text style={{ fontFamily: "Fredoka", fontSize: 11 }}>{textes.titreKit}</Text>
        <View style={s.carteEquipe}>
          {plusieurs ? (
            <>
              <Icone cle={equipe.symbole} taille={13} />
              <Text style={{ fontSize: 9.5 }}>Équipe {equipe.nom}</Text>
            </>
          ) : null}
          <Text style={{ fontSize: 9.5, fontWeight: 700 }}>
            {GUIDE.carteNumero} {carte.etape}
          </Text>
        </View>
      </View>

      <Text style={s.ambiance}>{carte.ambiance}</Text>

      {carte.messageFinal ? (
        <Text style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>{carte.messageFinal}</Text>
      ) : null}
      {rendre(carte.navigation)}
      {rendre(carte.code)}
      {rendre(carte.bonus)}

      <Text style={s.poser}>
        {GUIDE.cartePoser} {lieu.libelle} — étape {carte.etape}
        {plusieurs ? ` — équipe ${equipe.nom}` : ""}
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// Invitation
// --------------------------------------------------------------------------

export function VueInvitation({ kit, invite }: { kit: Kit; invite?: string }) {
  const contenu = theme(kit.configuration.theme);
  const textes = contenu.formats[kit.format];
  const fete = kit.configuration.fete;
  return (
    <View style={s.invitation} wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Icone cle="enveloppe" taille={16} />
        <Text style={{ fontFamily: "Fredoka", fontSize: 14, color: COULEURS.accent }}>{textes.titreKit}</Text>
      </View>
      {invite ? (
        <Text style={{ fontSize: 11, marginBottom: 6 }}>
          {GUIDE.invitationPour} {invite}
        </Text>
      ) : (
        <LigneACompleter libelle={GUIDE.invitationPour} largeur={140} />
      )}
      <Text style={{ fontSize: 10.5, lineHeight: 1.5, marginBottom: 10 }}>
        {remplir(textes.invitation, valeursTextes(kit))}
      </Text>
      {fete?.date ? (
        <Text style={{ fontSize: 10 }}>
          {GUIDE.invitationDate} {fete.date}
        </Text>
      ) : (
        <LigneACompleter libelle={GUIDE.invitationDate} largeur={130} />
      )}
      {fete?.heure ? (
        <Text style={{ fontSize: 10 }}>
          {GUIDE.invitationHeure} {fete.heure}
        </Text>
      ) : (
        <LigneACompleter libelle={GUIDE.invitationHeure} largeur={130} />
      )}
      {fete?.adresse ? (
        <Text style={{ fontSize: 10 }}>
          {GUIDE.invitationAdresse} {fete.adresse}
        </Text>
      ) : (
        <LigneACompleter libelle={GUIDE.invitationAdresse} largeur={130} />
      )}
      {fete?.contact ? (
        <Text style={{ fontSize: 10 }}>
          {GUIDE.invitationContact} {fete.contact}
        </Text>
      ) : (
        <LigneACompleter libelle={GUIDE.invitationContact} largeur={130} />
      )}
      <Text style={{ fontSize: 7, color: COULEURS.encreClaire, marginTop: "auto" }}>{GUIDE.mentionSite}</Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// Diplôme
// --------------------------------------------------------------------------

export function VueDiplome({ kit, nom }: { kit: Kit; nom?: string }) {
  const contenu = theme(kit.configuration.theme);
  const textes = contenu.formats[kit.format];
  return (
    <View style={s.diplome} wrap={false}>
      <Icone cle="medaille" taille={34} />
      <Text style={{ fontFamily: "Fredoka", fontSize: 20, color: COULEURS.accent, marginTop: 8, textAlign: "center" }}>
        {textes.diplomeTitre}
      </Text>
      <View style={{ height: 10 }} />
      {nom ? (
        <Text style={{ fontFamily: "Fredoka", fontSize: 16 }}>{nom}</Text>
      ) : (
        <View style={{ width: 230, borderBottomWidth: 1, borderBottomColor: COULEURS.trait, height: 20 }} />
      )}
      <Text style={{ fontSize: 10.5, textAlign: "center", marginTop: 12, lineHeight: 1.5, paddingHorizontal: 16 }}>
        {remplir(textes.diplomeTexte, valeursTextes(kit, nom ?? "………"))}
      </Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <Icone cle="coupe" taille={16} />
        <Icone cle="gateau" taille={16} />
        <Icone cle="cadeau" taille={16} />
      </View>
      <Text style={{ fontSize: 7, color: COULEURS.encreClaire, marginTop: 12 }}>{GUIDE.mentionSite}</Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// Tableaux du guide
// --------------------------------------------------------------------------

export function FicheTechnique({ kit }: { kit: Kit }) {
  const regles = reglesPartie(kit.configuration);
  const lignes: [string, string][] = [
    ["Pour", `${kit.configuration.prenom}, ${kit.configuration.age} ans`],
    ["Thème", LIBELLES_THEMES[kit.configuration.theme]],
    ["Format", `${LIBELLES_FORMATS[kit.format]} (${TRANCHES_AGE[kit.format]})`],
    ["Durée prévue", `${kit.configuration.duree} minutes`],
    ["Enfants", `${kit.configuration.nombreEnfants}`],
    ["Équipes", regles.equipes > 1 ? `${regles.equipes} équipes` : "un seul groupe"],
    ["Étapes", `${kit.etapes.length}`],
    ["Code final", kit.codeFinal ? `${kit.codeFinal.length} chiffres` : "aucun"],
  ];
  return (
    <View style={[styles.encadre, { marginTop: 10 }]}>
      {lignes.map(([libelle, valeur]) => (
        <View key={libelle} style={{ flexDirection: "row", marginBottom: 1.5 }}>
          <Text style={{ width: 110, fontWeight: 700, fontSize: 9.5 }}>{libelle}</Text>
          <Text style={{ flex: 1, fontSize: 9.5 }}>{valeur}</Text>
        </View>
      ))}
    </View>
  );
}

export function PlanDePose({ kit }: { kit: Kit }) {
  const plusieurs = kit.equipes.length > 1;
  return (
    <View>
      <Text style={styles.titre2}>{GUIDE.titrePlanPose}</Text>
      <Text style={styles.paragraphe}>{plusieurs ? GUIDE.planPoseIntro : GUIDE.planPoseSolo}</Text>
      <View style={s.ligneTableau}>
        <Text style={[s.cellule, s.celluleTete, { width: 46 }]}>{GUIDE.colonneEtape}</Text>
        <Text style={[s.cellule, s.celluleTete, { flex: 1 }]}>{GUIDE.colonneCachette}</Text>
        <Text style={[s.cellule, s.celluleTete, { width: 170 }]}>Cartes à y poser</Text>
      </View>
      {kit.etapes.map((etape) => (
        <View key={etape.numero} style={s.ligneTableau}>
          <Text style={[s.cellule, { width: 46 }]}>{etape.numero}</Text>
          <Text style={[s.cellule, { flex: 1 }]}>{cachette(etape.cachette).libelle}</Text>
          <View style={[s.cellule, { width: 170, flexDirection: "row", gap: 8, alignItems: "center" }]}>
            {kit.equipes.map((equipe) => (
              <View key={equipe.id} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                {plusieurs ? <Icone cle={equipe.symbole} taille={10} /> : null}
                <Text style={{ fontSize: 8.5 }}>
                  {plusieurs ? equipe.nom : `carte ${etape.numero}`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function TableauSolutions({ kit }: { kit: Kit }) {
  const plusieurs = kit.equipes.length > 1;
  return (
    <View>
      <View style={s.ligneTableau}>
        <Text style={[s.cellule, s.celluleTete, { width: 40 }]}>{GUIDE.colonneEtape}</Text>
        <Text style={[s.cellule, s.celluleTete, { flex: 1 }]}>{GUIDE.colonneCachette}</Text>
        <Text style={[s.cellule, s.celluleTete, { width: 130 }]}>{GUIDE.colonneReponse}</Text>
        <Text style={[s.cellule, s.celluleTete, { width: 130 }]}>{GUIDE.colonneChiffre}</Text>
      </View>
      {kit.etapes.map((etape, index) => {
        const suivante = etape.cachetteSuivante ? cachette(etape.cachetteSuivante).motCle : "le trésor";
        const chiffres = kit.equipes
          .flatMap((equipe) =>
            equipe.chiffres
              .filter((c) => c.etape === etape.numero)
              .map((c) => `${plusieurs ? `${equipe.nom} : ` : ""}${c.chiffre} (n° ${c.position})`),
          )
          .join(" ; ");
        return (
          <View key={etape.numero} style={s.ligneTableau}>
            <Text style={[s.cellule, { width: 40 }]}>{index + 1}</Text>
            <Text style={[s.cellule, { flex: 1 }]}>{cachette(etape.cachette).libelle}</Text>
            <Text style={[s.cellule, { width: 130 }]}>{suivante}</Text>
            <Text style={[s.cellule, { width: 130 }]}>{chiffres || "—"}</Text>
          </View>
        );
      })}
    </View>
  );
}
