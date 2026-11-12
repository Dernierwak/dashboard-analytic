"use client";

import Link from "next/link";
import { useState } from "react";
import { Courbe } from "@/components/courbe";
import { ReperType } from "@/components/google/elements";
import { Icone } from "@/components/meta/elements";
import {
  GRIS_NON_COCHE,
  MAX_COMPARES,
  NOMS_NIVEAUX,
  PALETTE_COMPARES,
  basculerCoche,
  choixMetrique,
  placesVersUrl,
  type Comparaison as DonneesComparaison,
  type ElementCompare,
  type Niveau,
} from "@/lib/google/comparaison";
import { DEVISE, METRIQUES, TIRET, dateBulle, formaterValeur, nombre, type CleMetrique } from "@/lib/google/lecture";
import { lienGoogle, type Params } from "@/lib/google/liens";

// ── MODULE 4 · LA COMPARAISON (variante A) ───────────────────────────────────
//
// Spec, § « Comparaison — la mécanique » ; décision : ticket 16 de la carte
// (variante A, David, 2026-11-11 : « c'est assez simple »). Écrit en partant
// de `components/meta/comparaison.tsx`, son propre code (ADR 0011).
//
// Mise en page : les réglages au-dessus (Type, Niveau, deux métriques), la
// liste à cocher sur deux colonnes, puis côte à côte le nuage de la période et
// la courbe jour par jour des cochées.
//
// Tout ce qui change l'état est un LIEN (type, niveau, métriques, courbe,
// cases) : un lien partagé rouvre la même comparaison. Seul le refus d'une
// cinquième case est un état local : il n'y a rien à écrire dans l'URL.
// Changer de type ou de niveau retire `comparer` : on repart du pré-cochage,
// les cases d'un niveau ne désignent rien dans l'autre (user story 44).
//
// « Lire » sur une annonce (spec, user story 45) arrive avec le ticket 08, qui
// ouvre le Panneau latéral : avant lui il n'y aurait rien à ouvrir, et une
// cible inerte promettrait ce que la page ne fait pas.

export function Comparaison({
  comparaison: c,
  dates,
  params,
  sujet,
}: {
  comparaison: DonneesComparaison;
  dates: string[];
  params: Params;
  sujet: string;
}) {
  const [refus, setRefus] = useState<string | null>(null);
  return (
    <section aria-labelledby="titre-comparaison">
      <div className="mb-5 min-w-0">
        <h2 id="titre-comparaison" className="text-[22px] font-semibold tracking-tight text-ink">Comparaison</h2>
        <p className="mt-1 text-[14px] text-muted">Qui fait mieux que qui dans {sujet}, et comment ça évolue jour par jour.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line p-5">
          <Reglages c={c} params={params} />
          {c.pmaxSansAnnonces && (
            <p className="mt-3 text-[12.5px] text-muted">
              Performance Max n&apos;a pas d&apos;annonces : ses campagnes s&apos;arrêtent au groupe d&apos;éléments, au niveau Groupes.
            </p>
          )}
        </div>
        {c.elements.length === 0 ? (
          <p className="px-5 py-16 text-center text-[14px] text-muted">{VIDE[c.niveau]}</p>
        ) : (
          <>
            <div className="border-b border-line p-3">
              <Liste c={c} params={params} refus={refus} refuser={setRefus} />
            </div>
            <div className="grid lg:grid-cols-2">
              <div className="min-w-0 border-b border-line p-5 lg:border-b-0 lg:border-r">
                <Nuage c={c} />
              </div>
              <div className="min-w-0 p-5">
                <CourbeDesCochees c={c} dates={dates} params={params} />
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const VIDE: Record<Niveau, string> = {
  campagnes: "Aucune campagne n'a de chiffres sur cette période.",
  groupes: "Aucun groupe n'a de chiffres sur cette période.",
  annonces: "Aucune annonce n'a de chiffres sur cette période.",
};

// ── Les réglages ─────────────────────────────────────────────────────────────

function Pastilles({ nom, choix }: { nom: string; choix: { cle: string; texte: string; href: string; actif: boolean; note?: string }[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11.5px] font-medium text-muted">{nom}</p>
      <nav className="inline-flex max-w-full flex-wrap rounded-2xl bg-[#efeee9] p-1" aria-label={nom}>
        {choix.map((x) => (
          <Link
            key={x.cle}
            href={x.href}
            scroll={false}
            aria-current={x.actif ? "true" : undefined}
            title={x.note}
            className={`flex h-8 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
              x.actif ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {x.texte}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function Reglages({ c, params }: { c: DonneesComparaison; params: Params }) {
  // Le pré-cochage : `comparer` retiré dès que type ou niveau change.
  const repartir = { comparer: null };
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      {/* Une campagne choisie au Bandeau impose son type : le réglage n'aurait
          plus qu'un choix. Un seul type sur la période, de même. */}
      {!c.typeImpose && c.types.length > 1 && (
        <Pastilles
          nom="Type de campagne"
          choix={[
            { cle: "tous", texte: "Tous", href: lienGoogle(params, { type: null, ...repartir }), actif: c.type === null },
            ...c.types.map((t) => ({ cle: t.cle, texte: t.libelle, href: lienGoogle(params, { type: t.cle, ...repartir }), actif: c.type === t.cle })),
          ]}
        />
      )}
      {c.niveaux.length > 1 && (
        <Pastilles
          nom="Niveau"
          choix={c.niveaux.map((n) => ({
            cle: n,
            texte: NOMS_NIVEAUX[n],
            href: c.niveau === n ? lienGoogle(params, {}) : lienGoogle(params, { niveau: n, ...repartir }),
            actif: c.niveau === n,
            note: n === "groupes" ? "Groupes d'annonces et groupes d'éléments Performance Max" : undefined,
          }))}
        />
      )}
      {([0, 1] as const).map((rang) => (
        <Pastilles
          key={rang}
          nom={rang === 0 ? "Axe horizontal · classe la liste" : "Axe vertical"}
          choix={c.offertes.map((m) => ({
            cle: m,
            texte: METRIQUES[m].nom,
            href: lienGoogle(params, choixMetrique(c.metriques, rang, m)),
            actif: c.metriques[rang] === m,
            note: m === c.metriques[1 - rang] ? `Échange avec l'axe ${rang === 0 ? "vertical" : "horizontal"}` : undefined,
          }))}
        />
      ))}
    </div>
  );
}

// ── La liste ─────────────────────────────────────────────────────────────────

/** Une valeur, et la raison de son « — » au survol. */
function Valeur({ m, v, raison, fort = false }: { m: CleMetrique; v: number | null; raison: string | null; fort?: boolean }) {
  const texte = formaterValeur(m, v);
  return (
    <span className={`tabular-nums ${fort ? "text-[13.5px] font-semibold text-ink" : "text-muted"}`} title={v === null ? raison ?? undefined : undefined}>
      {texte}
      {v === null && raison && <span className="sr-only"> ({raison})</span>}
    </span>
  );
}

const NIVEAU_LU: Record<ElementCompare["niveau"], string | null> = {
  campagne: null,
  groupe: "Groupe d'annonces",
  groupe_elements: "Groupe d'éléments",
  annonce: null,
};

function Liste({ c, params, refus, refuser }: { c: DonneesComparaison; params: Params; refus: string | null; refuser: (cle: string | null) => void }) {
  const [m1, m2] = c.metriques;
  // La barre se rapporte à la plus grande valeur MESURÉE ; un « — » n'en a pas.
  const max = Math.max(0, ...c.elements.map((e) => e.valeurs[0] ?? 0));
  const plein = c.places.filter((x) => x !== null).length >= MAX_COMPARES;

  const ligne = (e: ElementCompare, rang: number) => {
    const coche = e.place !== null;
    const couleur = coche ? PALETTE_COMPARES[e.place!] : null;
    const refusee = refus === e.cle;
    const largeur = e.valeurs[0] === null || max === 0 ? 0 : (e.valeurs[0] / max) * 100;
    const niveauLu = NIVEAU_LU[e.niveau];
    const contenu = (
      <>
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors motion-reduce:transition-none ${
            coche ? "border-transparent text-white" : refusee ? "border-neg text-transparent" : plein ? "border-dashed border-[#cfcec8] text-transparent" : "border-[#cfcec8] text-transparent"
          }`}
          style={couleur ? { background: couleur } : undefined}
          aria-hidden
        >
          <Icone nom="coche" className="h-3.5 w-3.5" />
        </span>
        <span className="mt-0.5 w-5 shrink-0 text-[12px] tabular-nums text-faint">{rang}</span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-start gap-2">
            <span className="line-clamp-2 min-w-0 flex-1 text-[13.5px] leading-snug text-ink [overflow-wrap:anywhere]" title={e.nom || undefined}>
              {e.nom || "Sans nom"}
            </span>
            {/* L'étiquette du type sur chaque ligne (David, ticket 16 : « les
                petits labels […] j'aime bien »). */}
            {e.type && <ReperType type={e.type} />}
          </span>
          {(niveauLu || e.sous) && (
            <span className="block truncate text-[11.5px] text-faint">
              {niveauLu}
              {niveauLu && e.sous && " · "}
              {e.sous}
            </span>
          )}
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#efeee9]">
            <span
              className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${largeur}%`, background: couleur ?? "#b8b7b0" }}
            />
          </span>
          <span className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px]">
            <span className="whitespace-nowrap">
              <span className="text-faint">{METRIQUES[m1].nom} </span>
              <Valeur m={m1} v={e.valeurs[0]} raison={e.raisons[0]} fort />
            </span>
            <span className="whitespace-nowrap">
              <span className="text-faint">{METRIQUES[m2].nom} </span>
              <Valeur m={m2} v={e.valeurs[1]} raison={e.raisons[1]} />
            </span>
          </span>
        </span>
      </>
    );
    const classes =
      "flex w-full min-w-0 items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand";
    const resultat = basculerCoche(c.places, e.cle);
    const etiquette = `${coche ? "Décocher" : "Cocher"} ${e.nom || "sans nom"}${e.sous ? `, ${e.sous}` : ""}${e.type ? `, ${e.type.libelle}` : ""}`;

    // La cinquième case se REFUSE, visiblement : elle reste à sa place, son
    // cadre passe en rouge et une phrase dit quoi faire — aucune autre n'est
    // décochée pour elle (user story 43).
    return (
      <div key={e.cle} className="min-w-0">
        {resultat === "refus" ? (
          <button
            type="button"
            onClick={() => refuser(e.cle)}
            aria-label={etiquette}
            aria-describedby="refus-comparaison"
            className={`${classes} cursor-not-allowed ${refusee ? "bg-[#fbe9e7]" : "hover:bg-canvas"}`}
          >
            {contenu}
          </button>
        ) : (
          <Link
            href={lienGoogle(params, { comparer: placesVersUrl(resultat) })}
            scroll={false}
            onClick={() => refuser(null)}
            aria-label={etiquette}
            className={`${classes} ${coche ? "bg-[#f6f7ff]" : "hover:bg-canvas"}`}
          >
            {contenu}
          </Link>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Sur deux colonnes (spec, user story 40), dans une fenêtre qui défile :
          la page ne s'allonge pas avec le nombre d'annonces. */}
      <div className="max-h-[440px] overflow-y-auto overscroll-contain">
        <div className="grid gap-x-4 gap-y-1 md:grid-cols-2">{c.elements.map((e, i) => ligne(e, i + 1))}</div>
      </div>
      <p id="refus-comparaison" className="px-3 pt-2 text-[11.5px] text-faint" aria-live="polite">
        {refus ? (
          <span className="font-medium text-neg">{MAX_COMPARES} au maximum : décoche une ligne pour en comparer une autre.</span>
        ) : (
          <>
            {c.elements.length} ligne{c.elements.length > 1 ? "s" : ""} · coche jusqu&apos;à {MAX_COMPARES}. Classées sur « {METRIQUES[m1].nom} »
            {METRIQUES[m1].hausseBonne === false ? ", de la moins chère à la plus chère" : ", de la plus haute à la plus basse"} ; « — » en dernier = rien de mesuré.
          </>
        )}
      </p>
    </div>
  );
}

// ── Le nuage de la période ───────────────────────────────────────────────────
//
// Axes = les deux métriques choisies ; taille du point = son coût (surface ∝
// coût, rayon ∝ racine) ; non cochées en gris, cochées de la couleur de leur
// place (ticket 16, variante A).
//
// LES NOMS QUI SE CHEVAUCHENT (point laissé ouvert au ticket 16 : au premier
// tour de maquette, les noms posés à côté des points serrés se recouvraient).
// Aucun nom sur le graphe : chaque point coché porte son RANG de la liste,
// dans le point, et la légende dessous écrit rang, couleur et nom. Un rang
// tient dans le point même quand deux points se recouvrent en partie, et deux
// annonces homonymes s'y distinguent — la grammaire du Croisement de Meta.

const L = 560;
const H = 340;
const MARGES = { g: 84, d: 24, h: 24, b: 40 };

function etendue(vs: number[]): [number, number] {
  const bas = Math.min(...vs);
  const haut = Math.max(...vs);
  // Une marge pour loger les plus gros points au bord ; une seule valeur
  // (un point, ou tous égaux) s'entoure de sa propre grandeur.
  const marge = (haut - bas || Math.abs(haut) || 1) * 0.15;
  return [Math.max(0, bas - marge), haut + marge];
}

function Nuage({ c }: { c: DonneesComparaison }) {
  const [m1, m2] = c.metriques;
  const places = c.elements.filter((e) => e.valeurs[0] !== null && e.valeurs[1] !== null);
  const absents = c.elements.length - places.length;
  const titre = `${METRIQUES[m2].nom} selon ${METRIQUES[m1].nom}, sur toute la période`;
  if (places.length === 0) {
    return (
      <figure className="min-w-0">
        <p className="text-[14px] font-semibold text-ink">{titre}</p>
        <p className="py-16 text-center text-[14px] text-muted">Aucune ligne n&apos;a de chiffre sur les deux métriques : rien à placer.</p>
      </figure>
    );
  }
  const [x0, x1] = etendue(places.map((e) => e.valeurs[0]!));
  const [y0, y1] = etendue(places.map((e) => e.valeurs[1]!));
  const sx = (v: number) => MARGES.g + ((v - x0) / (x1 - x0)) * (L - MARGES.g - MARGES.d);
  const sy = (v: number) => H - MARGES.b - ((v - y0) / (y1 - y0)) * (H - MARGES.h - MARGES.b);
  const maxCout = Math.max(0, ...places.map((e) => e.cout ?? 0));
  const rayon = (e: ElementCompare) => 5 + 13 * Math.sqrt(maxCout === 0 ? 0 : (e.cout ?? 0) / maxCout);
  const graduations = (a: number, b: number) => [a, (a + b) / 2, b];
  // Les cochées dessinées en dernier : jamais cachées par une grise.
  const ordre = [...places].sort((a, b) => Number(a.place !== null) - Number(b.place !== null));
  const rang = (e: ElementCompare) => c.elements.indexOf(e) + 1;
  const cochees = c.elements.filter((e) => e.place !== null).sort((a, b) => a.place! - b.place!);

  return (
    <figure className="min-w-0">
      <p className="mb-2 text-[14px] font-semibold text-ink">{titre}</p>
      <svg viewBox={`0 0 ${L} ${H}`} className="block h-auto w-full" role="img" aria-label={`${METRIQUES[m1].nom} à l'horizontale, ${METRIQUES[m2].nom} à la verticale ; taille = coût`}>
        {graduations(x0, x1).map((v, i) => (
          <g key={`x${i}`}>
            <line x1={sx(v)} x2={sx(v)} y1={MARGES.h} y2={H - MARGES.b} stroke="#efeee9" />
            <text x={sx(v)} y={H - MARGES.b + 16} fontSize={11} fill="#8b8e98" textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>
              {formaterValeur(m1, v)}
            </text>
          </g>
        ))}
        {graduations(y0, y1).map((v, i) => (
          <g key={`y${i}`}>
            <line x1={MARGES.g} x2={L - MARGES.d} y1={sy(v)} y2={sy(v)} stroke="#efeee9" />
            <text x={MARGES.g - 6} y={sy(v) + 4} fontSize={11} fill="#8b8e98" textAnchor="end">
              {formaterValeur(m2, v)}
            </text>
          </g>
        ))}
        <text x={L - MARGES.d} y={H - 6} fontSize={11.5} fill="#5b6070" textAnchor="end">
          {METRIQUES[m1].nom} →
        </text>
        <text x={MARGES.g} y={14} fontSize={11.5} fill="#5b6070">
          ↑ {METRIQUES[m2].nom}
        </text>
        {ordre.map((e) => {
          const x = sx(e.valeurs[0]!);
          const y = sy(e.valeurs[1]!);
          const r = rayon(e);
          const couleur = e.place !== null ? PALETTE_COMPARES[e.place] : GRIS_NON_COCHE;
          return (
            <g key={e.cle}>
              <title>{`${rang(e)}. ${e.nom || "Sans nom"} · ${METRIQUES[m1].nom} ${formaterValeur(m1, e.valeurs[0])} · ${METRIQUES[m2].nom} ${formaterValeur(m2, e.valeurs[1])} · coût ${e.cout === null ? TIRET : `${nombre(e.cout, 2)} ${DEVISE}`}`}</title>
              <circle cx={x} cy={y} r={r} fill={couleur} fillOpacity={e.place !== null ? 0.88 : 0.55} stroke="#fff" strokeWidth={1.5} />
              {e.place !== null && (
                <text x={x} y={y + 4} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#fff">
                  {rang(e)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {cochees.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-label="Lignes cochées">
          {cochees.map((e) => (
            <li key={e.cle} className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE_COMPARES[e.place!] }} />
              <span className="shrink-0 tabular-nums text-faint">{rang(e)}</span>
              <span className="truncate">{e.nom || "Sans nom"}</span>
            </li>
          ))}
        </ul>
      )}
      <figcaption className="mt-2 text-[11.5px] leading-relaxed text-faint">
        Taille d&apos;un point : son coût sur la période. En gris : les lignes non cochées du même niveau.
        {absents > 0 && <> {absents} ligne{absents > 1 ? "s" : ""} sans chiffre (« — ») ne se place{absents > 1 ? "nt" : ""} pas.</>}
      </figcaption>
    </figure>
  );
}

// ── La courbe des cochées ────────────────────────────────────────────────────

function CourbeDesCochees({ c, dates, params }: { c: DonneesComparaison; dates: string[]; params: Params }) {
  const k = c.metriques.indexOf(c.courbe) as 0 | 1;
  const m = c.courbe;
  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          {METRIQUES[m].nom}, jour par jour
          <span className="cursor-help font-normal text-faint" title={METRIQUES[m].aide} aria-label={METRIQUES[m].aide}>
            ⓘ
          </span>
        </p>
        {/* La courbe bascule entre les deux métriques des réglages. */}
        <nav className="flex gap-1" aria-label="Métrique de la courbe">
          {c.metriques.map((x, i) => (
            <Link
              key={x}
              href={lienGoogle(params, { courbe: i === 0 ? null : x })}
              scroll={false}
              aria-current={x === m ? "true" : undefined}
              className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-colors motion-reduce:transition-none ${
                x === m ? "bg-ink text-white" : "bg-canvas text-muted hover:text-ink"
              }`}
            >
              {METRIQUES[x].nom}
            </Link>
          ))}
        </nav>
      </div>
      {c.coches.length === 0 ? (
        <p className="py-16 text-center text-[14px] text-muted">Coche une ligne dans la liste pour suivre son évolution.</p>
      ) : (
        <>
          <Courbe
            titre={`${METRIQUES[m].nom} jour par jour, par ligne cochée`}
            format={(v) => formaterValeur(m, v)}
            hauteur={260}
            series={c.coches.map((s) => ({ nom: s.nom || "Sans nom", valeurs: s.series[k], etiquettes: dates.map(dateBulle), couleur: s.couleur }))}
          />
          <p className="mt-2 text-[11.5px] text-faint">Jour en cours exclu ; un jour sans chiffre est un trou, pas un zéro.</p>
        </>
      )}
    </div>
  );
}
