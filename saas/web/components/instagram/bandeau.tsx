"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChoixPeriode } from "@/components/meta/bandeau";
import { bornes, type Periode, type Raccourci } from "@/lib/meta/lecture";
import { lienInstagram, type Params } from "@/lib/instagram/liens";

// ── LE BANDEAU DE COMMANDES INSTAGRAM ────────────────────────────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Bandeau de commandes ». La période
// est celle de Meta — mêmes raccourcis, même calendrier (`ChoixPeriode`),
// même défaut : les 7 jours qui finissent la veille du dernier Jour de
// travail (arbitrage du 2026-11-06). Elle choisit les points posés sur le
// nuage, jamais la référence : la phrase sous le titre le dit.
//
// `reglages` : la place du bouton « Règles de lecture » (ticket 12), à côté
// de la période.

export function BandeauInstagram({
  params,
  periode,
  raccourcis,
  hier,
  reglages,
}: {
  params: Params;
  periode: Periode;
  raccourcis: Raccourci[];
  hier: string;
  reglages?: ReactNode;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const jours = `${periode.jours} jour${periode.jours > 1 ? "s" : ""}`;

  return (
    <header aria-busy={enCours} className="py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-4">
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7b4fff] text-[18px] font-semibold text-white" aria-hidden>
            ◎
          </span>
          <h1 className="truncate text-[24px] font-semibold leading-tight tracking-tight text-ink">Instagram</h1>
        </div>
        <div className={`relative flex min-w-0 items-center gap-2 ${enCours ? "opacity-70" : ""}`}>
          {reglages}
          <ChoixPeriode
            periode={periode}
            raccourcis={raccourcis}
            hier={hier}
            compact={false}
            choisir={(from, to) => demarrer(() => router.push(lienInstagram(params, { from, to }), { scroll: false }))}
          />
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-muted">
        {periode.parDefaut ? "Semaine mesurée" : jours} : <span className="text-ink">{bornes(periode.debut, periode.fin)}</span>. Elle choisit
        les posts posés sur les graphes ; la référence, elle, reste tes 12 derniers mois.
        {periode.rognee && " Le jour en cours n'est jamais compté : la période s'arrête hier."}
      </p>
    </header>
  );
}
