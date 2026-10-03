"use client";

import { Courbe } from "@/components/courbe";
import { PastilleEcart } from "@/components/meta/elements";
import { dateBulle, formaterValeur, type MetriqueTendance } from "@/lib/meta/lecture";

// ── MODULE 3 · LA TENDANCE ───────────────────────────────────────────────────
//
// Spec, § « Solution », module 3 ; user stories 19, 20, 21, 28. Le TOTAL de la
// sélection jour par jour — pas une ligne par campagne : le filtre campagne
// resserre, la Comparaison (ticket 08) détaille. Un graphe par métrique de la
// vue, la principale en grand ; la période d'avant en pointillé, alignée jour
// pour jour, pour lire l'écart sans calcul. Un jour sans ligne est un trou.
//
// Grammaire, carte par carte : le nom (rang 1), LE chiffre (rang 3, le plus
// gros, avant toute forme), la période d'avant et l'écart (rang 5), la courbe
// en dernier.
//
// Composant client parce que la courbe suit le pointeur et reçoit une fonction
// de format — une fonction ne traverse pas la frontière serveur → client.
// Les points de changement s'y poseront au ticket 11.

export function Tendance({
  metriques,
  dates,
  datesAvant,
  sujet,
}: {
  metriques: MetriqueTendance[];
  dates: string[];
  datesAvant: string[];
  /** « toutes tes campagnes », ou le nom de celle choisie. */
  sujet: string;
}) {
  const [principale, ...autres] = metriques;
  return (
    <section aria-labelledby="titre-tendance">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="titre-tendance" className="text-[22px] font-semibold tracking-tight text-ink">Tendance</h2>
          <p className="mt-1 text-[14px] text-muted">Le total de {sujet}, jour par jour.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded-full bg-brand" /> Cette période</span>
          <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-faint" /> Période d&apos;avant</span>
          <span title="Un jour sans aucune ligne récoltée n'est pas un zéro : la courbe s'y interrompt.">Un trou = aucun chiffre ce jour-là</span>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Carte m={principale} dates={dates} datesAvant={datesAvant} grande lignes={Math.max(1, autres.length)} />
        {autres.map((m) => (
          <Carte key={m.cle} m={m} dates={dates} datesAvant={datesAvant} />
        ))}
      </div>
    </section>
  );
}

function Carte({
  m,
  dates,
  datesAvant,
  grande = false,
  lignes = 1,
}: {
  m: MetriqueTendance;
  dates: string[];
  datesAvant: string[];
  grande?: boolean;
  lignes?: number;
}) {
  const format = (v: number) => formaterValeur(m.cle, v);
  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5 sm:p-6 ${grande ? "lg:col-span-2" : ""}`}
      style={grande ? { gridRow: `span ${lignes}` } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1 text-[13px] font-normal text-muted">
            {m.nom}
            <span className="cursor-help text-faint" title={m.aide} aria-label={m.aide}>ⓘ</span>
          </h3>
          <p className={`mt-2 font-semibold leading-none tracking-tight text-ink tabular-nums ${grande ? "text-[44px]" : "text-[28px]"}`}>
            {formaterValeur(m.cle, m.valeur)}
          </p>
          <p className="mt-2 text-[12px] text-faint">
            contre {formaterValeur(m.cle, m.avant)} la période d&apos;avant
          </p>
        </div>
        <PastilleEcart m={m.cle} e={m.ecart} />
      </div>
      <div className={`mt-auto min-w-0 ${grande ? "pt-6" : "pt-4"}`}>
        <Courbe
          titre={`${m.nom}, jour par jour, cette période et la période d'avant`}
          format={format}
          hauteur={grande ? (lignes >= 2 ? 300 : 220) : 120}
          series={[
            { nom: "Période d'avant", valeurs: m.serieAvant, etiquettes: datesAvant.map(dateBulle), pointille: true },
            { nom: "Cette période", valeurs: m.serie, etiquettes: dates.map(dateBulle) },
          ]}
        />
      </div>
    </div>
  );
}
