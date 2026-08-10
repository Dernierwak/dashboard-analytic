"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Frise } from "@/lib/report";
import { teinteLabel } from "@/lib/palette";

// « Ce qui tournait » — le temps, enfin visible.
//
// Le reste du rapport dit ce que la semaine a DONNÉ. Rien ne disait ce qui
// était en l'air pour l'obtenir. Or c'est ce qui rend les chiffres lisibles :
// une campagne lancée le mercredi n'a eu que la moitié de la semaine, et on lui
// compare pourtant des chiffres de semaine pleine ; un creux de portée suivi de
// dix jours sans publication n'est pas un problème d'algorithme.
//
// DEUX ANS : la durée médiane de diffusion est de 82 jours, la saisonnalité —
// printemps, été, fêtes — ne se lit pas sur trois mois, et des campagnes ont
// démarré au 1er janvier 2025 pour courir jusqu'à fin 2026.
//
// TROIS NATURES DE TRAIT, et il ne faut jamais les confondre :
//   ▬ plein          la campagne a dépensé ce jour-là — c'est mesuré ;
//   ▬ estompé        on ne sait plus : la récolte s'arrête là, pas la campagne ;
//   ┈ pointillé      c'est déclaré dans la plateforme, rien n'a été dépensé.
// Le pointillé n'apparaît que si la campagne porte une date de fin déclarée
// (`fin_prevue`) ou est marquée `planifiee`. La frise ne déduit JAMAIS un
// prévisionnel de la dépense : une campagne programmée jusqu'en décembre et une
// campagne arrêtée hier laissent exactement la même trace.
//
// UN SEUL CADRE DE DÉFILEMENT, et c'est important. La version précédente en
// avait deux imbriqués : le cadre horizontal, et la liste des campagnes en
// `overflow-y`. Or CSS convertit en `auto` l'axe laissé à `visible` dès que
// l'autre ne l'est pas — la liste se dotait donc de SON propre défilement
// horizontal, et les barres se désalignaient de l'axe des dates. Ici un seul
// conteneur défile dans les deux sens ; l'en-tête reste collé en haut.

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function jours(debut: string, fin: string): string[] {
  const out: string[] = [];
  const d = new Date(debut + "T00:00:00Z");
  const f = new Date(fin + "T00:00:00Z");
  while (d <= f) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function libelle(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}
function mois(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${MOIS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

const CANAL: Record<string, string> = { meta: "▣", google: "◆" };

// Le format d'une publication. Un point unique disait « il s'est passé quelque
// chose » ; il ne disait pas quoi. Le glyphe porte le format, la couleur
// continue de porter le thème — ce sont deux questions différentes et elles
// tiennent dans le même badge.
const FORMAT: Record<string, { glyphe: string; nom: string }> = {
  IMAGE: { glyphe: "▢", nom: "Image" },
  CAROUSEL_ALBUM: { glyphe: "▤", nom: "Carrousel" },
  VIDEO: { glyphe: "▶", nom: "Vidéo" },
  REEL: { glyphe: "▶", nom: "Reel" },
  REELS: { glyphe: "▶", nom: "Reel" },
  STORY: { glyphe: "◷", nom: "Story" },
};
const FORMAT_INCONNU = { glyphe: "·", nom: "Autre" };
const format = (t: string) => FORMAT[(t || "").toUpperCase()] ?? FORMAT_INCONNU;

// La plateforme d'une publication. Aujourd'hui une seule source alimente la
// frise (Instagram), donc un glyphe de plateforme ne distinguerait rien : tant
// qu'il n'y en a qu'une, le badge porte le FORMAT, qui lui différencie
// vraiment. Dès qu'une deuxième arrive, il bascule sur la plateforme et le
// format passe en info-bulle — c'est alors la question la plus discriminante.
const PLATEFORME: Record<string, { glyphe: string; nom: string }> = {
  instagram: { glyphe: "◎", nom: "Instagram" },
  facebook: { glyphe: "▣", nom: "Facebook" },
  tiktok: { glyphe: "⬢", nom: "TikTok" },
  linkedin: { glyphe: "▤", nom: "LinkedIn" },
  youtube: { glyphe: "▶", nom: "YouTube" },
};
const PLATEFORME_INCONNUE = { glyphe: "◈", nom: "Autre" };
const plateforme = (p?: string) =>
  PLATEFORME[(p || "instagram").toLowerCase()] ?? PLATEFORME_INCONNUE;

// Le niveau de zoom, en pixels par jour. Deux ans à 5 px/jour donnent la vue
// d'ensemble mais écrasent une campagne de trois jours ; à 16 px/jour on lit
// jour par jour mais la frise fait 12 000 px. Aucun des deux ne remplace
// l'autre — d'où le réglage.
const ZOOMS = [
  { cle: "mois", nom: "Mois", px: 2 },
  { cle: "semaine", nom: "Semaine", px: 5 },
  { cle: "jour", nom: "Jour", px: 16 },
] as const;
type Zoom = (typeof ZOOMS)[number]["cle"];

const HACHURE =
  "repeating-linear-gradient(45deg, rgba(17,17,16,0.035) 0 5px, transparent 5px 10px)";

type Repere = {
  bornes: { i: number; j: string; an: boolean }[];
  x: (i: number) => number;
  largeur: number;
  debutFutur: number;
  futur: boolean;
  debutSemaine: number;
  largeurSemaine: number;
  ajd: number | null;
  PX: number;
};

// Le fond commun à toutes les bandes : les débuts de mois, la zone à venir, la
// semaine en cours et le trait d'aujourd'hui. Répété dans chaque bande pour
// rester aligné au défilement.
//
// DÉFINI ICI, hors du composant, et ce n'est pas un détail de style : tant
// qu'il était déclaré dans le corps de `FriseSemaine`, chaque rendu en créait
// un type NEUF, donc React démontait et remontait tout le fond. Le premier
// effet posait le défilement sur la semaine en cours, le second (le calcul
// d'aujourd'hui) provoquait un rendu, et la frise repartait au 1er janvier.
function Fond({ r }: { r: Repere }) {
  return (
    <>
      {r.futur && (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{ left: r.x(r.debutFutur), width: r.largeur - r.x(r.debutFutur), background: HACHURE }}
        />
      )}
      {r.bornes.map((b) => (
        <div
          key={b.j}
          className={`absolute inset-y-0 border-l ${b.an ? "border-ink/25" : "border-line"}`}
          style={{ left: r.x(b.i) }}
        />
      ))}
      <div
        className="absolute inset-y-0 bg-brand/[0.06] border-x border-brand/25 pointer-events-none"
        style={{ left: r.x(r.debutSemaine), width: r.largeurSemaine }}
      />
      {r.ajd !== null && (
        <div
          className="absolute inset-y-0 w-px bg-ink/45 pointer-events-none"
          style={{ left: r.x(r.ajd) + r.PX / 2 }}
        />
      )}
    </>
  );
}

export function FriseSemaine({ f, univers }: { f: Frise; univers: string[] }) {
  const cadre = useRef<HTMLDivElement>(null);
  const grille = jours(f.debut, f.fin);
  const n = grille.length;

  const idx = (iso: string) => grille.indexOf(iso);
  const debutSemaine = Math.max(0, idx(f.semaine_debut));

  // Sur une fenêtre courte, le zoom « semaine » serait ridicule : on ouvre
  // d'un cran plus fin. Au-delà, c'est le réglage qui décide.
  const [zoom, setZoom] = useState<Zoom>(n > 200 ? "semaine" : "jour");
  const PX = ZOOMS.find((z) => z.cle === zoom)!.px;
  const largeur = n * PX;

  // Changer de zoom ne doit pas téléporter le lecteur. On retient la DATE au
  // centre du cadre avant le changement, et on la remet au centre après : on
  // zoome sur ce qu'on regardait, pas sur le 1er janvier.
  const pxPrec = useRef(PX);
  useEffect(() => {
    const el = cadre.current;
    if (!el || pxPrec.current === PX) return;
    const centre = (el.scrollLeft + el.clientWidth / 2) / pxPrec.current;
    pxPrec.current = PX;
    el.scrollLeft = Math.max(0, centre * PX - el.clientWidth / 2);
  }, [PX]);

  // On se pose sur la semaine du rapport, ni sur le 1er janvier de l'an dernier
  // ni sur le 31 décembre à venir : elle occupe les deux tiers du cadre, le
  // passé derrière, les mois à venir juste à droite.
  const recentrer = useCallback(() => {
    const el = cadre.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, debutSemaine * PX - el.clientWidth * 0.62), behavior: "smooth" });
  }, [debutSemaine, PX]);

  // La position d'ouverture attend que le cadre ait une largeur.
  //
  // Posée directement au montage, elle était perdue une fois sur deux : tant
  // que la mise en page n'a pas eu lieu, `scrollWidth` vaut 0 et le navigateur
  // ramène silencieusement `scrollLeft` à 0. La frise s'ouvrait alors au
  // 1er janvier 2025 — vingt mois avant ce qu'on venait lire. Un observateur de
  // taille attend le premier vrai calibrage, positionne, puis se retire.
  const place = useRef(false);
  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    place.current = false;
    const poser = () => {
      if (place.current || el.clientWidth === 0 || el.scrollWidth <= el.clientWidth) return false;
      el.scrollLeft = Math.max(0, debutSemaine * PX - el.clientWidth * 0.62);
      place.current = true;
      return true;
    };
    if (poser()) return;
    const ro = new ResizeObserver(() => {
      if (poser()) ro.disconnect();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // Volontairement PAS de dépendance au zoom : changer d'échelle conserve la
    // date au centre (effet ci-dessus), il ne ramène pas sur la semaine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.debut, f.fin, debutSemaine]);

  // Aujourd'hui est calculé APRÈS le montage : la date du serveur et celle du
  // navigateur ne tombent pas dans le même fuseau, et un trait qui saute d'un
  // jour à l'hydratation est un bug qu'on ne comprend qu'au troisième essai.
  const [ajd, setAjd] = useState<number | null>(null);
  useEffect(() => {
    const t = new Date();
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
      t.getDate()
    ).padStart(2, "0")}`;
    const i = grille.indexOf(iso);
    setAjd(i >= 0 ? i : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.debut, f.fin]);

  if (n < 7) return null;

  const x = (i: number) => i * PX;
  const couleur = (theme: string | null) => (theme ? teinteLabel(theme, univers) : null);

  // Jusqu'où chaque source est réellement à jour. Au-delà, on ne sait rien —
  // et une barre qui s'arrête là ne veut pas dire que la campagne s'est arrêtée.
  const limite = (canal: string): number => {
    const c = f.couverture?.[canal as "meta" | "google" | "instagram"] ?? null;
    if (!c) return n - 1;
    const i = idx(c);
    return i >= 0 ? i : n - 1;
  };

  // Où s'arrête ce qu'on sait. Au-delà, ce n'est pas un trou de données : c'est
  // du futur. La zone est hachurée et nommée, pour qu'on ne lise pas un silence
  // là où il n'y a qu'une date pas encore arrivée.
  const dernierConnu = (["meta", "google", "instagram"] as const)
    .map((c) => f.couverture?.[c] ?? null)
    .filter((v): v is string => !!v)
    .reduce<string | null>((a, b) => (a === null || b > a ? b : a), null);
  const debutFutur = dernierConnu ? idx(dernierConnu) + 1 : -1;
  const futur = debutFutur > 0 && debutFutur < n - 1;

  // Un canal « en retard » l'est par rapport aux AUTRES, pas par rapport au
  // 31 décembre : la frise court désormais jusqu'à la fin de l'année, et
  // comparer à cette borne signalerait tout le monde en retard tous les jours.
  const retards = (["meta", "google"] as const)
    .map((c) => ({ canal: c, jusqua: f.couverture?.[c] ?? null }))
    .filter((v) => v.jusqua && dernierConnu && v.jusqua < dernierConnu);

  const bornes = grille
    .map((j, i) => ({ i, j, an: j.slice(5, 7) === "01" }))
    .filter((v) => v.j.slice(8) === "01");

  // La semaine du rapport fait SEPT JOURS. Tant que la frise s'arrêtait au
  // dernier jour récolté, une bande allant jusqu'au bord disait la même chose ;
  // sur une fenêtre qui court jusqu'au 31 décembre, elle en couvrirait cinq
  // mois. On la borne.
  const largeurSemaine = 7 * PX;

  // Un badge fait 12 px. À 2 px/jour, six publications d'affilée se
  // superposeraient en une bouillie : on les regroupe sur la largeur qu'occupe
  // un badge, et le badge porte alors leur nombre. Au zoom « jour », un badge
  // par jour, comme avant.
  const pasGroupe = Math.max(1, Math.ceil(13 / PX));
  const paquets = new Map<number, typeof f.posts>();
  for (const p of f.posts) {
    const i = idx(p.date);
    if (i < 0) continue;
    const cle = Math.floor(i / pasGroupe) * pasGroupe;
    const l = paquets.get(cle) ?? [];
    l.push(p);
    paquets.set(cle, l);
  }

  // Tant qu'une seule plateforme alimente la frise, c'est le FORMAT qui
  // distingue les publications. Dès qu'il y en a deux, c'est la plateforme.
  const plateformes = [...new Set(f.posts.map((p) => plateforme(p.plateforme).nom))];
  const parPlateforme = plateformes.length > 1;
  const marque = (p: (typeof f.posts)[number]) =>
    parPlateforme ? plateforme(p.plateforme) : format(p.type);
  // La légende ne nomme que ce qui est réellement présent : une légende qui
  // annonce ce qu'on ne verra pas fait chercher pour rien.
  const legende = parPlateforme
    ? plateformes
    : [...new Set(f.posts.map((p) => format(p.type).nom))];

  // Même règle pour le pointillé : tant que les dates déclarées ne sont pas
  // récoltées, aucune campagne n'en porte — et une légende qui décrit un trait
  // absent de l'écran fait chercher pour rien.
  const aDuPrevu = f.campagnes.some((c) => c.planifiee || c.fin_prevue !== undefined);

  const rep: Repere = {
    bornes,
    x,
    largeur,
    debutFutur,
    futur,
    debutSemaine,
    largeurSemaine,
    ajd,
    PX,
  };

  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 flex-wrap px-4 sm:px-5 pt-4 pb-2">
        <h3 className="text-[10px] uppercase tracking-widest text-faint font-bold">
          Ce qui tournait
        </h3>
        <span className="text-[10.5px] font-bold text-ink bg-black/[0.05] rounded-full px-2 py-0.5">
          {f.debut.slice(0, 4)}
          {f.fin.slice(0, 4) !== f.debut.slice(0, 4) && ` → ${f.fin.slice(0, 4)}`}
        </span>
        <span className="text-[10.5px] text-faint">
          {f.campagnes.length} campagne{f.campagnes.length > 1 ? "s" : ""} ·{" "}
          {f.posts.length} publication{f.posts.length > 1 ? "s" : ""} · glisse ← →
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[9.5px] uppercase tracking-wide text-faint font-semibold">
            échelle
          </span>
          <div className="flex rounded-full border border-line overflow-hidden">
            {ZOOMS.map((z) => (
              <button
                key={z.cle}
                onClick={() => setZoom(z.cle)}
                aria-pressed={zoom === z.cle}
                className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${
                  zoom === z.cle
                    ? "bg-ink text-white"
                    : "text-muted hover:bg-black/[0.04]"
                }`}
              >
                {z.nom}
              </button>
            ))}
          </div>
          <button
            onClick={recentrer}
            className="text-[11px] font-semibold text-brand border border-brand/25 rounded-full px-3 py-1 hover:bg-brand/[0.06] transition-colors"
          >
            Recentrer
          </button>
        </div>
      </div>

      {/* Un seul cadre, deux axes. Tout ce qui est dedans partage la même
          largeur, donc la même échelle de temps. */}
      <div ref={cadre} className="overflow-auto max-h-[62vh] overscroll-x-contain">
        <div style={{ width: largeur }}>
          {/* L'échelle, collée en haut pendant qu'on parcourt les campagnes */}
          <div className="sticky top-0 z-10 bg-white border-b border-line">
            <div className="relative h-[26px]">
              {futur && (
                <div
                  className="absolute inset-y-0"
                  style={{ left: x(debutFutur), width: largeur - x(debutFutur), background: HACHURE }}
                />
              )}
              {bornes.map((b) => (
                <span
                  key={b.j}
                  className={`absolute inset-y-0 border-l ${b.an ? "border-ink/25" : "border-line"}`}
                  style={{ left: x(b.i) }}
                />
              ))}
              <div
                className="absolute inset-y-0 bg-brand/[0.07] border-x border-brand/25"
                style={{ left: x(debutSemaine), width: largeurSemaine }}
              />
              {ajd !== null && (
                <div
                  className="absolute inset-y-0 w-px bg-ink/45"
                  style={{ left: x(ajd) + PX / 2 }}
                />
              )}
              {bornes.map((b) => (
                <span
                  key={`t-${b.j}`}
                  className={`absolute top-[7px] text-[9.5px] font-mono pl-1 whitespace-nowrap ${
                    b.an ? "text-ink font-semibold" : "text-faint"
                  }`}
                  style={{ left: x(b.i) }}
                >
                  {b.an ? b.j.slice(0, 4) : mois(b.j)}
                </span>
              ))}
              {/* À l'échelle « mois », la semaine ne fait que 14 px : l'étiquette
                  déborde sur deux noms de mois pour désigner un trait. La bande
                  bleue reste, elle suffit à la repérer. */}
              {PX >= 4 && (
                <span
                  className="absolute top-[7px] text-[9.5px] font-bold text-brand uppercase tracking-wide pr-1.5 whitespace-nowrap -translate-x-full"
                  style={{ left: x(debutSemaine) }}
                >
                  cette sem. →
                </span>
              )}
              {futur && (
                // Au MILIEU de la zone, pas à sa frontière : posée sur le bord,
                // elle se superposait à l'étiquette du mois courant.
                <span
                  className="absolute top-[6px] -translate-x-1/2 text-[9.5px] font-semibold text-faint uppercase tracking-wide whitespace-nowrap bg-white/85 px-1.5 py-px rounded"
                  style={{ left: (x(debutFutur) + largeur) / 2 }}
                >
                  à venir
                </span>
              )}
            </div>
          </div>

          {/* Les campagnes — une barre chacune, du premier au dernier jour où
              elle a réellement dépensé. Triées par dépense. */}
          <div className="relative pt-1">
            <Fond r={rep} />
            {f.campagnes.map((c) => {
              const a = Math.max(0, idx(c.debut));
              const b = Math.min(n - 1, idx(c.fin));
              const t = couleur(c.theme);
              const lim = limite(c.canal);
              const coupe = b >= lim && lim < n - 1;

              // Le segment déclaré : de la fin observée à la fin programmée.
              // Absent tant que le worker ne récolte pas ces dates — la frise
              // ne fabrique pas de prévisionnel à partir de la dépense.
              const iPrevu = c.fin_prevue ? idx(c.fin_prevue) : -1;
              const plan = iPrevu > b ? { de: b + 1, a: iPrevu } : null;

              // Ce qu'on peut dire de la fin, et RIEN de plus.
              //
              // Le cas `coupe` — la barre s'arrête sur la limite de récolte —
              // ne porte AUCUN texte, et c'est délibéré : toutes les campagnes
              // d'un même canal s'arrêtent au même jour, donc la même phrase
              // s'écrivait douze fois à la même abscisse. Le dégradé de fin de
              // barre, la légende du pied et l'avertissement en bas disent déjà
              // la chose, une seule fois chacun. Une étiquette n'apparaît que
              // là où elle apprend quelque chose de propre à la ligne.
              const finTexte = c.planifiee
                ? "planifiée"
                : c.fin_prevue === null
                  ? "sans date de fin"
                  : c.fin_prevue
                    ? `fin prévue ${libelle(c.fin_prevue)}`
                    : coupe
                      ? null
                      : `fin ${libelle(c.fin)}`;
              const finX = x(plan ? plan.a : b) + PX;
              const aGauche = finX + 96 > largeur;

              return (
                <div key={`${c.canal}-${c.nom}`} className="relative h-[24px]">
                  <div
                    className="absolute inset-y-[4px] rounded-full"
                    style={{
                      left: x(a),
                      width: Math.max(5, (b - a + 1) * PX),
                      background: t?.aplat ?? "rgba(0,0,0,0.06)",
                      border: `1px solid ${t?.trait ?? "#d8d8de"}`,
                      maskImage: coupe ? "linear-gradient(90deg,#000 90%,transparent)" : undefined,
                      WebkitMaskImage: coupe
                        ? "linear-gradient(90deg,#000 90%,transparent)"
                        : undefined,
                    }}
                    title={`${c.nom} · ${libelle(c.debut)} → ${libelle(c.fin)} · ${c.jours} jour${
                      c.jours > 1 ? "s" : ""
                    } de diffusion · ${Math.round(c.depense)} CHF${
                      c.continu ? "" : " · diffusion interrompue puis reprise"
                    }`}
                  />
                  {plan && (
                    <div
                      className="absolute inset-y-[4px] rounded-full border border-dashed"
                      style={{
                        left: x(plan.de),
                        width: Math.max(5, (plan.a - plan.de + 1) * PX),
                        borderColor: t?.trait ?? "#d8d8de",
                      }}
                      title={`${c.nom} · programmée jusqu'au ${libelle(c.fin_prevue!)} — rien de dépensé sur cette portion`}
                    />
                  )}
                  <span
                    className="absolute inset-y-0 flex items-center text-[10.5px] text-ink/80 whitespace-nowrap pl-2 pointer-events-none"
                    style={{ left: x(a) }}
                  >
                    <span className="text-faint mr-1">{CANAL[c.canal] ?? "·"}</span>
                    {c.nom}
                    {!c.continu && (
                      <span className="text-warn ml-1.5" title="diffusion interrompue">
                        ⌇
                      </span>
                    )}
                  </span>
                  {/* La fin, écrite au bout de la barre. Une barre qui s'arrête
                      ne dit pas POURQUOI elle s'arrête : campagne terminée,
                      données qui manquent, ou fin programmée. Ici c'est écrit. */}
                  {finTexte && (
                    <span
                      className={`absolute inset-y-0 flex items-center text-[9.5px] text-faint whitespace-nowrap pointer-events-none ${
                        aGauche ? "-translate-x-full pr-2" : "pl-1.5"
                      }`}
                      style={{ left: finX }}
                    >
                      {finTexte}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Les publications, même échelle : c'est le rapprochement qui compte
              — un pic qui suit un post ou le lancement d'une campagne. */}
          <div className="sticky bottom-0 z-10 bg-white border-t border-line pt-1.5">
            <div className="relative h-7">
              <Fond r={rep} />
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
              <span
                className="sticky left-2 z-20 float-left text-[9.5px] uppercase tracking-wide text-faint font-semibold bg-white/90 px-1 rounded"
                style={{ lineHeight: "28px" }}
              >
                publications
              </span>
              {[...paquets.entries()].map(([i, liste]) => {
                const t = couleur(liste[0].theme);
                const seul = liste.length === 1;
                const periode =
                  pasGroupe === 1 || seul
                    ? libelle(liste[0].date)
                    : `${libelle(grille[i])} → ${libelle(grille[Math.min(n - 1, i + pasGroupe - 1)])}`;
                return (
                  <span
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 rounded-[4px] border flex items-center justify-center font-bold"
                    style={{
                      left: x(i) + (pasGroupe * PX) / 2 - 6,
                      height: 12,
                      width: 12,
                      fontSize: 8,
                      lineHeight: 1,
                      background: t?.aplat ?? "rgba(0,0,0,0.06)",
                      borderColor: t?.trait ?? "#8a8a94",
                      color: t?.trait ?? "#5a5d66",
                    }}
                    title={`${periode} · ${liste
                      .map(
                        (p) =>
                          `${plateforme(p.plateforme).nom} ${format(p.type).nom} — ${
                            p.theme ?? "sans thème"
                          }`
                      )
                      .join(" · ")}`}
                  >
                    {seul ? marque(liste[0]).glyphe : liste.length}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {legende.length > 1 && (
        <div className="flex items-center gap-3.5 flex-wrap px-4 sm:px-5 pt-2.5 text-[10px] text-faint font-semibold">
          {legende.map((nom) => {
            const src = parPlateforme ? PLATEFORME : FORMAT;
            const g = Object.values(src).find((v) => v.nom === nom)?.glyphe ?? "·";
            return (
              <span key={nom} className="flex items-center gap-1.5">
                <span className="h-[12px] w-[12px] rounded-[4px] border border-line bg-black/[0.04] flex items-center justify-center text-[8px] text-muted">
                  {g}
                </span>
                {nom}
              </span>
            );
          })}
          <span className="text-faint/70 font-normal">
            la couleur porte le thème, le glyphe {parPlateforme ? "la plateforme" : "le format"}
            {pasGroupe > 1 && " · un chiffre = plusieurs publications regroupées"}
          </span>
        </div>
      )}

      {/* Une légende par nature de trait. Quatre traits différents cohabitent
          sur la même frise et aucun ne se devine : ce pied est la seule chose
          qui empêche de lire « campagne terminée » là où c'est la récolte qui
          s'arrête. */}
      <div className="flex gap-x-4 gap-y-1 flex-wrap px-4 sm:px-5 pt-2.5 pb-3 text-[10px] text-faint">
        <span>
          <b className="text-warn">⌇</b> diffusion interrompue puis reprise
        </span>
        {futur && <span>barre estompée = fin de la couverture des données, pas fin de campagne</span>}
        {aDuPrevu && (
          <span>contour pointillé = fin prévue ou campagne planifiée, rien de dépensé encore</span>
        )}
        {ajd !== null && <span>trait vertical sombre = aujourd&apos;hui</span>}
      </div>

      {retards.length > 0 && (
        <p className="text-[10.5px] text-warn leading-relaxed px-4 sm:px-5 py-2.5 border-t border-line bg-warn/[0.04]">
          {retards
            .map(
              (r) =>
                `${r.canal === "meta" ? "Meta" : "Google Ads"} : pas de données après le ${libelle(
                  r.jusqua!
                )}`
            )
            .join(" · ")}
          . Les barres s&apos;arrêtent là, pas forcément les campagnes — c&apos;est la
          récolte qui n&apos;est pas allée plus loin.
        </p>
      )}
    </div>
  );
}
