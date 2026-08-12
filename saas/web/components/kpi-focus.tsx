"use client";

import { useState } from "react";
import { LineChart } from "@/components/line-chart";
import { marqueursCourbe } from "@/components/etat-action";
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
// pour les neuf, et chaque terrain dit sa provenance sous le chiffre.
const TERRAIN: Record<string, { groupe: string; court: string }> = {
  roas: { groupe: "Ta pub", court: "ROAS" },
  ctr: { groupe: "Ta pub", court: "CTR" },
  cpc: { groupe: "Ta pub", court: "Coût / clic" },
  spend: { groupe: "Ta pub", court: "Dépense" },
  clics: { groupe: "Ta pub", court: "Clics" },
  eng: { groupe: "Ton Instagram", court: "Engagement" },
  reach: { groupe: "Ton Instagram", court: "Portée / post" },
  vues: { groupe: "Ton Instagram", court: "Vues" },
  trafic: { groupe: "Ton site", court: "Sessions" },
};
const ORDRE_GROUPES = ["Ta pub", "Ton Instagram", "Ton site"];
const PROVENANCE: Record<string, string> = {
  "Ta pub": "Meta + Google confondus",
  "Ton Instagram": "Instagram",
  "Ton site": "Google Analytics",
};
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

// Une cellule du sélecteur : le nom, la valeur, la pente. Trois informations,
// pas quatre — la pastille de couleur par cellule que portait la maquette
// répéterait neuf fois ce que l'en-tête de groupe dit trois fois, et c'est
// justement les 20 px horizontaux qui font tenir la cellule sur un téléphone.
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
  const court = TERRAIN[o.key]?.court ?? o.titre;
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-2.5 py-2 transition-colors ${
        actif
          ? "bg-ink text-white border-ink"
          : "bg-white border-line hover:bg-black/[0.03]"
      }`}
      title={o.titre}
    >
      <span
        className={`block text-[9.5px] uppercase tracking-wide font-bold truncate ${
          actif ? "text-white/60" : "text-faint"
        }`}
      >
        {court}
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
        <p className="text-[10.5px] text-faint mt-1.5">
          {PORTEE[o.key] ?? "sur la semaine"}
          {groupe && <> · {PROVENANCE[groupe]}</>}
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

      {/* Changer d'indicateur — chaque pastille porte sa valeur et sa pente :
          le choix se fait en lisant, pas en cliquant neuf fois. */}
      <div className="border-t border-line bg-black/[0.012] px-3 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
          {groupes.map((g) => (
            <div key={g.nom} className="contents">
              <div className="col-span-full text-[9.5px] uppercase tracking-widest text-faint font-bold pt-1.5 first:pt-0">
                {g.nom}
              </div>
              {g.options.map((op) => (
                <Cellule
                  key={op.key}
                  o={op}
                  actif={op.key === cle}
                  onClick={() => setCle(op.key)}
                />
              ))}
            </div>
          ))}
          {orphelines.length > 0 && (
            <div className="contents">
              <div className="col-span-full text-[9.5px] uppercase tracking-widest text-faint font-bold pt-1.5">
                Autres
              </div>
              {orphelines.map((op) => (
                <Cellule
                  key={op.key}
                  o={op}
                  actif={op.key === cle}
                  onClick={() => setCle(op.key)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
