"use client";

import Link from "next/link";
import { useState } from "react";
import { Courbe } from "@/components/courbe";
import { Icone } from "@/components/meta/elements";
import {
  MAX_COMPARES,
  METRIQUES,
  NOMS_NIVEAUX,
  PALETTE_COMPARES,
  VUES,
  basculerCoche,
  choixMetrique,
  dateBulle,
  formaterValeur,
  placesVersUrl,
  type Comparaison as DonneesComparaison,
  type ElementCompare,
  type Niveau,
  type Vue,
} from "@/lib/meta/lecture";
import { lienMeta, type Params } from "@/lib/meta/liens";

// ── MODULE 4 · LA COMPARAISON ────────────────────────────────────────────────
//
// Spec, § « Comparaison — la mécanique » ; user stories 29 à 33, 35, 36.
// Mise en page C2 (spec, Notes, choix 1) : les réglages, la liste classée sur
// deux colonnes, puis les deux graphes côte à côte en pleine largeur — le
// brief dit « un ou deux line plots côte à côte ».
//
// Tout ce qui change l'état est un LIEN (niveau, métriques, cases) : l'URL le
// porte, un lien partagé rouvre la même comparaison. Seul le refus d'une
// cinquième case est un état local : il n'y a rien à écrire dans l'URL.
//
// Grammaire : la liste porte le chiffre (la valeur de la métrique 1, en gras)
// avant la barre ; les graphes viennent après.
//
// La cible « Lire » d'une annonce n'est PAS ici : ticket 12.

export function Comparaison({
  comparaison: c,
  vue,
  dates,
  params,
  sujet,
  vignettes,
}: {
  comparaison: DonneesComparaison;
  vue: Vue;
  dates: string[];
  params: Params;
  sujet: string;
  /** L'image de chaque annonce, par son ID — quand la récolte des créas
   *  (ticket 05) l'a écrite. */
  vignettes: Record<string, string>;
}) {
  const [refus, setRefus] = useState<string | null>(null);
  const noms = NOMS_NIVEAUX[c.niveau];
  return (
    <section aria-labelledby="titre-comparaison">
      <div className="mb-5 min-w-0">
        <h2 id="titre-comparaison" className="text-[22px] font-semibold tracking-tight text-ink">Comparaison</h2>
        <p className="mt-1 text-[14px] text-muted">
          Qui fait mieux que qui dans {sujet}, et comment ça évolue jour par jour.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line p-5">
          <Reglages c={c} vue={vue} params={params} />
        </div>
        {c.elements.length === 0 ? (
          <p className="px-5 py-16 text-center text-[14px] text-muted">
            Aucun{c.niveau === "annonces" ? "e annonce n'a" : " groupe d'annonces n'a"} de chiffres sur cette période.
          </p>
        ) : (
          <>
            <div className="border-b border-line p-3">
              <Liste c={c} params={params} vignettes={vignettes} refus={refus} refuser={setRefus} />
            </div>
            <div className="p-5">
              <DeuxGraphes c={c} dates={dates} niveau={noms.un.toLowerCase()} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Pastille({ n }: { n: 1 | 2 }) {
  return (
    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#efeee9] text-[11px] font-semibold text-muted" aria-hidden>
      {n}
    </span>
  );
}

// Le niveau, puis DEUX métriques : la première classe la liste et trace le
// premier graphe, la seconde trace le second. Changer de niveau repart du
// pré-cochage : les cases d'un niveau ne désignent rien dans l'autre.
function Reglages({ c, vue, params }: { c: DonneesComparaison; vue: Vue; params: Params }) {
  const niveaux: Niveau[] = ["groupes", "annonces"];
  const metriques = VUES[vue].metriques;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <nav className="grid min-w-0 max-w-full grid-cols-2 rounded-full bg-[#efeee9] p-1" aria-label="Niveau comparé">
        {niveaux.map((n) => (
          <Link
            key={n}
            href={lienMeta(params, c.niveau === n ? {} : { niveau: n, comparer: null })}
            scroll={false}
            aria-current={c.niveau === n ? "true" : undefined}
            className={`flex h-8 items-center justify-center whitespace-nowrap rounded-full px-3 text-[13px] sm:px-4 font-medium transition-colors motion-reduce:transition-none ${
              c.niveau === n ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {NOMS_NIVEAUX[n].des}
          </Link>
        ))}
      </nav>
      {([0, 1] as const).map((rang) => (
        <div key={rang} className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label={`Métrique ${rang + 1}`}>
          <Pastille n={(rang + 1) as 1 | 2} />
          {metriques.map((m) => {
            const actif = c.metriques[rang] === m;
            return (
              <Link
                key={m}
                href={lienMeta(params, choixMetrique(c.metriques, rang, m))}
                scroll={false}
                aria-current={actif ? "true" : undefined}
                title={actif ? undefined : m === c.metriques[1 - rang] ? "Échange les deux métriques" : undefined}
                className={`flex h-8 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors motion-reduce:transition-none ${
                  actif ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ink/20 hover:text-ink"
                }`}
              >
                {METRIQUES[m].nom}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// La liste : TOUS les éléments de la sélection, classés sur la métrique 1, avec
// leur barre et la valeur des deux métriques. Sur deux colonnes, elle se lit
// de haut en bas, colonne après colonne — pas en zigzag.
function Liste({
  c,
  params,
  vignettes,
  refus,
  refuser,
}: {
  c: DonneesComparaison;
  params: Params;
  vignettes: Record<string, string>;
  refus: string | null;
  refuser: (cle: string | null) => void;
}) {
  const [m1, m2] = c.metriques;
  // La barre se rapporte à la plus grande valeur MESURÉE ; un « — » n'en a pas.
  const max = Math.max(0, ...c.elements.map((e) => e.valeurs[0] ?? 0));
  const plein = c.places.filter((x) => x !== null).length >= MAX_COMPARES;
  const moitie = Math.ceil(c.elements.length / 2);
  const colonnes = [c.elements.slice(0, moitie), c.elements.slice(moitie)];
  const nomNiveau = NOMS_NIVEAUX[c.niveau].un;

  const entete = (
    <div className="flex items-center gap-3 px-3 pb-2 text-[11.5px] text-faint" aria-hidden>
      <span className="w-5 shrink-0" />
      <span className="w-5 shrink-0">#</span>
      {c.niveau === "annonces" && <span className="w-9 shrink-0" />}
      <span className="min-w-0 flex-1">{nomNiveau}</span>
      <span className="flex shrink-0 flex-col items-end sm:flex-row sm:gap-3">
        <span className="text-right sm:w-[84px]">{METRIQUES[m1].nom}</span>
        <span className="text-right sm:w-[76px]">{METRIQUES[m2].nom}</span>
      </span>
    </div>
  );

  const ligne = (e: ElementCompare, rang: number) => {
    const coche = e.place !== null;
    const couleur = coche ? PALETTE_COMPARES[e.place!] : null;
    const refusee = refus === e.cle;
    const largeur = e.valeurs[0] === null || max === 0 ? 0 : (e.valeurs[0] / max) * 100;
    const contenu = (
      <>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors motion-reduce:transition-none ${
            coche ? "border-transparent text-white" : refusee ? "border-neg text-transparent" : plein ? "border-dashed border-[#cfcec8] text-transparent" : "border-[#cfcec8] text-transparent"
          }`}
          style={couleur ? { background: couleur } : undefined}
          aria-hidden
        >
          <Icone nom="coche" className="h-3.5 w-3.5" />
        </span>
        <span className="w-5 shrink-0 text-[12px] tabular-nums text-faint">{rang}</span>
        {c.niveau === "annonces" && <Vignette url={e.annonceId ? vignettes[e.annonceId] : undefined} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] text-ink">{e.nom || "Sans nom"}</span>
          <span className="block truncate text-[11.5px] text-faint">{e.sous}</span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#efeee9]">
            <span
              className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${largeur}%`, background: couleur ?? "#b8b7b0" }}
            />
          </span>
        </span>
        {/* Au téléphone, les deux valeurs s'empilent : côte à côte, elles
            laissaient quatre lettres au nom (vu à 390 px). */}
        <span className="flex shrink-0 flex-col items-end sm:flex-row sm:items-center sm:gap-3">
          <span className="text-right text-[14px] font-semibold tabular-nums text-ink sm:w-[84px]">{formaterValeur(m1, e.valeurs[0])}</span>
          <span className="text-right text-[13px] tabular-nums text-muted sm:w-[76px]">{formaterValeur(m2, e.valeurs[1])}</span>
        </span>
      </>
    );
    const classes = `flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand`;
    const resultat = basculerCoche(c.places, e.cle);
    const etiquette = `${coche ? "Décocher" : "Cocher"} ${e.nom || "sans nom"}, ${e.sous}`;

    // La cinquième case se REFUSE, visiblement : elle reste à sa place, son
    // cadre passe en rouge et une phrase dit quoi faire — aucune autre n'est
    // décochée pour elle (user story 33).
    if (resultat === "refus") {
      return (
        <button
          key={e.cle}
          type="button"
          onClick={() => refuser(e.cle)}
          aria-label={etiquette}
          aria-describedby="refus-comparaison"
          className={`${classes} cursor-not-allowed ${refusee ? "bg-[#fbe9e7]" : "hover:bg-canvas"}`}
        >
          {contenu}
        </button>
      );
    }
    return (
      <Link
        key={e.cle}
        href={lienMeta(params, { comparer: placesVersUrl(resultat) })}
        scroll={false}
        onClick={() => refuser(null)}
        aria-label={etiquette}
        className={`${classes} ${coche ? "bg-[#f6f7ff]" : "hover:bg-canvas"}`}
      >
        {contenu}
      </Link>
    );
  };

  return (
    <div>
      <div className="grid gap-x-4 md:grid-cols-2">
        {colonnes.map((col, i) => (
          <div key={i} className="min-w-0">
            <div className={i > 0 ? "hidden md:block" : ""}>{col.length > 0 && entete}</div>
            {col.map((e, k) => ligne(e, i * moitie + k + 1))}
          </div>
        ))}
      </div>
      <p id="refus-comparaison" className="px-3 pt-2 text-[11.5px] text-faint" aria-live="polite">
        {refus ? (
          <span className="font-medium text-neg">
            {MAX_COMPARES} au maximum : décoche un élément pour en comparer un autre.
          </span>
        ) : (
          <>
            Coche jusqu&apos;à {MAX_COMPARES} éléments. Classés sur « {METRIQUES[m1].nom} »
            {METRIQUES[m1].hausseBonne ? ", du plus haut au plus bas" : ", du moins cher au plus cher"} ; « — » en bas = rien de mesuré.
          </>
        )}
      </p>
    </div>
  );
}

/** La vignette d'une annonce, lue dans Storage par la récolte des créas.
 *  Tant qu'elle n'y est pas, une case neutre garde l'alignement — jamais une
 *  image inventée. */
function Vignette({ url }: { url?: string }) {
  if (!url) {
    return (
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#efeee9] text-faint"
        title="Aucun visuel lu pour cette annonce"
      >
        <Icone nom="calques" className="h-4 w-4" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- une vignette de 36 px venue de Storage : l'optimiseur d'images n'apporte rien et demanderait d'autoriser le domaine.
  return <img src={url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" loading="lazy" />;
}

function DeuxGraphes({ c, dates, niveau }: { c: DonneesComparaison; dates: string[]; niveau: string }) {
  if (c.coches.length === 0) {
    return <p className="py-16 text-center text-[14px] text-muted">Coche un élément dans la liste pour suivre son évolution.</p>;
  }
  const etiquettes = dates.map(dateBulle);
  return (
    <div className="min-w-0">
      {/* La légende : le nom à côté de la couleur, toujours (deux teintes sont
          sous 3:1 de contraste), et le rang de la liste — deux annonces
          homonymes s'y distinguent autrement que par la teinte. */}
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Éléments comparés">
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
                <span className="cursor-help font-normal text-faint" title={METRIQUES[m].aide} aria-label={METRIQUES[m].aide}>ⓘ</span>
              </p>
              <Courbe
                titre={`${METRIQUES[m].nom} jour par jour, par ${niveau} comparé`}
                format={(v) => formaterValeur(m, v)}
                hauteur={240}
                series={c.coches.map((s) => ({ nom: s.nom || "Sans nom", valeurs: s.series[k], etiquettes, couleur: s.couleur }))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
