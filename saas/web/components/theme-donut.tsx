import { fmtCHF } from "@/lib/report";
import { teinteLabel, NEUTRE, type Teinte } from "@/lib/palette";

// « Où part ton argent » — l'anneau de répartition par thème.
//
// Une liste de montants oblige à comparer des nombres de tête ; un anneau se
// lit d'un coup d'œil : on voit tout de suite si la dépense est concentrée sur
// un thème ou éparpillée sur dix. C'est le complément visuel de la boussole —
// elle dit COMMENT ça se passe, celui-ci dit OÙ ça se joue.
//
// Il sert deux pages : le rapport hebdomadaire et les coûts. D'où la forme
// minimale de `rows` — un nom, un montant. `ThemeRow` la satisfait sans rien
// changer, et la page Coûts n'a pas eu à fabriquer un faux `ThemeRow` avec un
// revenu à zéro pour se servir de l'anneau.

export function ThemeDonut({
  rows,
  orphan = 0,
  univers,
  teintes,
  titre = "Où part ton argent",
  sousTitre,
  note,
  montants = false,
  unite = "thème",
  etroit = false,
  uniteValeur = "CHF",
  carte = true,
  parNombre = false,
  epingles,
}: {
  /**
   * `count`, optionnel : le nombre d'éléments qui composent la part, en
   * complément du montant — utilisé par `labels-couverture` (une campagne ou
   * une publication par thème), ignoré des trois usages existants (rapport,
   * Coûts, Conversions), qui ne le passent pas.
   */
  rows: { label: string; spend: number; count?: number }[];
  /** Ce qui n'est rattaché à aucun thème — versé dans « autres ». Un montant :
   *  n'a de sens qu'en mode `spend` (voir `parNombre`), ignoré en mode `count`. */
  orphan?: number;
  // La liste maîtresse des thèmes : elle fixe la couleur de chacun, pour qu'un
  // thème garde la sienne d'un module à l'autre et d'une semaine à l'autre.
  univers?: string[];
  /**
   * FORCER LA COULEUR D'UNE PART, par nom.
   *
   * `teinteLabel` indexe sur la liste des THÈMES : sur un anneau par
   * PLATEFORME, Meta et Google y prendraient deux teintes arbitraires — et
   * Google pourrait très bien sortir en bleu, la couleur de Meta partout
   * ailleurs dans l'application. Le canal a des couleurs de convention (▣ bleu,
   * ◆ vert) qui valent dans dix-huit endroits : c'est elles qui doivent gagner.
   * Une prop plutôt qu'un second composant — la géométrie, le total au centre
   * et la légende sont exactement les mêmes.
   */
  teintes?: Record<string, Teinte>;
  titre?: string;
  /** La fenêtre de lecture, quand elle n'est pas évidente (page Coûts). */
  sousTitre?: string;
  note?: string;
  /** Écrire le montant à côté du pourcentage, et pas seulement la part. */
  montants?: boolean;
  /** Ce que compte le sous-titre du centre — « thème », « plateforme ». */
  unite?: string;
  /** Deux anneaux côte à côte : la légende n'a plus la place de ses colonnes. */
  etroit?: boolean;
  /**
   * L'UNITÉ DE LA VALEUR QUI PILOTE L'ANNEAU (`spend`, ou `count` si
   * `parNombre`), ÉCRITE AU CENTRE ET DANS LE `<title>` DE CHAQUE ARC — PAS
   * TOUJOURS UN MONTANT. `spend` porte un montant en franc sur toutes les
   * répartitions de dépense (d'où le nom et le défaut « CHF »), mais le même
   * anneau sert aussi à compter des ÉVÉNEMENTS (le camembert des conversions
   * par catégorie, sur /conversions) : y écrire « CHF » sous un nombre de
   * conversions serait un chiffre faux, pas juste un mot en trop.
   */
  uniteValeur?: string;
  /**
   * FAUX : rendre l'anneau NU, sans son cadre, son titre ni sa note — pour se
   * nicher dans une carte qui les porte déjà (`labels-couverture`, dont le
   * rang 1 est déjà le surtitre). Un module qui redit un titre et un fond que
   * son hôte affiche déjà à côté produit un cadre dans le cadre.
   * Par défaut à `true` : les trois usages existants (rapport, Coûts,
   * Conversions) restent des cartes autonomes, inchangés.
   */
  carte?: boolean;
  /**
   * VRAI : la taille des parts, le tri, et le seuil « visible ou pas » sont
   * pilotés par `count` (le nombre d'éléments) au lieu de `spend` (le
   * montant). Ajouté pour `labels-couverture` : un thème purement organique
   * (0 CHF) doit quand même apparaître, avec le poids que lui donne son
   * nombre d'éléments — « on s'en fiche de la dépense » pour dimensionner,
   * elle reste affichée à côté en info complémentaire (via `montants`).
   * Par défaut `false` : les trois usages existants continuent de
   * dimensionner par `spend`, à l'identique. `orphan` est ignoré dans ce mode
   * (c'est un montant, il n'a pas de `count`).
   */
  parNombre?: boolean;
  /**
   * Labels qui ne doivent JAMAIS être absorbés dans la part « autres », quel
   * que soit leur rang — ils restent leur propre part identifiable même s'ils
   * tombent hors du top 5. Utilisé par `labels-couverture` pour « Sans
   * thème » : c'est l'objet même du module, il ne peut pas se fondre dans un
   * paquet générique. Un label épinglé absent de `rows`, ou dont la valeur
   * qui pilote l'anneau est nulle, n'apparaît simplement pas — épingler ne
   * fabrique pas une part vide.
   */
  epingles?: string[];
}) {
  const poids = (r: { spend: number; count?: number }) => (parNombre ? r.count ?? 0 : r.spend);
  const tries = [...rows].sort((a, b) => poids(b) - poids(a)).filter((r) => poids(r) > 0);
  if (tries.length === 0) return null;

  const couleur = (label: string) => teintes?.[label] ?? teinteLabel(label, univers);
  const estEpingle = (label: string) => (epingles ?? []).includes(label);
  const epingleesRows = tries.filter((r) => estEpingle(r.label));
  const restantes = tries.filter((r) => !estEpingle(r.label));
  const placesLibres = Math.max(0, 5 - epingleesRows.length);
  const top = [...epingleesRows, ...restantes.slice(0, placesLibres)].sort(
    (a, b) => poids(b) - poids(a)
  );
  const dela = restantes.slice(placesLibres);
  const resteSpend = dela.reduce((a, r) => a + r.spend, 0) + (!parNombre && orphan > 0 ? orphan : 0);
  // Le nombre d'éléments de « autres » ne se reconstitue que si CHAQUE ligne
  // au-delà du top 5 porte un `count` — sinon on ne sait pas ce que l'orphan
  // représente en éléments, et un total à moitié compté vaudrait moins que pas
  // de total. `dela.length > 0` est nécessaire : `[].every(...)` vaut
  // toujours `true` (vide), ce qui donnait « 0 élément » à une part « autres »
  // faite uniquement d'`orphan` — un compte faux, pas une absence de compte.
  const resteCount = dela.length > 0 && dela.every((r) => typeof r.count === "number")
    ? dela.reduce((a, r) => a + (r.count ?? 0), 0)
    : undefined;
  // `restePoids` PILOTE la taille de la part « autres » — elle ne se déduit
  // pas de `resteCount` (gardé strict, `undefined` dès qu'une ligne manque son
  // `count`) ni de `resteSpend` recalculés séparément : les trois divergeraient
  // dès qu'une ligne bucketée n'a pas de `count` en mode `parNombre`.
  const restePoids = parNombre ? dela.reduce((a, r) => a + (r.count ?? 0), 0) : resteSpend;
  const parts = [
    ...top.map((r) => ({ label: r.label, spend: r.spend, count: r.count, poidsPart: poids(r), t: couleur(r.label) })),
    ...(restePoids > 0
      ? [{ label: "autres", spend: resteSpend, count: resteCount, poidsPart: restePoids, t: NEUTRE }]
      : []),
  ];
  const total = parts.reduce((a, p) => a + p.poidsPart, 0);
  if (total <= 0) return null;

  // Anneau dessiné en arcs de cercle : un seul cercle, un dasharray par part.
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = parts.map((p) => {
    const frac = p.poidsPart / total;
    const arc = { ...p, frac, dash: frac * C, offset };
    offset += frac * C;
    return arc;
  });

  // L'anneau et sa légende, communs aux deux rendus — carte autonome ou
  // anneau nu posé dans une carte qui l'héberge.
  const anneau = (
    <>
      <div
        className={`flex items-center gap-5 flex-wrap justify-center ${
          etroit ? "" : "sm:gap-7 sm:flex-nowrap sm:justify-start"
        }`}
      >
        {/* Le total au CENTRE de l'anneau, pas en sous-titre gris. Un anneau
            sans son total est une forme sans sa valeur. */}
        <div className="relative shrink-0">
          <svg viewBox="0 0 100 100" className={`-rotate-90 ${etroit ? "w-[150px] h-[150px]" : "w-[150px] h-[150px] sm:w-[190px] sm:h-[190px]"}`} role="img"
            aria-label={`Répartition ${parNombre ? "du nombre d'éléments" : "de la dépense"} par ${unite}`}>
            <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f1f4" strokeWidth="16" />
            {arcs.map((a) => {
              // Le complément est TOUJOURS l'autre valeur que celle qui pilote
              // l'anneau : le montant quand c'est le nombre qui pilote
              // (`parNombre`), le nombre quand c'est le montant — jamais les
              // deux fois la même.
              const complement = parNombre
                ? ` · ${fmtCHF(a.spend)} CHF`
                : typeof a.count === "number"
                  ? ` · ${a.count} élément${a.count > 1 ? "s" : ""}`
                  : "";
              return (
                <circle
                  key={a.label}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={a.t.trait}
                  strokeWidth="16"
                  opacity={0.9}
                  strokeDasharray={`${a.dash} ${C - a.dash}`}
                  strokeDashoffset={-a.offset}
                >
                  <title>{`${a.label} — ${fmtCHF(a.poidsPart)} ${uniteValeur} (${Math.round(a.frac * 100)} %)${complement}`}</title>
                </circle>
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-mono text-[22px] sm:text-[26px] leading-none font-medium text-ink">
              {fmtCHF(total)}
            </span>
            <span className="text-[10.5px] text-faint mt-1">
              {uniteValeur} · {parts.length} {unite}
              {parts.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Sur téléphone, la légende passe SOUS l'anneau (`basis-full`). À côté,
            il lui restait 150 px : « Audio Tour » s'y écrivait « Aud… », et un
            nom de thème tronqué ne nomme plus rien. Sur grand écran elle
            reprend sa place à droite et s'étale en colonnes.
            En mode étroit — deux anneaux côte à côte — elle reste sous
            l'anneau et sur une seule colonne : la moitié d'une page de 1 024 px
            ne laisse pas 280 px à droite d'un disque de 150. */}
        <div
          className={`min-w-0 basis-full grid gap-x-6 gap-y-1.5 ${
            etroit ? "" : "sm:basis-auto sm:flex-1 sm:grid-cols-2 xl:grid-cols-3"
          }`}
        >
          {arcs.map((a) => (
            <div key={a.label} className="flex items-baseline gap-2">
              <span
                className="h-3 w-3 rounded-full shrink-0 border-2"
                style={{ background: a.t.aplat, borderColor: a.t.trait }}
              />
              <span className="text-[12.5px] text-ink truncate">{a.label}</span>
              <span className="ml-auto font-mono text-[12px] text-muted shrink-0">
                {montants && (
                  <span className="text-ink">
                    {fmtCHF(a.spend)}
                    {/* En mode `parNombre`, le centre de l'anneau déclare
                        `uniteValeur` (« éléments ») — le nombre nu ici serait
                        lu comme cette même unité. Seul cas où le CHF n'est PAS
                        la valeur qui pilote l'anneau : on l'écrit en toutes
                        lettres. */}
                    {parNombre && " CHF"}
                  </span>
                )}
                {montants && " "}
                {typeof a.count === "number" && (
                  <span className="text-faint">
                    {a.count} élément{a.count > 1 ? "s" : ""} ·{" "}
                  </span>
                )}
                <span className={montants ? "text-faint" : undefined}>
                  {Math.round(a.frac * 100)} %
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (!carte) {
    // Anneau nu : pas de cadre, pas de titre, pas de note — l'hôte les porte
    // déjà. `note`, s'il est passé, reste affiché : rien n'empêche un appelant
    // sans carte de vouloir sa propre légende sous l'anneau.
    return (
      <div className="min-w-0">
        {anneau}
        {note && <p className="text-[11px] text-faint leading-relaxed mt-3.5">{note}</p>}
      </div>
    );
  }

  return (
    // `min-w-0` n'est pas cosmétique : cette carte est un ÉLÉMENT DE GRILLE
    // (deux anneaux côte à côte sur la page Coûts), et un élément de grille a
    // `min-width: auto` — il refuse donc de descendre sous la largeur
    // min-content de son contenu. Sur un iPhone la carte débordait de 28 px et
    // c'est TOUTE LA PAGE qui se mettait à défiler horizontalement.
    <div className="bg-white border border-line rounded-2xl shadow-card p-5 sm:p-6 h-full min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1">
        {titre}
        {sousTitre && <span className="text-faint/70 normal-case tracking-normal"> · {sousTitre}</span>}
      </div>

      {anneau}

      <p className="text-[11px] text-faint leading-relaxed mt-3.5">
        {note ??
          "Dépense cumulée par thème. Un thème qui prend la moitié du budget mérite la moitié de ton attention — c'est rarement le cas."}
      </p>
    </div>
  );
}
