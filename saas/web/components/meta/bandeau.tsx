"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "@/components/meta/elements";
import { bornes, nombre, DEVISE, type Campagne, type CampagneChoisie, type Periode } from "@/lib/meta/lecture";
import { lienMeta, type Params } from "@/lib/meta/liens";

// ── MODULE 1 · LE BANDEAU DE COMMANDES (version minimale) ────────────────────
//
// Spec, § « Solution », module 1 ; user stories 1, 9. Il porte le titre, la
// date à laquelle Pulse a lu Meta, le choix de la campagne et la période. Le
// menu avec recherche et pastilles, les raccourcis, le calendrier sur deux mois
// et la pilule flottante viennent au ticket 07 ; ici, des contrôles natifs.
//
// Pas de période « Tout » (elle n'a pas de période d'avant), pas de filtre par
// statut (spec, Out of Scope). Chaque geste change UN paramètre de l'URL et
// garde les autres (`lienMeta`).

export function BandeauMeta({
  lecture,
  params,
  campagnes,
  campagneChoisie,
  periode,
  hier,
}: {
  lecture: string;
  params: Params;
  campagnes: Campagne[];
  campagneChoisie: CampagneChoisie | null;
  periode: Periode;
  /** La borne haute des dates choisissables : le jour en cours est exclu. */
  hier: string;
}) {
  const router = useRouter();
  const aller = (patch: Record<string, string | null>) => router.push(lienMeta(params, patch), { scroll: false });
  const [de, setDe] = useState(periode.debut);
  const [a, setA] = useState(periode.fin);
  const choixValide = de !== "" && a !== "" && de <= a && a <= hier;
  const choixNeuf = de !== periode.debut || a !== periode.fin;
  const duree = `${periode.jours} jour${periode.jours > 1 ? "s" : ""}`;

  return (
    <header className="sticky top-0 z-30 -mx-4 bg-canvas/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-[18px] font-semibold text-white" aria-hidden>M</span>
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-ink">Meta Ads</h1>
            <p className="text-[12.5px] text-muted">{lecture}</p>
          </div>
        </div>

        <label className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
          <Icone nom="calques" className="h-4 w-4 shrink-0" />
          <span className="sr-only">Campagne</span>
          <select
            className="h-10 min-w-0 max-w-[280px] rounded-full border border-line bg-white px-3.5 text-[13.5px] font-medium text-ink hover:border-ink/20"
            value={campagneChoisie?.cle ?? ""}
            onChange={(e) => aller({ campagne: e.target.value || null })}
          >
            <option value="">Toutes les campagnes</option>
            {campagneChoisie && !campagneChoisie.connue && (
              <option value={campagneChoisie.cle}>Campagne sans donnée sur ces dates</option>
            )}
            {campagnes.map((c) => (
              <option key={c.cle} value={c.cle}>
                {c.nom || "Campagne sans nom"}
                {c.sansId ? " (avant l'identifiant Meta)" : ""} · {nombre(c.depense)} {DEVISE}
              </option>
            ))}
          </select>
        </label>

        <form
          className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-muted"
          onSubmit={(e) => {
            e.preventDefault();
            if (choixValide) aller({ from: de, to: a });
          }}
        >
          <Icone nom="calendrier" className="h-4 w-4 shrink-0" />
          <label className="sr-only" htmlFor="periode-de">Premier jour</label>
          <input id="periode-de" type="date" max={hier} value={de} onChange={(e) => setDe(e.target.value)}
            className="h-10 rounded-full border border-line bg-white px-3 text-[13.5px] text-ink tabular-nums" />
          <span aria-hidden>→</span>
          <label className="sr-only" htmlFor="periode-a">Dernier jour</label>
          <input id="periode-a" type="date" max={hier} value={a} onChange={(e) => setA(e.target.value)}
            className="h-10 rounded-full border border-line bg-white px-3 text-[13.5px] text-ink tabular-nums" />
          {choixNeuf && (
            <button type="submit" disabled={!choixValide}
              className="h-10 rounded-full bg-ink px-4 text-[13.5px] font-medium text-white disabled:opacity-40">
              Afficher
            </button>
          )}
          {!periode.parDefaut && (
            <button type="button" onClick={() => aller({ from: null, to: null })}
              className="h-10 rounded-full px-3 text-[13.5px] font-medium text-brand hover:bg-white">
              Revenir à la semaine mesurée
            </button>
          )}
        </form>
      </div>

      <p className="mt-3 text-[12.5px] text-muted">
        {periode.parDefaut ? "Semaine mesurée" : duree} :{" "}
        <span className="text-ink">{bornes(periode.debut, periode.fin)}</span>, comparée aux {duree} d&apos;avant ({bornes(periode.avantDebut, periode.avantFin)}).
        {periode.rognee && " Le jour en cours n'est jamais compté : la période s'arrête hier."}
        {periode.arreteeAuDernierJourLu && " La dernière récolte a échoué : la période s'arrête au dernier jour lu."}
        {campagneChoisie && !campagneChoisie.connue && " La campagne demandée n'a aucune ligne sur ces dates : les chiffres sont vides, pas nuls."}
      </p>
    </header>
  );
}
