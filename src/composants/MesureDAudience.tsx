"use client";

import { Analytics } from "@vercel/analytics/next";
import { avantEnvoi } from "./mesure";

/**
 * Vercel Web Analytics, en production seulement (la mise en page ne le rend
 * pas ailleurs) : son script est servi par notre domaine
 * (`/_vercel/insights/…`), sans cookie. `mode="production"` : jamais le
 * script de débogage, qui viendrait d'un autre domaine.
 */
export function MesureDAudience() {
  return <Analytics mode="production" beforeSend={avantEnvoi} />;
}
