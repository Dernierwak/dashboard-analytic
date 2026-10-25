"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Courbe } from "@/components/courbe";
import { Icone } from "@/components/meta/elements";
import { valeurElement } from "@/lib/meta/changements";
import { ouvrirSurPlace } from "@/lib/meta/sur-place";
import {
  FAMILLES_METRIQUES,
  MAX_COMPARES,
  METRIQUES,
  NOMS_NIVEAUX,
  PALETTE_COMPARES,
  basculerCoche,
  choixMetrique,
  dateBulle,
  formaterValeur,
  placesVersUrl,
  pluriel,
  type Comparaison as DonneesComparaison,
  type ElementCompare,
  type Niveau,
} from "@/lib/meta/lecture";
import { lienMeta, SANS_PANNEAU, type Params } from "@/lib/meta/liens";

// ── MODULE 4 · LA COMPARAISON ────────────────────────────────────────────────
//
// Spec, § « Comparaison — la mécanique » ; user stories 29 à 33, 35, 36.
// Mise en page C2 (spec, Notes, choix 1) : les réglages, la liste classée sur
// trois colonnes dans une fenêtre qui défile (deux sur un écran moyen), puis
// les deux graphes côte à côte en pleine largeur — le brief dit « un ou deux
// line plots côte à côte ».
//
// Tout ce qui change l'état est un LIEN (niveau, métriques, cases) : l'URL le
// porte, un lien partagé rouvre la même comparaison. Seul le refus d'une
// cinquième case est un état local : il n'y a rien à écrire dans l'URL.
//
// Grammaire : la liste porte le chiffre (la valeur de la métrique 1, en gras)
// avant la barre ; les graphes viennent après.
//
// La ligne coche ; la LECTURE a sa propre cible, « Aperçu », posée à côté et
// visible au repos (ticket 06 de la carte : « je vois où je peux appuyer »).
// Deux liens frères, jamais l'un dans l'autre : un lien imbriqué est du HTML
// invalide, et le clic irait au mauvais.
//
// LES POINTS DES LIGNES (ticket 13 de `.scratch/journal-meta/`, écran validé au
// ticket 10, point 4). Chaque ligne porte, de sa couleur, les jours où Meta
// déclare un changement sur cet élément — sur un groupe, ses annonces
// comprises (ticket 08). Un clic sur une ligne la met en avant ; seuls ses
// points ouvrent alors le panneau, sur ce jour et cet élément. Un clic à côté,
// de nouveau sur elle ou sur une autre ligne la relâche : il ne bascule pas.
// Le choix n'est pas dans l'URL — il ne se partage pas, il sert à viser.

export function Comparaison({
  comparaison: c,
  dates,
  params,
  sujet,
  vignettes,
  marques,
}: {
  comparaison: DonneesComparaison;
  dates: string[];
  params: Params;
  sujet: string;
  /** L'image de chaque annonce, par son ID — quand la récolte des créas
   *  (ticket 05) l'a écrite. */
  vignettes: Record<string, string>;
  /** Les jours marqués de chaque élément coché, par sa clé ; `null` = le
   *  journal n'a pas pu être lu (la Tendance le dit). */
  marques: Record<string, number[]> | null;
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
          <Reglages c={c} params={params} />
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
              <DeuxGraphes c={c} dates={dates} niveau={noms.un.toLowerCase()} params={params} marques={marques} />
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
//
// Chaque métrique se choisit dans un menu qui les offre TOUTES, rangées par
// vue (David, 2026-10-25 : comparer le CTR au coût par résultat) ; la vue ne
// donne que la paire de départ. Neuf pastilles par rangée ne tenaient plus.
function Reglages({ c, params }: { c: DonneesComparaison; params: Params }) {
  const niveaux: Niveau[] = ["groupes", "annonces"];
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
      {/* Sous un groupe d'annonces choisi, on ne compare que ses annonces :
          le choix du niveau n'aurait plus qu'une ligne à montrer. */}
      {!c.niveauImpose && (
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
                {FAMILLES_METRIQUES.map((f) => (
                  <div key={f.titre}>
                    <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint">{f.titre}</p>
                    {f.metriques.map((m) => {
                      const actif = actuelle === m;
                      const autre = m === c.metriques[1 - rang];
                      return (
                        <Link
                          key={m}
                          href={lienMeta(params, choixMetrique(c.metriques, rang, m))}
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
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// La liste : TOUS les éléments de la sélection, classés sur la métrique 1, avec
// leur barre et la valeur des deux métriques sous le nom. Sur trois colonnes
// (deux sur un écran moyen), dans une fenêtre qui défile : la page ne
// s'allonge plus avec le nombre d'annonces (David, 2026-10-25). Elle se lit
// ligne après ligne — n° 1, 2, 3 en haut — parce qu'une colonne entière ne
// tient plus à l'écran.
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

  const ligne = (e: ElementCompare, rang: number) => {
    const coche = e.place !== null;
    const couleur = coche ? PALETTE_COMPARES[e.place!] : null;
    const refusee = refus === e.cle;
    const largeur = e.valeurs[0] === null || max === 0 ? 0 : (e.valeurs[0] / max) * 100;
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
        {c.niveau === "annonces" && <Vignette url={e.annonceId ? vignettes[e.annonceId] : undefined} />}
        <span className="min-w-0 flex-1">
          {/* Deux lignes, coupées n'importe où : sur un tiers de largeur, un
              nom Meta souvent sans espace (« de_awarness_m01_… ») ne gardait
              qu'une dizaine de lettres. */}
          <span className="line-clamp-2 text-[13.5px] leading-snug text-ink [overflow-wrap:anywhere]" title={e.nom || undefined}>
            {e.nom || "Sans nom"}
          </span>
          {/* Le type que compte un résultat, écrit à côté — deux voisins de
              la liste ne comptent pas forcément la même chose. */}
          <span className="block truncate text-[11.5px] text-faint">
            {e.sous}
            {e.typeResultat && <span className="text-muted"> · {e.typeResultat}</span>}
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#efeee9]">
            <span
              className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${largeur}%`, background: couleur ?? "#b8b7b0" }}
            />
          </span>
          {/* Les deux valeurs SOUS le nom : à droite, sur une colonne sur
              trois, elles ne laissaient plus que quelques lettres au nom. */}
          <span className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px]">
            <span className="whitespace-nowrap">
              <span className="text-faint">{METRIQUES[m1].nom} </span>
              <span className="text-[13.5px] font-semibold tabular-nums text-ink">{formaterValeur(m1, e.valeurs[0])}</span>
            </span>
            <span className="whitespace-nowrap">
              <span className="text-faint">{METRIQUES[m2].nom} </span>
              <span className="tabular-nums text-muted">{formaterValeur(m2, e.valeurs[1])}</span>
            </span>
          </span>
        </span>
      </>
    );
    const classes = `flex w-full min-w-0 items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand`;
    const resultat = basculerCoche(c.places, e.cle);
    const etiquette = `${coche ? "Décocher" : "Cocher"} ${e.nom || "sans nom"}, ${e.sous}${e.typeResultat ? `, ${e.typeResultat}` : ""}`;

    // La cinquième case se REFUSE, visiblement : elle reste à sa place, son
    // cadre passe en rouge et une phrase dit quoi faire — aucune autre n'est
    // décochée pour elle (user story 33).
    const cocher =
      resultat === "refus" ? (
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
          href={lienMeta(params, { comparer: placesVersUrl(resultat) })}
          scroll={false}
          onClick={() => refuser(null)}
          aria-label={etiquette}
          className={`${classes} ${coche ? "bg-[#f6f7ff]" : "hover:bg-canvas"}`}
        >
          {contenu}
        </Link>
      );
    if (c.niveau === "groupes") return <div key={e.cle} className="min-w-0">{cocher}</div>;
    return (
      <div key={e.cle} className="flex min-w-0 items-start gap-1">
        <div className="min-w-0 flex-1">{cocher}</div>
        {/* Une annonce sans ID ne s'ouvre pas : le panneau s'ouvre par l'ID,
            jamais par le nom. La place reste, pour l'alignement. */}
        {e.annonceId ? (
          <Link
            href={lienMeta(params, { ...SANS_PANNEAU, annonce: e.annonceId })}
            scroll={false}
            aria-label={`Aperçu de l'annonce ${e.nom || "sans nom"}`}
            className="mt-2 flex h-8 w-[64px] shrink-0 items-center justify-center rounded-lg border border-[#dfe3fb] text-[12.5px] font-medium text-brand transition-colors hover:bg-[#eef2ff] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            Aperçu
          </Link>
        ) : (
          <span className="w-[64px] shrink-0" title="Annonce sans identifiant Meta : son contenu ne se retrouve pas" />
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="max-h-[440px] overflow-y-auto overscroll-contain">
        <div className="grid gap-x-3 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
          {c.elements.map((e, i) => ligne(e, i + 1))}
        </div>
      </div>
      <p id="refus-comparaison" className="px-3 pt-2 text-[11.5px] text-faint" aria-live="polite">
        {refus ? (
          <span className="font-medium text-neg">
            {MAX_COMPARES} au maximum : décoche un élément pour en comparer un autre.
          </span>
        ) : (
          <>
            {pluriel(c.elements.length, c.niveau === "annonces" ? "annonce" : "groupe")}
            {c.niveau === "groupes" && " d'annonces"} · coche jusqu&apos;à {MAX_COMPARES} éléments. Classés sur « {METRIQUES[m1].nom} »
            {METRIQUES[m1].hausseBonne === false ? ", du moins cher au plus cher" : ", du plus haut au plus bas"} ; « — » en dernier = rien de mesuré.
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

/** La ligne mise en avant, par sa clé. Tout clic qui ne tombe pas sur une
 *  ligne, un de ses points ou le panneau qu'ils ouvrent (`data-garde-choix`)
 *  la relâche. */
function useLigneChoisie(cles: string[]): [string | null, (cle: string) => void] {
  const [choisie, setChoisie] = useState<string | null>(null);
  useEffect(() => {
    if (choisie === null) return;
    const clic = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.("[data-garde-choix]")) setChoisie(null);
    };
    const touche = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("[role=dialog]") && setChoisie(null);
    document.addEventListener("click", clic);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("click", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [choisie]);
  // Une ligne décochée, ou partie avec un filtre, n'est plus choisie.
  const valide = choisie !== null && cles.includes(choisie) ? choisie : null;
  return [valide, (cle) => setChoisie((x) => (x === null ? cle : null))];
}

function DeuxGraphes({
  c,
  dates,
  niveau,
  params,
  marques,
}: {
  c: DonneesComparaison;
  dates: string[];
  niveau: string;
  params: Params;
  marques: Record<string, number[]> | null;
}) {
  const [choisie, basculer] = useLigneChoisie(c.coches.map((s) => s.cle));
  if (c.coches.length === 0) {
    return <p className="py-16 text-center text-[14px] text-muted">Coche un élément dans la liste pour suivre son évolution.</p>;
  }
  const etiquettes = dates.map(dateBulle);
  const indexChoisi = choisie === null ? null : c.coches.findIndex((s) => s.cle === choisie);
  const ouvrir = (si: number, i: number) =>
    ouvrirSurPlace(
      lienMeta(params, {
        ...SANS_PANNEAU,
        jour: dates[i],
        element: valeurElement({ niveau: c.niveau, cle: c.coches[si].cle }),
      })
    );
  return (
    <div className="min-w-0">
      {/* La légende : le nom à côté de la couleur, toujours (deux teintes sont
          sous 3:1 de contraste), et le rang de la liste — deux annonces
          homonymes s'y distinguent autrement que par la teinte. Une ligne
          choisie : les autres s'y estompent comme sur les graphes. */}
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Éléments comparés">
        {c.coches.map((s) => (
          <li
            key={s.cle}
            className={`flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted transition-opacity motion-reduce:transition-none ${choisie !== null && choisie !== s.cle ? "opacity-35" : ""}`}
          >
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
                series={c.coches.map((s) => ({
                  nom: s.nom || "Sans nom",
                  valeurs: s.series[k],
                  etiquettes,
                  couleur: s.couleur,
                  marques: marques?.[s.cle],
                }))}
                choisie={indexChoisi}
                onSerie={(si) => basculer(c.coches[si].cle)}
                onMarque={ouvrir}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
