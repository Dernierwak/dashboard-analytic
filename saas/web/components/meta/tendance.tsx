"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Courbe, type Repere } from "@/components/courbe";
import { PastilleEcart } from "@/components/meta/elements";
import type { MarqueJour } from "@/lib/meta/changements";
import { dateBulle, formaterValeur, type MetriqueTendance } from "@/lib/meta/lecture";
import { lienMeta, type Params } from "@/lib/meta/liens";
import { ORANGE_REPERE } from "@/lib/palette";

// ── MODULE 3 · LA TENDANCE ───────────────────────────────────────────────────
//
// Spec, § « Solution », module 3 ; user stories 19 à 28. Le TOTAL de la
// sélection jour par jour — pas une ligne par campagne : le filtre campagne
// resserre, la Comparaison (ticket 08) détaille. Un graphe par métrique de la
// vue, la principale en grand ; la période d'avant en pointillé, alignée jour
// pour jour, pour lire l'écart sans calcul. Un jour sans ligne est un trou.
//
// Les jours où Meta déclare un changement portent un point sur la courbe
// PRINCIPALE seulement (ticket 11) — sur les trois, il se lirait trois fois.
// Un clic ouvre le jour dans le Panneau latéral : il n'écrit que `jour` dans
// l'URL et retire `annonce` (un seul panneau, user story 44).
//
// Grammaire, carte par carte : le nom (rang 1), LE chiffre (rang 3, le plus
// gros, avant toute forme), la période d'avant et l'écart (rang 5), la courbe
// en dernier.
//
// Composant client parce que la courbe suit le pointeur et reçoit une fonction
// de format — une fonction ne traverse pas la frontière serveur → client.

/** Ce que le journal ne couvre pas. Dit ICI, et nulle part ailleurs (décision
 *  du ticket 08 de la carte) : la liste suit `_ACTIVITES` de
 *  `saas/collecte/meta/fetch_meta_ads.py`, et doit changer avec elle. */
const NE_COUVRE_PAS =
  "Les points viennent du journal que Meta tient de ton compte, et Pulse n'en garde que les budgets, les statuts, " +
  "le ciblage, les visuels, les enchères et les créations de campagnes, de groupes d'annonces et d'annonces. " +
  "Tout autre geste n'a pas de point, pas plus que ce que Meta fait de lui-même, comme la revue des annonces. " +
  "Un jour sans point n'est donc pas un jour où rien n'a changé.";

const libelle = (n: number) => `${n} changement${n > 1 ? "s" : ""} · clique pour ${n > 1 ? "les" : "le"} voir`;

export function Tendance({
  metriques,
  dates,
  datesAvant,
  sujet,
  marques,
  params,
}: {
  metriques: MetriqueTendance[];
  dates: string[];
  datesAvant: string[];
  /** « toutes tes campagnes », ou le nom de celle choisie. */
  sujet: string;
  /** Les jours qui portent un point ; `null` = le journal n'a pas pu être lu. */
  marques: MarqueJour[] | null;
  params: Params;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [aide, setAide] = useState(false);
  const ouvrirJour = (i: number) =>
    demarrer(() => router.push(lienMeta(params, { jour: dates[i], annonce: null }), { scroll: false }));
  const reperes: Repere[] = (marques ?? []).map((m) => ({ index: m.index, libelle: libelle(m.nombre) }));

  const [principale, ...autres] = metriques;
  return (
    <section aria-labelledby="titre-tendance" aria-busy={enCours}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="titre-tendance" className="text-[22px] font-semibold tracking-tight text-ink">Tendance</h2>
          <p className="mt-1 text-[14px] text-muted">Le total de {sujet}, jour par jour.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded-full bg-brand" /> Cette période</span>
          <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-faint" /> Période d&apos;avant</span>
          {marques === null ? (
            <span className="text-warn">Le journal des changements n&apos;a pas pu être lu : aucun point posé</span>
          ) : (
            <span className="relative flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: ORANGE_REPERE }} /> Un changement dans ton compte
              {/* Un vrai bouton qui déplie le texte : un `title` seul ne
                  s'ouvre ni au clavier ni au doigt, et c'est la seule place
                  où cette limite est dite. */}
              <button
                type="button"
                onClick={() => setAide((x) => !x)}
                onBlur={() => setAide(false)}
                aria-expanded={aide}
                aria-controls="aide-journal"
                aria-label="Ce que le journal des changements ne couvre pas"
                title={NE_COUVRE_PAS}
                className="cursor-help rounded-full text-faint hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                ⓘ
              </button>
              {aide && (
                <span
                  id="aide-journal"
                  role="note"
                  className="absolute right-0 top-full z-20 mt-2 w-[min(340px,calc(100vw-32px))] rounded-xl bg-ink/95 px-3 py-2.5 text-[12.5px] leading-snug text-white shadow-xl"
                >
                  {NE_COUVRE_PAS}
                </span>
              )}
            </span>
          )}
          <span title="Un jour sans aucune ligne récoltée n'est pas un zéro : la courbe s'y interrompt.">Un trou = aucun chiffre ce jour-là</span>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Carte
          m={principale}
          dates={dates}
          datesAvant={datesAvant}
          grande
          lignes={Math.max(1, autres.length)}
          reperes={reperes}
          onRepere={ouvrirJour}
        />
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
  reperes,
  onRepere,
}: {
  m: MetriqueTendance;
  dates: string[];
  datesAvant: string[];
  grande?: boolean;
  lignes?: number;
  reperes?: Repere[];
  onRepere?: (index: number) => void;
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
          {m.precision && <p className="mt-2 text-[12.5px] text-muted">{m.precision}</p>}
          {m.attention && <p className="mt-1 text-[12.5px] font-medium text-warn">{m.attention}</p>}
          <p className="mt-2 text-[12px] text-faint">
            contre {formaterValeur(m.cle, m.avant)} la période d&apos;avant
          </p>
        </div>
        <PastilleEcart m={m.cle} e={m.ecart} />
      </div>
      <div className={`mt-auto min-w-0 ${grande ? "pt-6" : "pt-4"}`}>
        {/* Rien à tracer — une période sans ligne, ou des résultats de types
            mélangés que le total refuse d'additionner : une phrase, pas un
            axe à zéro qui se lirait comme un zéro (ticket 18 pour `Courbe`). */}
        {m.serie.every((v) => v === null) && m.serieAvant.every((v) => v === null) ? (
          <p className="rounded-xl bg-canvas px-4 py-6 text-center text-[12.5px] text-muted">Aucun chiffre à tracer sur cette période.</p>
        ) : (
          <Courbe
            titre={`${m.nom}, jour par jour, cette période et la période d'avant`}
            format={format}
            hauteur={grande ? (lignes >= 2 ? 300 : 220) : 120}
            series={[
              { nom: "Période d'avant", valeurs: m.serieAvant, etiquettes: datesAvant.map(dateBulle), pointille: true },
              { nom: "Cette période", valeurs: m.serie, etiquettes: dates.map(dateBulle) },
            ]}
            reperes={reperes}
            onRepere={onRepere}
          />
        )}
      </div>
    </div>
  );
}
