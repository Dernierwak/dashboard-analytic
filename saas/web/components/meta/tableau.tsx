"use client";

import { useState } from "react";
import { Icone, PastilleEcart } from "@/components/meta/elements";
import { bornes, formaterValeur, METRIQUES, VUES } from "@/lib/meta/lecture";
import { csvDuTableau, nomDuFichier, type LigneTableau, type Tableau } from "@/lib/meta/tableau";

// ── MODULE 5 · LE TABLEAU DÉTAILLÉ ───────────────────────────────────────────
//
// Spec, § « Solution », module 5 ; user stories 47 à 51. Tout le détail,
// Campagne › Groupe d'annonces › Annonce, dans les colonnes de la vue active ;
// l'arbre et ses chiffres viennent de `lib/meta/tableau.ts` (testé), ce
// composant ne fait que déplier et télécharger. Mise en page : celle du
// prototype validé (ticket 05), sans la lecture T (le rang de l'asset).
//
// Le dépliage n'est pas dans l'URL : la spec n'en fait pas un état de la page,
// et l'export sort toutes les lignes, dépliées ou non.
//
// Composant client pour le dépliage et le téléchargement.

const RETRAIT = 28;

export function TableauDetaille({ tableau }: { tableau: Tableau }) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const basculer = (cle: string) =>
    setOuverts((o) => {
      const s = new Set(o);
      if (s.has(cle)) s.delete(cle);
      else s.add(cle);
      return s;
    });
  const parents = tableau.lignes.flatMap((c) => [c.cle, ...c.enfants.map((g) => g.cle)]);
  const toutOuvert = parents.length > 0 && parents.every((c) => ouverts.has(c));

  const exporter = () => {
    // Le BOM fait lire l'UTF-8 à Excel : sans lui, « Été » arrive en « Ã‰tÃ© ».
    const blob = new Blob(["﻿", csvDuTableau(tableau)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomDuFichier(tableau);
    a.click();
    URL.revokeObjectURL(url);
  };

  const principale = METRIQUES[tableau.metriques[0]];
  const lignes: { l: LigneTableau; rang: number }[] = [];
  const empiler = (l: LigneTableau, rang: number) => {
    lignes.push({ l, rang });
    if (ouverts.has(l.cle)) for (const e of l.enfants) empiler(e, rang + 1);
  };
  for (const l of tableau.lignes) empiler(l, 0);

  return (
    <section aria-labelledby="titre-tableau" className="min-w-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="titre-tableau" className="text-[22px] font-semibold tracking-tight text-ink">Tableau détaillé</h2>
          <p className="mt-1 text-[14px] text-muted">
            Campagne › groupe d&apos;annonces › annonce, sur {bornes(tableau.debut, tableau.fin)}. Les colonnes suivent la vue {VUES[tableau.vue].titre}.
          </p>
        </div>
        {tableau.lignes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOuverts(toutOuvert ? new Set() : new Set(parents))}
              className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-[#f6f7ff] motion-reduce:transition-none"
            >
              {toutOuvert ? "Tout replier" : "Tout déplier"}
            </button>
            <button
              type="button"
              onClick={exporter}
              title="Toutes les lignes, dépliées ou non, avec la vue, la campagne et la période affichées"
              className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 motion-reduce:transition-none"
            >
              Exporter en CSV <Icone nom="fleche" className="h-3.5 w-3.5 rotate-90" />
            </button>
          </div>
        )}
      </div>

      {tableau.lignes.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-5 py-8 text-center text-[14px] text-muted">
          Aucune annonce n&apos;a tourné sur cette période{tableau.campagne ? ` dans « ${tableau.campagne} »` : ""}.
        </p>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-right text-[12px] text-muted">
                <th scope="col" className="py-3.5 pl-5 text-left font-medium">Campagne › groupe d&apos;annonces › annonce</th>
                {tableau.metriques.map((m) => (
                  <th key={m} scope="col" className="whitespace-nowrap px-4 py-3.5 font-medium" title={METRIQUES[m].aide}>
                    {METRIQUES[m].nom}
                  </th>
                ))}
                <th scope="col" className="whitespace-nowrap py-3.5 pl-2 pr-5 font-medium">{principale.nom} vs avant</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ l, rang }) => (
                <Ligne key={l.cle} t={tableau} l={l} rang={rang} ouvert={ouverts.has(l.cle)} basculer={basculer} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[12.5px] text-muted">
        « — » : rien de mesuré, ce n&apos;est pas un zéro. Chaque ligne calcule ses ratios sur ses propres totaux — une campagne n&apos;est pas la moyenne de ses groupes.
      </p>
    </section>
  );
}

function Ligne({
  t,
  l,
  rang,
  ouvert,
  basculer,
}: {
  t: Tableau;
  l: LigneTableau;
  rang: number;
  ouvert: boolean;
  basculer: (cle: string) => void;
}) {
  const depliable = l.enfants.length > 0;
  const nom = (
    <span className={`min-w-0 truncate ${rang === 0 ? "text-[15px] font-semibold text-ink" : "text-[14px] text-ink"}`} title={l.nom}>
      {l.nom || "Sans nom"}
    </span>
  );
  return (
    <tr className={`border-t border-line ${ouvert ? "bg-[#fafaf8]" : "bg-white"}`}>
      <td className="max-w-[420px] py-3 pr-4" style={{ paddingLeft: 20 + rang * RETRAIT }}>
        {depliable ? (
          <button
            type="button"
            onClick={() => basculer(l.cle)}
            aria-expanded={ouvert}
            className="group flex w-full min-w-0 items-center gap-2.5 text-left"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-transform group-hover:bg-[#f1f0ec] motion-reduce:transition-none ${ouvert ? "" : "-rotate-90"}`}
            >
              <Icone nom="chevron" className="h-3.5 w-3.5" />
            </span>
            {l.couleur && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.couleur }} aria-hidden />}
            {nom}
          </button>
        ) : (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="h-6 w-6 shrink-0" />
            {nom}
          </span>
        )}
      </td>
      {t.metriques.map((m, i) => (
        <td key={m} className="whitespace-nowrap px-4 py-3 text-right">
          <span className={`tabular-nums ${i === 0 ? "text-[15px] font-semibold text-ink" : "text-[14px] text-ink/75"}`}>
            {formaterValeur(m, l.valeurs[i])}
          </span>
        </td>
      ))}
      <td className="py-3 pl-2 pr-5 text-right">
        <PastilleEcart m={t.metriques[0]} e={l.ecart} />
      </td>
    </tr>
  );
}
