"use client";

import { useState } from "react";
import { LineChart } from "@/components/line-chart";
import { marqueursCourbe, SOURCE } from "@/components/etat-action";
import { Pente, Triangle, sensPente } from "@/components/pente";
import type { KpiFocus, KpiOption } from "@/lib/report";

// « Ta boussole » — le module de l'indicateur qui compte.
//
// Un chiffre seul ne décide rien. Ce module donne les trois choses qui le
// rendent actionnable en trois secondes :
//   1. sa VALEUR, en grand, avec ce qu'elle mesure et d'où elle vient
//   2. sa ZONE — « tu perds / fragile / sain / scalable », ET SON SEUIL :
//      « excellent » ne veut rien dire tant qu'on ne sait pas où ça commence
//   3. sa TRAJECTOIRE sur 10 semaines — un niveau ne vaut rien sans sa pente
//
// LA JAUGE A DISPARU, et c'est la vraie nouvelle. Le module portait DEUX formes
// graphiques — une jauge de zones, puis une courbe — là où la grammaire n'en
// autorise qu'une (docs/03-grammaire-des-modules.md, rang 6). Les zones passent
// donc EN FOND DE COURBE : la jauge disait « où tu es maintenant », le fond dit
// « où tu es ET depuis quand ». On voit le trait passer de moyen à bon entre
// deux semaines, ce qu'aucune jauge ne pouvait montrer. Rien n'est perdu : les
// noms de zones sont à droite du tracé, et le seuil courant est remonté dans la
// pastille.
//
// Six indicateurs sur neuf n'ont AUCUNE zone (cpc, reach, spend, trafic, vues,
// clics) et on ne leur en invente pas pour faire joli : un coût par clic de
// 0,42 CHF est excellent dans un métier et ruineux dans un autre. Pour eux la
// courbe se rend nue, et la pastille de verdict n'apparaît pas — un verdict non
// calculé tombe sous la même règle qu'un chiffre non mesuré.
//
// Et il est PILOTABLE : l'indicateur ouvert par défaut est celui de ton
// objectif, mais tu bascules sur n'importe quel autre d'un doigt — on ne sait
// jamais mieux que toi ce que tu as envie de regarder ce jour-là.

// Le regroupement des indicateurs. PAS « par source connectée » : cinq des neuf
// (roas, ctr, cpc, spend, clics) sont calculés sur Meta ET Google confondus —
// coller une pastille « Google Ads » sur le CTR ferait couper Google à qui
// croit lire Google. On regroupe donc par TERRAIN, qui est la seule clé vraie
// pour les neuf.
//
// ET CHAQUE CELLULE PORTE MAINTENANT SES SOURCES, EN COULEUR. Le regroupement
// par terrain répond à « de quoi ça parle » ; il ne répond pas à « qu'est-ce
// que je casse si je coupe Google ce soir ». Cette réponse-là existait, elle
// était enfermée dans un `PROVENANCE` qui ne servait qu'à une ligne grise sous
// le chiffre du haut, et à rien du tout dans la grille des neuf. Les cinq
// cellules qui additionnent deux régies portent donc deux glyphes : c'est la
// seule information qui manquait pour lire la grille sans l'avoir apprise.
const TERRAIN: Record<string, { groupe: string; court: string; sources: string[] }> = {
  roas: { groupe: "Ta pub", court: "ROAS", sources: ["meta", "google"] },
  ctr: { groupe: "Ta pub", court: "CTR", sources: ["meta", "google"] },
  cpc: { groupe: "Ta pub", court: "Coût / clic", sources: ["meta", "google"] },
  spend: { groupe: "Ta pub", court: "Dépense", sources: ["meta", "google"] },
  clics: { groupe: "Ta pub", court: "Clics", sources: ["meta", "google"] },
  eng: { groupe: "Ton Instagram", court: "Engagement", sources: ["instagram"] },
  reach: { groupe: "Ton Instagram", court: "Portée / post", sources: ["instagram"] },
  vues: { groupe: "Ton Instagram", court: "Vues", sources: ["instagram"] },
  trafic: { groupe: "Ton site", court: "Sessions", sources: ["site"] },
};
const ORDRE_GROUPES = ["Ta pub", "Ton Instagram", "Ton site"];
const PROVENANCE: Record<string, string> = {
  "Ta pub": "Meta + Google confondus",
  "Ton Instagram": "Instagram",
  "Ton site": "Google Analytics",
};
/** Les sources d'un groupe — l'union de celles de ses indicateurs, sans doublon. */
function sourcesGroupe(cles: string[]): string[] {
  const out: string[] = [];
  for (const c of cles)
    for (const s of TERRAIN[c]?.sources ?? [])
      if (!out.includes(s)) out.push(s);
  return out;
}

/** Les glyphes de provenance, dans leur couleur. Le seul endroit qui les pose. */
function Glyphes({ sources, actif = false }: { sources: string[]; actif?: boolean }) {
  if (sources.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-[3px] leading-none shrink-0">
      {sources.map((s) => {
        const src = SOURCE[s];
        if (!src) return null;
        return (
          <span
            key={s}
            className="text-[10px] leading-none"
            style={{ color: actif ? src.surSombre : src.couleur }}
            title={src.nom}
          >
            {src.glyphe}
          </span>
        );
      })}
    </span>
  );
}
// Ce que le chiffre mesure vraiment. « 8 990 » n'est pas la même chose selon
// qu'il s'agit d'un total de semaine ou d'une moyenne par publication.
const PORTEE: Record<string, string> = {
  reach: "moyenne par publication",
  eng: "moyenne par publication",
  roas: "sur la semaine",
  ctr: "sur la semaine",
  cpc: "sur la semaine",
  spend: "total de la semaine",
  clics: "total de la semaine",
  vues: "total de la semaine",
  trafic: "total de la semaine",
};

function fmtVal(o: KpiOption, v: number): string {
  if (o.key === "reach" || o.key === "clics") return Math.round(v).toLocaleString("fr-CH");
  if (o.key === "spend" || o.key === "vues" || o.key === "trafic")
    return Math.round(v).toLocaleString("fr-CH");
  return v.toFixed(o.key === "cpc" ? 2 : 1);
}

function ecartPct(o: KpiOption): number | null {
  return o.precedent !== null && o.precedent !== 0
    ? ((o.valeur - o.precedent) / Math.abs(o.precedent)) * 100
    : null;
}

// Une cellule du sélecteur : le nom, ses SOURCES, la valeur, la pente.
//
// La maquette d'origine proposait une pastille de couleur par cellule, refusée
// alors parce qu'elle aurait répété neuf fois ce que l'en-tête de groupe disait
// trois fois. Le glyphe n'est pas cette pastille : il ne redit pas le groupe, il
// dit CE QU'ON CASSE en coupant une régie — et cinq cellules sur neuf en portent
// deux, ce qu'aucun en-tête de groupe ne pouvait exprimer. Il coûte 14 px, pas
// les 20 px d'une pastille, et il se pose contre le nom.
function Cellule({
  o,
  actif,
  onClick,
}: {
  o: KpiOption;
  actif: boolean;
  onClick: () => void;
}) {
  const d = ecartPct(o);
  const s = sensPente(d, o.direction === "down", 0.5);
  const t = TERRAIN[o.key];
  const court = t?.court ?? o.titre;
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-2.5 py-2 transition-colors ${
        actif
          ? "bg-ink text-white border-ink"
          : "bg-white border-line hover:bg-black/[0.03]"
      }`}
      title={
        t ? `${o.titre} — ${PROVENANCE[t.groupe] ?? ""}`.trim().replace(/ —\s*$/, "") : o.titre
      }
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`block text-[9.5px] uppercase tracking-wide font-bold truncate ${
            actif ? "text-white/60" : "text-faint"
          }`}
        >
          {court}
        </span>
        <span className="ml-auto">
          <Glyphes sources={t?.sources ?? []} actif={actif} />
        </span>
      </span>
      <span className="flex items-baseline gap-1.5 mt-0.5">
        <span className={`font-mono text-[15px] leading-none font-medium ${actif ? "" : "text-ink"}`}>
          {fmtVal(o, o.valeur)}
          <span className={`text-[9.5px] ${actif ? "text-white/60" : "text-faint"}`}>{o.unite}</span>
        </span>
        {d !== null && (
          <span
            className={`text-[10px] font-bold leading-none ${
              actif ? "text-white/70" : s.plat ? "text-faint" : s.cls
            }`}
          >
            {s.plat ? (
              "≈"
            ) : (
              <>
                <Triangle sens={s.monte ? "haut" : "bas"} /> {d > 0 ? "+" : ""}
                {d.toFixed(0)} %
              </>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

export function KpiFocusCard({ k }: { k: KpiFocus }) {
  const [cle, setCle] = useState(k.defaut);
  const o = k.options.find((x) => x.key === cle) ?? k.options[0];
  if (!o) return null;

  const bandes = o.bandes ?? [];
  // La zone où l'on se trouve, ET sa borne basse : « excellent » ne dit rien
  // tant qu'on ne sait pas où l'excellent commence.
  const iz = bandes.findIndex((b) => b.max === null || o.valeur < b.max);
  const zone = iz >= 0 ? bandes[iz] : bandes[bandes.length - 1];
  const bornage =
    bandes.length === 0
      ? null
      : iz <= 0
        ? bandes[0]?.max != null
          ? `sous ${bandes[0].max.toLocaleString("fr-CH")}${o.unite}`
          : null
        : `au-dessus de ${(bandes[iz - 1].max ?? 0).toLocaleString("fr-CH")}${o.unite}`;
  const couleur =
    zone?.tone === "pos" ? "#1a7a4a" : zone?.tone === "neg" ? "#c0392b" : "#b86b00";

  const delta = ecartPct(o);
  const groupe = TERRAIN[o.key]?.groupe;

  // Les repères d'action, NOMMÉS quand le rapport porte leur date et leur titre.
  // Une date exacte est écrite comme une date (« 24 jun ») ; à défaut, seul
  // l'index de semaine est connu et on écrit « sem. du 24 jun » — un seau
  // hebdomadaire présenté comme un jour serait un chiffre présenté pour autre
  // chose que ce qu'il mesure.
  const marqueurs = marqueursCourbe(
    k.marqueurs,
    k.markers,
    k.labels.length,
    (i) => k.labels[i]
  );

  // Les groupes réellement présents, dans l'ordre.
  const groupes = ORDRE_GROUPES.map((g) => ({
    nom: g,
    options: k.options.filter((op) => TERRAIN[op.key]?.groupe === g),
  })).filter((g) => g.options.length > 0);
  const orphelines = k.options.filter((op) => !TERRAIN[op.key]);

  return (
    <div className="bg-white border border-line rounded-2xl shadow-card overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-3">
          Ta boussole <span className="text-ink">· {o.titre}</span>
        </div>

        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-mono text-[38px] sm:text-[46px] leading-none font-medium text-ink">
            {fmtVal(o, o.valeur)}
            <span className="text-[20px] text-faint">{o.unite}</span>
          </span>
          {zone && (
            <span
              className="text-[12px] font-bold px-2.5 py-1 rounded-full"
              style={{ color: couleur, background: `${couleur}14` }}
            >
              {zone.label}
              {bornage && <span className="font-semibold opacity-80"> · {bornage}</span>}
            </span>
          )}
        </div>
        {/* Ce que le chiffre mesure, et d'où il vient. Sans cette ligne, rien ne
            dit que le CTR mélange deux régies — et on coupe Google en croyant
            lire Google. */}
        <p className="text-[10.5px] text-faint mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span>{PORTEE[o.key] ?? "sur la semaine"}</span>
          {groupe && (
            <>
              <span>·</span>
              <Glyphes sources={TERRAIN[o.key]?.sources ?? []} />
              <span>{PROVENANCE[groupe]}</span>
            </>
          )}
        </p>
        <Pente
          delta={delta}
          baisseEstBonne={o.direction === "down"}
          className="text-[12.5px] mt-1"
          base={
            <>
              vs la semaine dernière ({fmtVal(o, o.precedent ?? 0)}
              {o.unite})
            </>
          }
        />
      </div>

      {/* La trajectoire, avec ses zones en fond : la SEULE forme du module */}
      <div className="border-t border-line bg-black/[0.012] px-3 pt-3 pb-1.5">
        <LineChart
          labels={k.labels}
          series={[{ name: o.titre, color: "#1a56ff", values: o.points }]}
          height={210}
          fmt={(v) => fmtVal(o, v)}
          unit={o.unite}
          ariaLabel={`${o.titre} sur 10 semaines`}
          marqueurs={marqueurs}
          bandes={bandes.length > 0 ? bandes : undefined}
        />
        {/* Le comptage « N semaines où tu as appliqué une action » a disparu :
            il renvoyait à une section supprimée depuis, et chaque repère porte
            désormais son nom au survol de son point. */}
      </div>

      {/* Comment lire cet indicateur. Ce texte existait déjà, mais dans un
          `title=` de survol : sur un téléphone, une infobulle n'existe pas. */}
      {o.repere && (
        <details className="group border-t border-line">
          <summary className="cursor-pointer select-none list-none px-4 py-2.5 text-[11.5px] font-semibold text-brand">
            <span className="group-open:hidden">▸ Comment lire cet indicateur</span>
            <span className="hidden group-open:inline">▾ Comment lire cet indicateur</span>
          </summary>
          <p className="px-4 pb-3 -mt-0.5 text-[12px] text-muted leading-relaxed max-w-[62ch]">
            {o.repere}
          </p>
        </details>
      )}

      {/* Changer d'indicateur — chaque cellule porte sa valeur, sa pente et ses
          sources : le choix se fait en lisant, pas en cliquant neuf fois.

          LES GROUPES SONT DES BLOCS, plus trois titres posés dans une grille
          continue. En `contents`, la seule chose qui séparait « Ta pub » de
          « Ton Instagram » était six pixels de marge sous un mot gris : les
          neuf cellules se lisaient comme une seule liste, et le groupement —
          qui est justement ce que David a décidé de garder — ne se voyait pas.
          Chaque groupe a maintenant son cadre, son en-tête, et sa PROVENANCE
          écrite en toutes lettres à côté de ses glyphes. */}
      <div className="border-t border-line bg-black/[0.012] px-3 py-3 space-y-2">
        {groupes.map((g) => {
          const sources = sourcesGroupe(g.options.map((op) => op.key));
          return (
            <div key={g.nom} className="rounded-xl border border-line bg-white/60 p-2">
              <div className="flex items-baseline gap-2 px-0.5 pb-1.5">
                <span className="text-[9.5px] uppercase tracking-widest text-ink font-bold">
                  {g.nom}
                </span>
                <Glyphes sources={sources} />
                <span className="text-[10px] text-faint truncate">
                  {PROVENANCE[g.nom]}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                {g.options.map((op) => (
                  <Cellule
                    key={op.key}
                    o={op}
                    actif={op.key === cle}
                    onClick={() => setCle(op.key)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {orphelines.length > 0 && (
          <div className="rounded-xl border border-line bg-white/60 p-2">
            <div className="text-[9.5px] uppercase tracking-widest text-ink font-bold px-0.5 pb-1.5">
              Autres
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
              {orphelines.map((op) => (
                <Cellule
                  key={op.key}
                  o={op}
                  actif={op.key === cle}
                  onClick={() => setCle(op.key)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
