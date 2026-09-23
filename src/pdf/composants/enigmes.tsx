import { Circle, Line, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { libelleIcone } from "../../engine/icones";
import { LETTRES } from "../../engine/texte";
import type { Enigme, Labyrinthe } from "../../engine/types";
import { COULEURS } from "../styles";
import { Icone, LettresDetachees } from "./base";

/**
 * Rendu des énigmes.
 *
 * Aucune information ne repose sur la couleur : une case importante est
 * marquée par un trait épais et un repère, pas par une teinte. Les icônes
 * sont toujours des images, jamais des caractères émoji.
 */

const s = StyleSheet.create({
  bloc: { marginBottom: 8 },
  titre: { fontFamily: "Fredoka", fontSize: 11, marginBottom: 2 },
  consigne: { fontSize: 9, color: COULEURS.encreClaire, marginBottom: 5 },
  devinette: { fontSize: 12, lineHeight: 1.5 },
  ligneIcones: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  caseGrille: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.6,
    borderColor: COULEURS.traitLeger,
  },
  caseVide: {
    width: 26,
    height: 26,
    borderWidth: 1.4,
    borderColor: COULEURS.encre,
    borderStyle: "dashed",
  },
  legende: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  legendeEntree: { alignItems: "center", width: 30 },
  legendeLettre: { fontSize: 9, fontWeight: 700 },
  calcul: { fontFamily: "Fredoka", fontSize: 15, marginBottom: 3 },
  grilleLettre: {
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Fredoka",
  },
  motsListe: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 6 },
  motItem: { fontSize: 9 },
  caseSudoku: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.6,
    borderColor: COULEURS.trait,
    fontSize: 12,
    fontFamily: "Fredoka",
  },
  // Le tableau ne porte que ses bords haut et gauche, chaque cellule ne porte
  // que ses bords droit et bas : deux cellules voisines ne tracent donc jamais
  // deux traits l'un contre l'autre. Toutes les cellules d'une ligne ont la
  // même hauteur, sans quoi la ligne laissait des jours.
  tableau: {
    alignSelf: "flex-start",
    borderTopWidth: 0.8,
    borderLeftWidth: 0.8,
    borderColor: COULEURS.trait,
  },
  cellule: {
    borderRightWidth: 0.8,
    borderBottomWidth: 0.8,
    borderColor: COULEURS.trait,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  celluleTexte: { fontSize: 8.5 },
  morse: { fontFamily: "Fredoka", fontSize: 14, lineHeight: 1.5 },
  alphabet: { fontSize: 8, lineHeight: 1.7, color: COULEURS.encreClaire },
});

function EnTete({ enigme }: { enigme: Enigme }) {
  return (
    <View>
      <Text style={s.titre}>{enigme.titre}</Text>
      <Text style={s.consigne}>{enigme.consigne}</Text>
    </View>
  );
}

function GrilleIcones({ grille, taille = 26 }: { grille: string[][]; taille?: number }) {
  return (
    <View>
      {grille.map((ligne, y) => (
        <View key={y} style={{ flexDirection: "row" }}>
          {ligne.map((cle, x) => (
            <View key={x} style={[s.caseGrille, { width: taille, height: taille }]}>
              <Icone cle={cle} taille={taille - 8} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function VueLabyrinthe({ laby, cote }: { laby: Labyrinthe; cote: number }) {
  const largeur = laby.largeur * cote;
  const hauteur = laby.hauteur * cote;
  const traits: { x1: number; y1: number; x2: number; y2: number }[] = [];
  // Bord extérieur, ouvert à l'entrée (en haut à gauche) et à la sortie.
  traits.push({ x1: cote, y1: 0, x2: largeur, y2: 0 });
  traits.push({ x1: 0, y1: 0, x2: 0, y2: hauteur });
  traits.push({ x1: 0, y1: hauteur, x2: largeur - cote, y2: hauteur });
  traits.push({ x1: largeur, y1: 0, x2: largeur, y2: hauteur });
  for (let y = 0; y < laby.hauteur; y += 1) {
    for (let x = 0; x < laby.largeur; x += 1) {
      const murs = laby.murs[y]![x]!;
      if (murs.droite && x + 1 < laby.largeur) {
        traits.push({ x1: (x + 1) * cote, y1: y * cote, x2: (x + 1) * cote, y2: (y + 1) * cote });
      }
      if (murs.bas && y + 1 < laby.hauteur) {
        traits.push({ x1: x * cote, y1: (y + 1) * cote, x2: (x + 1) * cote, y2: (y + 1) * cote });
      }
    }
  }
  return (
    <View>
      <Text style={{ fontSize: 8.5, marginBottom: 2 }}>Entrée en haut à gauche, sortie en bas à droite.</Text>
      <Svg width={largeur + 2} height={hauteur + 2} viewBox={`-1 -1 ${largeur + 2} ${hauteur + 2}`}>
        {traits.map((t, i) => (
          <Line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} strokeWidth={1.2} stroke={COULEURS.encre} />
        ))}
      </Svg>
    </View>
  );
}

/**
 * Repère de la case à deviner.
 *
 * Dessiné en SVG, et non écrit : le caractère « ● » n'existe ni dans Fredoka
 * ni dans Nunito, et @react-pdf/renderer se rabattait alors sur Helvetica,
 * qui n'est pas incorporée au fichier — la case imprimait « Ï ».
 *
 * Le rond se tient dans le coin supérieur gauche et ne dépasse pas le
 * cinquième de la case : le centre reste libre pour que l'enfant y écrive son
 * chiffre. Le trait épais autour de la case garde le repère visible à
 * l'impression en noir et blanc.
 */
function RondRepere({ taille }: { taille: number }) {
  const diametre = Math.min(taille / 5, Math.max(3, taille * 0.18));
  return (
    <View style={{ position: "absolute", top: 1.5, left: 1.5 }}>
      <Svg width={diametre} height={diametre} viewBox={`0 0 ${diametre} ${diametre}`}>
        <Circle cx={diametre / 2} cy={diametre / 2} r={diametre / 2} fill={COULEURS.encre} />
      </Svg>
    </View>
  );
}

function VueSudoku({
  grille,
  caseCle,
  blocLargeur,
  blocHauteur,
  cote,
}: {
  grille: (number | null)[][];
  caseCle: [number, number];
  blocLargeur: number;
  blocHauteur: number;
  cote: number;
}) {
  return (
    <View style={{ borderWidth: 1.6, borderColor: COULEURS.encre, alignSelf: "flex-start" }}>
      {grille.map((ligne, y) => (
        <View key={y} style={{ flexDirection: "row" }}>
          {ligne.map((valeur, x) => {
            const cle = caseCle[0] === x && caseCle[1] === y;
            return (
              <View
                key={x}
                style={[
                  s.caseSudoku,
                  {
                    width: cote,
                    height: cote,
                    borderRightWidth: (x + 1) % blocLargeur === 0 ? 1.6 : 0.6,
                    borderBottomWidth: (y + 1) % blocHauteur === 0 ? 1.6 : 0.6,
                  },
                  cle ? { borderWidth: 2.2, borderColor: COULEURS.encre } : {},
                ]}
              >
                {cle ? <RondRepere taille={cote} /> : null}
                {valeur !== null ? <Text>{valeur}</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function VueEnigme({ enigme, compact = false }: { enigme: Enigme; compact?: boolean }) {
  switch (enigme.type) {
    case "devinette":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <Text style={s.devinette}>{enigme.texte}</Text>
        </View>
      );

    case "intrus":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <GrilleIcones grille={enigme.grille} taille={compact ? 24 : 30} />
        </View>
      );

    case "suite":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <View style={s.ligneIcones}>
            {enigme.affichee.map((cle, i) =>
              cle === null ? (
                <View key={i} style={s.caseVide} />
              ) : (
                <View key={i} style={s.caseGrille}>
                  <Icone cle={cle} taille={18} />
                </View>
              ),
            )}
          </View>
          <Text style={{ fontSize: 9, marginTop: 5 }}>Choisis parmi :</Text>
          <View style={s.ligneIcones}>
            {enigme.choix.map((cle) => (
              <View key={cle} style={s.caseGrille}>
                <Icone cle={cle} taille={18} />
              </View>
            ))}
          </View>
        </View>
      );

    case "comptage":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <GrilleIcones grille={enigme.grille} taille={compact ? 22 : 28} />
        </View>
      );

    case "labyrinthe":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <VueLabyrinthe laby={enigme.labyrinthe} cote={compact ? 16 : Math.floor(430 / enigme.labyrinthe.largeur)} />
        </View>
      );

    case "pictogrammes":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <View style={s.ligneIcones}>
            {enigme.suite.map((cle, i) => (
              <View key={i} style={{ alignItems: "center" }}>
                <Icone cle={cle} taille={20} />
                <View style={{ width: 20, borderBottomWidth: 0.8, borderBottomColor: COULEURS.trait, marginTop: 2 }} />
              </View>
            ))}
          </View>
          <View style={s.legende}>
            {enigme.legende.map(({ lettre, icone }) => (
              <View key={lettre} style={s.legendeEntree}>
                <Icone cle={icone} taille={15} />
                <Text style={s.legendeLettre}>{lettre}</Text>
              </View>
            ))}
          </View>
        </View>
      );

    case "calcul":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          {enigme.lignes.map((ligne, i) => (
            <Text key={i} style={s.calcul}>
              {ligne}
            </Text>
          ))}
        </View>
      );

    case "motsmeles": {
      // Une case assez grande pour qu'un enfant puisse entourer les mots au
      // crayon : on remplit la largeur utile de la fiche.
      const cote = compact ? 17 : Math.floor(440 / enigme.taille);
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <View style={{ borderWidth: 1, borderColor: COULEURS.encre, alignSelf: "flex-start" }}>
            {enigme.grille.map((ligne, y) => (
              <View key={y} style={{ flexDirection: "row" }}>
                {ligne.map((lettre, x) => (
                  <Text
                    key={x}
                    style={[s.grilleLettre, { width: cote, height: cote, fontSize: cote * 0.5 }]}
                  >
                    {lettre}
                  </Text>
                ))}
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 9.5, marginTop: 8, fontWeight: 700 }}>Mots à trouver :</Text>
          <View style={s.motsListe}>
            {enigme.mots.map((mot) => (
              <Text key={mot} style={s.motItem}>
                {mot}
              </Text>
            ))}
          </View>
        </View>
      );
    }

    case "miroir":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <LettresDetachees mot={enigme.texteMiroir} />
        </View>
      );

    case "cesar":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <LettresDetachees mot={enigme.texteChiffre} souligne />
          <Text style={s.alphabet}>{LETTRES.split("").join(" ")}</Text>
          <Text style={{ fontSize: 8, color: COULEURS.encreClaire, marginTop: 2 }}>
            Le décalage est le chiffre trouvé à l&apos;{enigme.origineDecalage}.
          </Text>
        </View>
      );

    case "sudoku":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <VueSudoku
            grille={enigme.grille}
            caseCle={enigme.caseCle}
            blocLargeur={enigme.blocLargeur}
            blocHauteur={enigme.blocHauteur}
            cote={compact ? 20 : 34}
          />
          <Text style={{ fontSize: 8.5, marginTop: 4 }}>
            La case marquée d&apos;un rond donne le chiffre du code.
          </Text>
        </View>
      );

    case "logique": {
      const largeurNom = 110;
      const largeurCol = 90;
      const hauteurLigne = 22;
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <View style={s.tableau}>
            <View style={{ flexDirection: "row" }}>
              <View style={[s.cellule, { width: largeurNom, height: hauteurLigne }]}>
                <Text style={[s.celluleTexte, { fontWeight: 700 }]}>Qui</Text>
              </View>
              {enigme.colonnes.map((colonne) => (
                <View key={colonne.titre} style={[s.cellule, { width: largeurCol, height: hauteurLigne }]}>
                  <Text style={[s.celluleTexte, { fontWeight: 700 }]}>{colonne.titre}</Text>
                </View>
              ))}
            </View>
            {enigme.lignes.map((nom) => (
              <View key={nom} style={{ flexDirection: "row" }}>
                <View style={[s.cellule, { width: largeurNom, height: hauteurLigne }]}>
                  <Text style={s.celluleTexte}>{nom}</Text>
                </View>
                {enigme.colonnes.map((colonne) => (
                  <View key={colonne.titre} style={[s.cellule, { width: largeurCol, height: hauteurLigne }]} />
                ))}
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 9, marginTop: 6 }}>
            Au choix : {enigme.colonnes.map((c) => `${c.titre} — ${c.valeurs.join(", ")}`).join(" ; ")}.
          </Text>
          <Text style={{ fontSize: 9, marginTop: 6, fontWeight: 700 }}>Indices :</Text>
          {enigme.indices.map((indice, i) => (
            <Text key={i} style={{ fontSize: 9.5 }}>
              {i + 1}. {indice}
            </Text>
          ))}
          <Text style={{ fontSize: 10.5, marginTop: 6, fontWeight: 700 }}>{enigme.question}</Text>
        </View>
      );
    }

    case "morse":
      return (
        <View style={s.bloc}>
          <EnTete enigme={enigme} />
          <Text style={s.morse}>{enigme.codes.join("   /   ")}</Text>
          <View style={s.legende}>
            {enigme.legende.map(({ lettre, code }) => (
              <View key={lettre} style={{ width: 44 }}>
                <Text style={{ fontSize: 9 }}>
                  <Text style={{ fontWeight: 700 }}>{lettre}</Text> {code}
                </Text>
              </View>
            ))}
          </View>
        </View>
      );
  }
}

/** Renvoi vers une fiche, imprimé sur la carte quand l'énigme est trop grande. */
export function RenvoiFiche({ enigme, numero }: { enigme: Enigme; numero: number }) {
  return (
    <View style={[s.bloc, { borderWidth: 0.8, borderColor: COULEURS.trait, borderRadius: 4, padding: 6 }]}>
      <Text style={s.titre}>{enigme.titre}</Text>
      <Text style={{ fontSize: 9.5 }}>
        Apporte cette carte au maître du jeu : il te remettra la fiche n° {numero}.
      </Text>
    </View>
  );
}

/** Petit rappel d'icône avec son nom, utilisé dans les pages de solutions. */
export function IconeNommee({ cle }: { cle: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icone cle={cle} taille={12} />
      <Text style={{ fontSize: 9 }}>{libelleIcone(cle)}</Text>
    </View>
  );
}
