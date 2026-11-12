"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Courbe } from "@/components/courbe";
import { ReperType } from "@/components/google/elements";
import { Icone } from "@/components/meta/elements";
import {
  GRIS_NON_COCHE,
  NOMS_NIVEAUX,
  TOUT_COCHER,
  basculerCoche,
  choixMetrique,
  couleurDePlace,
  placesVersUrl,
  type Comparaison as DonneesComparaison,
  type ElementCompare,
  type Niveau,
} from "@/lib/google/comparaison";
import { DEVISE, METRIQUES, TIRET, dateBulle, formaterValeur, nombre, type CleMetrique } from "@/lib/google/lecture";
import { lienGoogle, type Params } from "@/lib/google/liens";

// ── MODULE 4 · LA COMPARAISON ────────────────────────────────────────────────
//
// Spec, § « Comparaison — la mécanique » ; décision : ticket 16 de la carte
// (variante A). Écrit en partant de `components/meta/comparaison.tsx`, son
// propre code (ADR 0011).
//
// Mise en page : CELLE DE META (David, 2026-11-12 : « il faut que ce soit
// exactement la même chose sur Google Ads ») — les réglages ; puis le nuage à
// gauche et la liste, sur une colonne qui défile, à droite ; puis les deux
// graphes jour par jour côte à côte, un par métrique. Ce que Google garde à
// lui : le Type de campagne, le troisième niveau (Campagnes), et le nuage qui
// montre en gris les lignes non cochées.
//
// Tout ce qui change l'état est un LIEN (type, niveau, métriques, cases, « Tout
// cocher ») : un lien partagé rouvre la même comparaison. Changer de type ou de
// niveau retire `comparer` : on repart du pré-cochage, les cases d'un niveau ne
// désignent rien dans l'autre (user story 44). On coche autant de lignes qu'on
// veut (David, 2026-11-12 : « pas que ce soit maximum 5 »).
//
// Pas d'« Aperçu » sur une annonce : il arrive avec le ticket 08 (Lire une
// annonce), qui récolte son contenu. Avant lui il n'y aurait rien à ouvrir, et
// une cible inerte promettrait ce que la page ne fait pas.

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
            <div className="grid border-b border-line lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
              <div className="min-w-0 border-b border-line p-5 lg:border-b-0 lg:border-r">
                <Nuage c={c} />
              </div>
              <div className="min-w-0 p-3">
                <Liste c={c} params={params} />
              </div>
            </div>
            <div className="p-5">
              <DeuxGraphes c={c} dates={dates} />
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

function Pastille({ n }: { n: 1 | 2 }) {
  return (
    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#efeee9] text-[11px] font-semibold text-muted" aria-hidden>
      {n}
    </span>
  );
}

function Pastilles({ nom, choix }: { nom: string; choix: { cle: string; texte: string; href: string; actif: boolean; note?: string }[] }) {
  return (
    <nav className="inline-flex min-w-0 max-w-full flex-wrap rounded-2xl bg-[#efeee9] p-1" aria-label={nom}>
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
  );
}

// Le type, le niveau, puis DEUX métriques dans un menu chacune, comme Meta :
// la première classe la liste, place les lignes à l'horizontale et trace le
// premier graphe ; la seconde, la verticale et le second graphe. Les métriques
// offertes sont celles de la vue (spec : « deux métriques de la vue »).
function Reglages({ c, params }: { c: DonneesComparaison; params: Params }) {
  // Le pré-cochage : `comparer` retiré dès que type ou niveau change.
  const repartir = { comparer: null };
  const [ouvert, setOuvert] = useState<0 | 1 | null>(null);
  useEffect(() => {
    if (ouvert === null) return;
    const clic = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.("[data-menu-metrique]")) setOuvert(null);
    };
    const touche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(null);
    document.addEventListener("click", clic);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("click", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
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
          nom="Niveau comparé"
          choix={c.niveaux.map((n) => ({
            cle: n,
            texte: NOMS_NIVEAUX[n],
            href: c.niveau === n ? lienGoogle(params, {}) : lienGoogle(params, { niveau: n, ...repartir }),
            actif: c.niveau === n,
            note: n === "groupes" ? "Groupes d'annonces et groupes d'éléments Performance Max" : undefined,
          }))}
        />
      )}
      {([0, 1] as const).map((rang) => {
        const actuelle = c.metriques[rang];
        const id = `menu-metrique-${rang + 1}`;
        return (
          <div key={rang} className="relative flex min-w-0 items-center gap-2" data-menu-metrique>
            <Pastille n={(rang + 1) as 1 | 2} />
            <button
              type="button"
              onClick={() => setOuvert((x) => (x === rang ? null : rang))}
              aria-expanded={ouvert === rang}
              aria-controls={id}
              aria-label={`Métrique ${rang + 1} : ${METRIQUES[actuelle].nom}`}
              className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-ink bg-ink px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-ink/90 motion-reduce:transition-none"
            >
              {METRIQUES[actuelle].nom}
              <Icone nom="chevron" className="h-3.5 w-3.5" />
            </button>
            {ouvert === rang && (
              <div
                id={id}
                className="absolute left-0 top-full z-20 mt-2 max-h-[360px] w-[250px] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(14,15,18,0.25)]"
              >
                {c.offertes.map((m) => {
                  const actif = actuelle === m;
                  const autre = m === c.metriques[1 - rang];
                  return (
                    <Link
                      key={m}
                      href={lienGoogle(params, choixMetrique(c.metriques, rang, m))}
                      scroll={false}
                      onClick={() => setOuvert(null)}
                      aria-current={actif ? "true" : undefined}
                      className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13.5px] ${
                        actif ? "bg-[#eef2ff] font-medium text-brand" : "text-ink hover:bg-canvas"
                      }`}
                    >
                      {METRIQUES[m].nom}
                      {actif ? (
                        <Icone nom="coche" className="h-3.5 w-3.5" />
                      ) : autre ? (
                        <span className="text-[11px] text-faint">échange avec la {2 - rang}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
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

// TOUTES les lignes du niveau, classées sur la métrique 1, avec leur barre et
// la valeur des deux métriques sous le nom. Sur une colonne, à côté du nuage,
// dans une fenêtre qui défile : la page ne s'allonge pas avec le nombre
// d'annonces.
function Liste({ c, params }: { c: DonneesComparaison; params: Params }) {
  const [m1, m2] = c.metriques;
  // La barre se rapporte à la plus grande valeur MESURÉE ; un « — » n'en a pas.
  const max = Math.max(0, ...c.elements.map((e) => e.valeurs[0] ?? 0));
  const nbCoches = c.places.filter((x) => x !== null).length;

  const ligne = (e: ElementCompare, rang: number) => {
    const coche = e.place !== null;
    const couleur = coche ? couleurDePlace(e.place!) : null;
    const largeur = e.valeurs[0] === null || max === 0 ? 0 : (e.valeurs[0] / max) * 100;
    const niveauLu = NIVEAU_LU[e.niveau];
    const etiquette = `${coche ? "Décocher" : "Cocher"} ${e.nom || "sans nom"}${e.sous ? `, ${e.sous}` : ""}${e.type ? `, ${e.type.libelle}` : ""}`;
    return (
      <div key={e.cle} className="min-w-0">
        <Link
          href={lienGoogle(params, { comparer: placesVersUrl(basculerCoche(c.places, e.cle)) })}
          scroll={false}
          aria-label={etiquette}
          className={`flex w-full min-w-0 items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand ${
            coche ? "bg-[#f6f7ff]" : "hover:bg-canvas"
          }`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors motion-reduce:transition-none ${
              coche ? "border-transparent text-white" : "border-[#cfcec8] text-transparent"
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
        </Link>
      </div>
    );
  };

  const lienTexte =
    "rounded-full px-2.5 py-1 text-[12px] font-medium text-brand transition-colors hover:bg-[#eef2ff] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2">
        <span className="text-[12px] tabular-nums text-muted">
          {nbCoches} cochée{nbCoches > 1 ? "s" : ""} sur {c.elements.length}
        </span>
        <span className="flex gap-1">
          {nbCoches < c.elements.length && (
            <Link href={lienGoogle(params, { comparer: [TOUT_COCHER] })} scroll={false} className={lienTexte}>
              Tout cocher
            </Link>
          )}
          {nbCoches > 0 && (
            <Link href={lienGoogle(params, { comparer: placesVersUrl([]) })} scroll={false} className={lienTexte}>
              Tout décocher
            </Link>
          )}
        </span>
      </div>
      <div className="max-h-[480px] overflow-y-auto overscroll-contain">
        <div className="grid gap-y-1">{c.elements.map((e, i) => ligne(e, i + 1))}</div>
      </div>
      <p className="px-3 pt-2 text-[11.5px] text-faint">
        {c.elements.length} ligne{c.elements.length > 1 ? "s" : ""} · coche-en autant que tu veux. Classées sur « {METRIQUES[m1].nom} »
        {METRIQUES[m1].hausseBonne === false ? ", de la moins chère à la plus chère" : ", de la plus haute à la plus basse"} ; « — » en dernier = rien de mesuré.
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
// Aucun nom sur le graphe : chaque point coché porte son RANG de la liste,
// dans le point, et la liste d'à côté écrit rang, couleur et nom. Un rang
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
  if (places.length === 0) {
    return <p className="py-16 text-center text-[14px] text-muted">Aucune ligne n&apos;a de chiffre sur les deux métriques : rien à placer.</p>;
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

  return (
    <figure className="mx-auto min-w-0 max-w-[760px]">
      <svg
        viewBox={`0 0 ${L} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${METRIQUES[m1].nom} à l'horizontale, ${METRIQUES[m2].nom} à la verticale, sur toute la période ; taille = coût`}
      >
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
          const couleur = e.place !== null ? couleurDePlace(e.place) : GRIS_NON_COCHE;
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
      <figcaption className="mt-3 text-[12px] leading-relaxed text-faint">
        Sur toute la période. La taille d&apos;un point suit son coût ; en gris, les lignes non cochées du même niveau.
        {absents > 0 && <> {absents} ligne{absents > 1 ? "s" : ""} sans chiffre (« — ») ne se place{absents > 1 ? "nt" : ""} pas.</>}
      </figcaption>
    </figure>
  );
}

// ── Les deux graphes jour par jour ───────────────────────────────────────────

function DeuxGraphes({ c, dates }: { c: DonneesComparaison; dates: string[] }) {
  if (c.coches.length === 0) {
    return <p className="py-16 text-center text-[14px] text-muted">Coche une ligne dans la liste pour suivre son évolution.</p>;
  }
  const etiquettes = dates.map(dateBulle);
  return (
    <div className="min-w-0">
      {/* La légende : le nom à côté de la couleur, toujours (les teintes
          reviennent au-delà de huit), et le rang de la liste. */}
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Lignes comparées">
        {c.coches.map((s) => (
          <li key={s.cle} className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
            <span className="h-[2px] w-4 shrink-0 rounded-full" style={{ background: s.couleur }} />
            <span className="shrink-0 tabular-nums text-faint">{c.elements.findIndex((e) => e.cle === s.cle) + 1}</span>
            <span className="truncate">{s.nom || "Sans nom"}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-6 lg:grid-cols-2">
        {([0, 1] as const).map((k) => {
          const m = c.metriques[k];
          return (
            <div key={`${k}-${m}`} className="min-w-0">
              <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-ink">
                <Pastille n={(k + 1) as 1 | 2} />
                {METRIQUES[m].nom}, jour par jour
                <span className="cursor-help font-normal text-faint" title={METRIQUES[m].aide} aria-label={METRIQUES[m].aide}>
                  ⓘ
                </span>
              </p>
              <Courbe
                titre={`${METRIQUES[m].nom} jour par jour, par ligne cochée`}
                format={(v) => formaterValeur(m, v)}
                hauteur={240}
                series={c.coches.map((s) => ({ nom: s.nom || "Sans nom", valeurs: s.series[k], etiquettes, couleur: s.couleur }))}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">Jour en cours exclu ; un jour sans chiffre est un trou, pas un zéro.</p>
    </div>
  );
}
