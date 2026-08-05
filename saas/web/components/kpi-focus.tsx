"use client";

import { useState } from "react";
import { LineChart } from "@/components/line-chart";
import type { KpiFocus, KpiOption } from "@/lib/report";

// « Ta boussole » — le module de l'indicateur qui compte.
//
// Un chiffre seul ne décide rien. Ce module donne les trois choses qui le
// rendent actionnable en trois secondes :
//   1. sa VALEUR, en grand
//   2. sa ZONE — « tu perds / fragile / sain / scalable ». C'est elle qui
//      transforme « ROAS 2,4 » en « je peux augmenter les budgets »
//   3. sa TRAJECTOIRE sur 10 semaines — un niveau ne vaut rien sans sa pente
//
// Et il est PILOTABLE : l'indicateur ouvert par défaut est celui de ton
// objectif, mais tu bascules sur n'importe quel autre d'un doigt — on ne sait
// jamais mieux que toi ce que tu as envie de regarder ce jour-là.

const TONE: Record<string, string> = {
  neg: "#c0392b",
  warn: "#b86b00",
  pos: "#1a7a4a",
};

function fmtVal(o: KpiOption, v: number): string {
  if (o.key === "reach" || o.key === "clics") return Math.round(v).toLocaleString("fr-CH");
  if (o.key === "spend") return Math.round(v).toLocaleString("fr-CH");
  return v.toFixed(o.key === "cpc" ? 2 : 1);
}

export function KpiFocusCard({ k }: { k: KpiFocus }) {
  const [cle, setCle] = useState(k.defaut);
  const o = k.options.find((x) => x.key === cle) ?? k.options[0];
  if (!o) return null;

  const bandes = o.bandes ?? [];
  const bornes = bandes.map((b) => b.max).filter((m): m is number => m !== null);
  const echelle = bornes.length ? bornes[bornes.length - 1] * 1.35 : Math.max(o.valeur, 1);
  const zone = bandes.find((b) => b.max === null || o.valeur < b.max) ?? bandes[bandes.length - 1];
  const couleur = TONE[zone?.tone ?? "warn"] ?? TONE.warn;

  const delta =
    o.precedent !== null && o.precedent !== 0
      ? ((o.valeur - o.precedent) / Math.abs(o.precedent)) * 100
      : null;
  const stable = delta !== null && Math.abs(delta) < 0.5;
  const bon = delta === null ? null : o.direction === "down" ? delta < 0 : delta > 0;
  const deltaCls = delta === null || stable ? "text-faint" : bon ? "text-pos" : "text-neg";

  return (
    <div className="bg-white border border-line rounded-2xl shadow-card overflow-hidden">
      <div className="p-5 sm:p-6">
        {/* Le surtitre dit CE QU'ON REGARDE ; le chiffre vient tout de suite
            après. Les boutons de sélection sont passés sous le module : neuf
            pastilles au-dessus de la valeur, c'était la télécommande avant
            l'écran — sur un téléphone, ~145 px de contrôles à traverser pour
            atteindre le seul chiffre qui compte. */}
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
            </span>
          )}
        </div>
        {delta !== null && (
          <div className={`text-[12.5px] font-semibold mt-1.5 ${deltaCls}`}>
            {stable ? "≈ stable" : `${delta > 0 ? "▲ +" : "▼ "}${delta.toFixed(0)} %`}
            <span className="text-faint font-normal">
              {" "}vs la semaine dernière ({fmtVal(o, o.precedent!)}
              {o.unite})
            </span>
          </div>
        )}

        {/* La jauge : les zones nommées, et où tu te situes dedans */}
        {bandes.length > 0 && (
          <div className="mt-5" title={o.repere ?? undefined}>
            <div className="flex h-2.5 rounded-full overflow-hidden">
              {bandes.map((b, i) => {
                const bas = i === 0 ? 0 : bandes[i - 1].max ?? 0;
                const haut = b.max ?? echelle;
                return (
                  <div
                    key={b.label}
                    style={{
                      width: `${Math.max(0, ((haut - bas) / echelle) * 100)}%`,
                      background: TONE[b.tone] ?? TONE.warn,
                      opacity: 0.3,
                    }}
                  />
                );
              })}
            </div>
            <div className="relative h-0">
              <div
                className="absolute -top-[13px] h-[17px] w-[3px] rounded-full"
                style={{
                  left: `calc(${Math.max(0, Math.min(99.5, (o.valeur / echelle) * 100))}% - 1.5px)`,
                  background: couleur,
                }}
              />
            </div>
            {/* Les zones ET leurs bornes. « sain » ne veut rien dire tant
                qu'on ne sait pas où ça commence. */}
            <div className="relative h-[13px] mt-2">
              {bandes.map((b, i) => {
                const bas = i === 0 ? 0 : bandes[i - 1].max ?? 0;
                if (i === 0) return null;
                return (
                  <span
                    key={`b-${b.label}`}
                    className="absolute top-0 font-mono text-[9.5px] text-faint -translate-x-1/2"
                    style={{ left: `${Math.min(98, (bas / echelle) * 100)}%` }}
                  >
                    {bas.toLocaleString("fr-CH")}
                  </span>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-faint">
              {bandes.map((b) => (
                <span key={b.label}>{b.label}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* La trajectoire : un niveau ne veut rien dire sans sa pente */}
      <div className="border-t border-line bg-black/[0.012] px-2 pt-3 pb-1">
        <LineChart
          labels={k.labels}
          series={[{ name: o.titre, color: "#1a56ff", values: o.points }]}
          height={130}
          fmt={(v) => fmtVal(o, v)}
          unit={o.unite}
          ariaLabel={`${o.titre} sur 10 semaines`}
          markers={k.markers}
        />
        {(k.markers?.length ?? 0) > 0 && (
          <p className="text-[10px] text-faint px-3 pb-1.5">
            <span className="text-brand">▲</span> une semaine où tu as appliqué une action
          </p>
        )}
      </div>

      {/* Changer d'indicateur : une rangée qui défile horizontalement plutôt
          que quatre lignes de pastilles repliées. */}
      <div className="border-t border-line px-3 py-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {k.options.map((op) => (
            <button
              key={op.key}
              onClick={() => setCle(op.key)}
              className={`shrink-0 text-[11.5px] font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                op.key === cle
                  ? "bg-ink text-white border-ink"
                  : "border-line text-muted hover:bg-black/[0.03] bg-white"
              }`}
            >
              {op.titre}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
