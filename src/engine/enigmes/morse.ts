/** Alphabet morse international, réduit aux lettres. */
export const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
  G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
};

/** Table inverse, reconstruite à part : c'est elle qui sert à vérifier. */
export const MORSE_INVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE).map(([lettre, code]) => [code, lettre]),
);
