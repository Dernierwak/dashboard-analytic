"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { lienInstagram, type Params } from "@/lib/instagram/liens";
import { Icone } from "@/components/meta/elements";
import { METRIQUES, NOM_FORMAT } from "@/lib/instagram/lecture";
import {
  csvDuTableau,
  dateCourte,
  formaterValeur,
  formaterVisionnage,
  libellePlace,
  nomDuFichier,
  raisonPlace,
  TIRET,
  trier,
  type LigneTableau,
  type Ordre,
  type Tableau,
  type Tri,
} from "@/lib/instagram/tableau";

// ── MODULE 5 · LE TABLEAU DÉTAILLÉ « TOUS TES POSTS » ───────────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Tableau détaillé — Tous tes posts » ;
// user stories 26 et 27. Les lignes, leur place et leur tri viennent de
// `lib/instagram/tableau.ts` (testé) ; ce composant trie et télécharge.
//
// Le tri n'est pas dans l'URL : la spec n'y met que les Règles de lecture et
// le post ouvert (« L'état de la page vit dans l'URL »). Il s'ouvre sur la
// date, du plus récent au plus ancien (arbitrage du 2026-11-06), et l'export
// sort les lignes dans l'ordre de l'écran.

const TH = "sticky top-0 z-10 whitespace-nowrap border-b border-line bg-white py-3 font-medium";

/** `params` : un clic sur un post ouvre le Panneau (`?post=`) en gardant le
 *  reste de l'URL (`lienInstagram`). */
export function TableauPosts({ tableau, params }: { tableau: Tableau; params: Params }) {
  const [tri, setTri] = useState<Tri>("date");
  const [ordre, setOrdre] = useState<Ordre>("desc");
  const lignes = useMemo(() => trier(tableau.lignes, tri, ordre), [tableau.lignes, tri, ordre]);

  // Un nouvel en-tête trie du plus grand au plus petit — « mes meilleurs
  // posts de tous les temps » (user story 26) ; le même en-tête inverse.
  const choisir = (t: Tri) => {
    if (t === tri) setOrdre(ordre === "desc" ? "asc" : "desc");
    else {
      setTri(t);
      setOrdre("desc");
    }
  };

  const exporter = () => {
    // Le BOM fait lire l'UTF-8 à Excel : sans lui, « Été » arrive en « Ã‰tÃ© ».
    const blob = new Blob(["﻿", csvDuTableau(tableau, lignes)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomDuFichier(tableau);
    a.click();
    URL.revokeObjectURL(url);
  };

  const enTete = (t: Tri, nom: string, aide?: string, alignement = "text-right") => (
    <th key={t} scope="col" className={`${TH} px-3 ${alignement}`} aria-sort={tri === t ? (ordre === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => choisir(t)} title={aide} className={`${tri === t ? "text-ink" : "hover:text-ink"}`}>
        {nom}
        {tri === t && <span aria-hidden>{ordre === "asc" ? " ↑" : " ↓"}</span>}
      </button>
    </th>
  );

  return (
    <section aria-labelledby="titre-tous-tes-posts" className="min-w-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="titre-tous-tes-posts" className="text-[22px] font-semibold tracking-tight text-ink">
            Tous tes posts
          </h2>
          <p className="mt-1 text-[14px] text-muted">
            Tout l&apos;historique en base ({tableau.lignes.length}), sans filtre de période. La place se lit sur{" "}
            {METRIQUES[tableau.metrique].nom.toLowerCase()}, parmi les posts du même format des 12 derniers mois.
          </p>
        </div>
        {tableau.lignes.length > 0 && (
          <button
            type="button"
            onClick={exporter}
            title="Toutes les lignes, dans l'ordre affiché — pour Excel"
            className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 motion-reduce:transition-none"
          >
            Exporter en CSV <Icone nom="fleche" className="h-3.5 w-3.5 rotate-90" />
          </button>
        )}
      </div>

      {tableau.lignes.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-5 py-8 text-center text-[14px] text-muted">
          Aucun post en base pour ce compte.
        </p>
      ) : (
        <div className="max-h-[640px] min-w-0 overflow-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[1100px] text-[13.5px]">
            <thead>
              <tr className="text-[12px] text-muted">
                {enTete("date", "Date", "Date de publication", "text-left pl-5")}
                <th scope="col" className={`${TH} px-3 text-left`}>Post</th>
                <th scope="col" className={`${TH} px-3 text-left`}>Format</th>
                <th scope="col" className={`${TH} px-3 text-left`} title={METRIQUES[tableau.metrique].aide}>
                  Place · {METRIQUES[tableau.metrique].nom}
                </th>
                {tableau.colonnes.map((m) => enTete(m, METRIQUES[m].nom, METRIQUES[m].aide))}
                {enTete("visionnage", "Visionnage moyen", "Temps de visionnage moyen — Instagram ne le donne que pour un Reel")}
                {enTete("releve", "Dernier relevé", "Le jour où Pulse a lu ces chiffres chez Instagram", "text-right pr-5")}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <Ligne key={l.post.id} l={l} t={tableau} params={params} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[12.5px] text-muted">
        « {TIRET} » : Instagram n&apos;a rien rendu, ce n&apos;est pas un zéro. Un post de moins de 48 h, ou de plus de 12 mois, n&apos;a
        pas de place ; il en faut 6 du même format pour en donner une.
      </p>
    </section>
  );
}

function Ligne({ l, t, params }: { l: LigneTableau; t: Tableau; params: Params }) {
  const p = l.post;
  const place = libellePlace(l.place);
  // Un écarté par une Règle de lecture reste, grisé ; sa Place dit pourquoi
  // (spec, user story 28).
  const ecarte = l.place.etat === "ecarte";
  return (
    <tr className={`border-t border-line ${ecarte ? "bg-canvas/60 opacity-60" : ""}`}>
      <td className="whitespace-nowrap py-2.5 pl-5 pr-3 tabular-nums text-ink">{dateCourte(p.date)}</td>
      <td className="max-w-[260px] px-3 py-2.5">
        <Link
          href={lienInstagram(params, { post: p.id })}
          scroll={false}
          title={`Lire le post — ${p.legende || "sans légende"}`}
          className="flex min-w-0 items-center gap-2.5 hover:underline"
        >
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-md border border-line object-cover" />
          ) : (
            <span className="h-9 w-9 shrink-0 rounded-md border border-line bg-black/[0.04]" aria-hidden />
          )}
          <span className="min-w-0 truncate">{p.legende || "(sans légende)"}</span>
        </Link>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted">
        {p.format ? NOM_FORMAT[p.format] : "Format inconnu"}
        {p.boosteVuLe && (
          <span className="ml-1.5 rounded-full border border-line px-1.5 py-0.5 text-[11px] text-muted" title="Instagram a listé au moins une annonce sur ce post">
            Boosté
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5" title={raisonPlace(l.place)}>
        {place === null ? (
          <span className="text-faint">{TIRET}</span>
        ) : (
          <span className={l.place.etat === "place" ? "text-ink" : "text-faint"}>{place}</span>
        )}
      </td>
      {t.colonnes.map((m) => (
        <td key={m} className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${m === t.metrique ? "font-semibold text-ink" : "text-ink/75"}`}>
          {formaterValeur(m, l.valeurs[m])}
        </td>
      ))}
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink/75">{formaterVisionnage(l.visionnage)}</td>
      <td className="whitespace-nowrap py-2.5 pl-3 pr-5 text-right tabular-nums text-muted" title={p.releveA ? undefined : "Lu avant que Pulse date ses relevés"}>
        {dateCourte(p.releveA)}
      </td>
    </tr>
  );
}
