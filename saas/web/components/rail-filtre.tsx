"use client";

import { useState } from "react";
import type { TrackedAction } from "@/lib/report";
import { CANAL } from "@/components/etat-action";
import { Entree, LigneFait, type Fait } from "@/components/rail-entree";

// LE FILTRE DE L'HISTORIQUE — par thème et par plateforme.
//
// « Ce qui s'est passé » mélange déjà deux sortes de faits (voir l'en-tête de
// `rail-actions.tsx`). Dans le filet hors-thème (`hors-theme.tsx`), il mélange
// en plus PLUSIEURS thèmes : `apiOrphelins`/`chgOrphelins` (`app/page.tsx`)
// prennent tout ce qui n'a pas de carte visible — pas seulement ce qui n'a
// aucun thème — et un thème sorti des priorités s'y retrouve mêlé aux faits
// sans étiquette. Retrouver un changement précis là-dedans était devenu
// pénible : retour direct de David après usage réel de l'app (24 août 2026).
//
// LE FILTRE NE PORTE QUE SUR CE QUI EST DÉJÀ CHARGÉ. Toutes les lignes
// arrivent en props depuis le serveur (`getChangementsApi` + `report.
// changements`, déjà limitées à la fenêtre du rapport) ; filtrer ici est un
// `.filter()` en mémoire, jamais une requête de plus.
//
// LA PLATEFORME NE FILTRE QUE LES FAITS. Une action que TU as décidée
// (`TrackedAction`) n'a pas de canal — Pulse ne sait pas si ton test
// concernait Meta ou Google — donc choisir « Google » ne la fait pas
// disparaître : seuls les faits DÉDUITS ou DÉCLARÉS le sont, et c'est
// précisément ce que demande ce filtre.
//
// LE THÈME FILTRE LES DEUX. `TrackedAction.theme` et `Fait.theme` existent
// tous les deux, et se rattachent à un thème EXACTEMENT comme partout
// ailleurs — via le label posé sur la campagne (`meta_campaign_config` /
// `google_campaign_config`, voir `getChangementsApi` dans
// `lib/changements-api.ts`). Aucune nouvelle correspondance n'est inventée.
//
// UN SÉLECTEUR N'APPARAÎT QUE S'IL SERT À QUELQUE CHOSE. Une carte de thème
// (`theme-card.tsx`) est déjà réduite à un seul thème — le sélecteur de thème
// n'y a rien à choisir, et ne s'affiche donc jamais là. Le sélecteur de thème
// s'affiche dès qu'un thème coexiste avec au moins une entrée sans thème : même
// un seul thème présent aide à l'isoler du bruit anonyme.
//
// LE STYLE REPREND CELUI DE `filter-bar.tsx` (pastilles en `<select>` arrondi,
// actif en `text-brand`) pour rester le même geste que sur la page Coûts et
// sur `/labels`, plutôt qu'un widget de plus à apprendre.

type Ligne =
  | { cle: string; date: string; action: TrackedAction }
  | { cle: string; date: string; fait: Fait };

const CANAUX_ORDRE = ["meta", "google"];

export function RailFiltre({
  closes,
  themeCourant,
}: {
  closes: Ligne[];
  themeCourant: string | null;
}) {
  const [theme, setTheme] = useState("");
  const [canal, setCanal] = useState("");

  const themeDe = (l: Ligne) => ("action" in l ? l.action.theme : l.fait.theme);

  const themes = Array.from(
    new Set(closes.map(themeDe).filter((t): t is string => !!t))
  ).sort((a, b) => a.localeCompare(b, "fr"));
  const aDesSansTheme = closes.some((l) => !themeDe(l));
  const afficherTheme = themes.length > 1 || (themes.length === 1 && aDesSansTheme);

  const canaux = CANAUX_ORDRE.filter((c) =>
    closes.some((l) => "fait" in l && l.fait.canal === c)
  );

  const filtrees = closes.filter((l) => {
    if (theme && themeDe(l) !== theme) return false;
    if (canal && "fait" in l && l.fait.canal !== canal) return false;
    return true;
  });

  const actif = Boolean(theme || canal);
  const pastille =
    "text-[11px] font-medium rounded-full border px-2.5 py-1 outline-none cursor-pointer bg-white max-w-[140px]";
  const on = "border-brand/30 text-brand";
  const off = "border-line text-muted";

  return (
    <div>
      {(afficherTheme || canaux.length > 1) && (
        <div className="flex items-center gap-1.5 flex-wrap pl-6 pb-2">
          {afficherTheme && (
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className={`${pastille} ${theme ? on : off}`}
            >
              <option value="">Thème : tous</option>
              {themes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          {canaux.length > 1 && (
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              className={`${pastille} ${canal ? on : off}`}
            >
              <option value="">Plateforme : toutes</option>
              {canaux.map((c) => (
                <option key={c} value={c}>
                  {CANAL[c]?.nom ?? c}
                </option>
              ))}
            </select>
          )}
          {actif && (
            <button
              onClick={() => {
                setTheme("");
                setCanal("");
              }}
              className="text-[10.5px] font-semibold text-neg"
            >
              ✕ effacer
            </button>
          )}
        </div>
      )}
      {/* Le message ne dit « rien ne correspond » que si un filtre a
          RÉELLEMENT vidé une liste qui avait quelque chose à montrer. Sur une
          `closes` déjà vide (une seule action en cours, aucun fait de
          plateforme — le cas le plus courant juste après avoir pris un
          conseil), aucun sélecteur n'est affiché et rien n'a été filtré : le
          message affirmerait un filtre qui n'existe pas. */}
      {closes.length > 0 && filtrees.length === 0 && (
        <p className="pl-6 py-2 text-[11.5px] text-muted">Rien ne correspond à ce filtre.</p>
      )}
      {filtrees.map((l) =>
        "action" in l ? (
          <Entree key={l.cle} a={l.action} vivante={false} themeCourant={themeCourant} />
        ) : (
          <LigneFait key={l.cle} f={l.fait} themeCourant={themeCourant} />
        )
      )}
    </div>
  );
}
