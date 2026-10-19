/**
 * Sprache (E-170): Start-Sprache, Übersetzen, und die Wächter
 * „kein deutscher Text, wenn Englisch an ist" und „kein fehlender Schlüssel".
 */
import { describe, expect, it } from "vitest";
import { ermittleSprache, nachEnglisch, sprache, t } from "../src/ui/sprache";

describe("Start-Sprache", () => {
  it("gemerkte Wahl geht vor dem Gerät", () => {
    expect(ermittleSprache("en", "de-DE")).toBe("en");
    expect(ermittleSprache("de", "en-US")).toBe("de");
  });
  it("sonst das Gerät: deutsch nur bei de-*, alles andere englisch", () => {
    expect(ermittleSprache(null, "de-DE")).toBe("de");
    expect(ermittleSprache(null, "de")).toBe("de");
    expect(ermittleSprache(null, "de-AT")).toBe("de");
    expect(ermittleSprache(null, "en-GB")).toBe("en");
    expect(ermittleSprache(null, "fr-FR")).toBe("en");
    expect(ermittleSprache(null, undefined)).toBe("en");
    expect(ermittleSprache("kaputt", "nl-NL")).toBe("en");
  });
  it("ohne Seite (Vitest) gilt Deutsch, t() gibt den Text unverändert zurück", () => {
    expect(sprache()).toBe("de");
    expect(t("Gespeichert.")).toBe("Gespeichert.");
  });
});

describe("Übersetzen", () => {
  it("ganzer Satz aus dem Wörterbuch, Leerraum am Rand bleibt", () => {
    expect(nachEnglisch("Gespeichert.")).toBe("Saved.");
    expect(nachEnglisch("\n   Gespeichert.  ")).toBe("\n   Saved.  ");
  });
  it("Unbekanntes bleibt, wie es ist", () => {
    expect(nachEnglisch("Already English")).toBe("Already English");
    expect(nachEnglisch("↺")).toBe("↺");
  });
});
