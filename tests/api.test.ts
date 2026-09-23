import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/apercu/route";
import { graineValide } from "@/engine/alea";
import { construireKit } from "@/engine/kit";
import { compterPages, configuration } from "./aide";

const URL_APERCU = "http://localhost/api/apercu";

function poster(corps: unknown, entetes: Record<string, string> = {}): Promise<Response> {
  return POST(
    new Request(URL_APERCU, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...entetes },
      body: typeof corps === "string" ? corps : JSON.stringify(corps),
    }),
  );
}

describe("route de l'aperçu", () => {
  it("renvoie un PDF de quatre pages et la graine tirée", async () => {
    const reponse = await poster({ configuration: configuration({ age: 8, nombreEnfants: 10 }) });
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Content-Type")).toBe("application/pdf");
    expect(reponse.headers.get("Cache-Control")).toBe("no-store");
    expect(reponse.headers.get("Content-Disposition")).toContain("inline");
    const graine = reponse.headers.get("X-Graine");
    expect(graine && graineValide(graine)).toBe(true);
    const pdf = Buffer.from(await reponse.arrayBuffer());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(compterPages(pdf)).toBe(4);
  });

  it("reprend la graine fournie, pour retrouver exactement le même jeu", async () => {
    const config = configuration({ age: 11, nombreEnfants: 12 });
    const premiere = await poster({ configuration: config });
    const graine = premiere.headers.get("X-Graine")!;
    const seconde = await poster({ configuration: config, graine });
    expect(seconde.headers.get("X-Graine")).toBe(graine);
    // Le kit reconstruit à partir de cette graine est identique.
    expect(JSON.stringify(construireKit(config, graine))).toBe(
      JSON.stringify(construireKit(config, graine)),
    );
  });

  it("ne laisse fuir aucune donnée saisie dans les en-têtes", async () => {
    const reponse = await poster({
      configuration: configuration({ prenom: "Alizée", age: 8, fete: { contact: "06 11 22 33 44" } }),
    });
    const entetes = JSON.stringify([...reponse.headers.entries()]);
    expect(entetes).not.toContain("Alizée");
    expect(entetes).not.toContain("06 11 22 33 44");
  });

  it("refuse une configuration invalide et explique pourquoi", async () => {
    const reponse = await poster({ configuration: { ...configuration(), age: 2, prenom: "" } });
    expect(reponse.status).toBe(422);
    const corps = (await reponse.json()) as { erreur: string; details: { champ: string; message: string }[] };
    expect(corps.details.map((d) => d.champ)).toContain("age");
    expect(corps.details.map((d) => d.champ)).toContain("prenom");
    expect(corps.details.every((d) => d.message.length > 0)).toBe(true);
  });

  it("refuse une requête illisible", async () => {
    expect((await poster("{ ceci n'est pas du JSON")).status).toBe(400);
    expect((await poster('"une chaîne"')).status).toBe(400);
    expect((await poster({ configuration: null })).status).toBe(422);
  });

  it("borne la taille de la requête", async () => {
    const enorme = { configuration: configuration(), bourrage: "z".repeat(9000) };
    expect((await poster(enorme)).status).toBe(413);
    expect(
      (await poster({ configuration: configuration() }, { "Content-Length": "999999" })).status,
    ).toBe(413);
  });

  it("ignore une graine fantaisiste et en tire une bonne", async () => {
    const reponse = await poster({ configuration: configuration(), graine: "PAS-UNE-GRAINE!!" });
    expect(reponse.status).toBe(200);
    expect(graineValide(reponse.headers.get("X-Graine")!)).toBe(true);
  });

  it("ne sert rien sur une simple visite", () => {
    expect(GET().status).toBe(405);
  });

  it("ne sert jamais le kit complet", async () => {
    const reponse = await poster({ configuration: configuration({ age: 11, nombreEnfants: 16 }) });
    const pdf = Buffer.from(await reponse.arrayBuffer());
    // Un kit complet dépasse largement quatre pages : l'aperçu n'en est pas un.
    expect(compterPages(pdf)).toBeLessThanOrEqual(4);
  });
});
