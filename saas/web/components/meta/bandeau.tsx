"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { ICONE_VUE, ID_SELECTEUR_VUE, Icone } from "@/components/meta/elements";
import {
  bornes,
  dateCourte,
  moisCalendrier,
  moisVoisin,
  nombre,
  periodeAvant,
  periodeEntre,
  DEVISE,
  ORDRE_VUES,
  TIRET,
  VUES,
  type Campagne,
  type CampagneChoisie,
  type Periode,
  type Raccourci,
  type Vue,
} from "@/lib/meta/lecture";
import { lienMeta, type Params } from "@/lib/meta/liens";

// ── MODULE 1 · LE BANDEAU DE COMMANDES ───────────────────────────────────────
//
// Spec, § « Solution », module 1 ; user stories 1, 6 à 11. Il porte le titre,
// la date à laquelle Pulse a lu Meta, le choix de la campagne (menu avec
// recherche, pastille et dépense de la période) et la période (raccourcis et
// calendrier sur deux mois, toujours comparée à la période d'avant de même
// durée). Direction visuelle : celle du prototype validé (ticket 05).
//
// Au défilement, dès que les cartes du Sélecteur de vue sortent de l'écran, il
// se détache en pilule flottante et la vue active s'y replie : on ne perd
// jamais de vue ce qu'on regarde. L'animation se coupe pour qui a réduit les
// animations (`motion-reduce:`).
//
// Tout l'état vit dans l'URL (user story 11) ; chaque geste change UN réglage
// et garde les autres (`lienMeta`). Ce qui n'y vit pas — un menu ouvert, la
// pilule — tient à l'écran de celui qui regarde, pas à ce qu'il partage.
//
// Pas de période « Tout » (elle n'a pas de période d'avant), pas de filtre par
// statut (spec, Out of Scope).

const jours = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;

const ANIM = "transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none";

export function BandeauMeta({
  lecture,
  params,
  vue,
  campagnes,
  campagneChoisie,
  periode,
  raccourcis,
  hier,
}: {
  lecture: string;
  params: Params;
  vue: Vue;
  campagnes: Campagne[];
  campagneChoisie: CampagneChoisie | null;
  periode: Periode;
  raccourcis: Raccourci[];
  /** La borne haute des dates choisissables : le jour en cours est exclu. */
  hier: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const aller = (patch: Record<string, string | null>) =>
    demarrer(() => router.push(lienMeta(params, patch), { scroll: false }));
  const detache = useDetache();
  const duree = jours(periode.jours);

  return (
    <header
      aria-busy={enCours}
      // `top-[53px]` sous `lg` : la barre du téléphone (`side-nav.tsx`, mesurée à
      // 53 px dans Chrome) est elle aussi collée en haut ; à `top-0`, le Bandeau
      // la recouvrait et cachait le menu.
      className={`pointer-events-none sticky top-[53px] z-30 lg:top-0 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 ${ANIM} ${
        detache ? "pt-3" : "bg-canvas/95 backdrop-blur"
      }`}
    >
      <div
        className={`pointer-events-auto flex min-w-0 items-center gap-x-3 ${ANIM} ${
          detache
            ? "flex-nowrap rounded-full border border-white bg-white/85 py-2 pl-2 pr-2 shadow-[0_12px_40px_-12px_rgba(14,15,18,0.28)] backdrop-blur-xl sm:pl-3"
            : "flex-wrap gap-y-4 border border-transparent py-4 sm:gap-x-6"
        }`}
      >
        {/* Dans la pilule d'un téléphone, le titre et le « M » s'effacent :
            la place va au nom de la campagne, qu'on ne retrouverait pas. */}
        <div className={`mr-auto flex min-w-0 items-center gap-3 ${detache ? "hidden sm:flex" : ""}`}>
          <span
            className={`flex shrink-0 items-center justify-center bg-brand font-semibold text-white ${ANIM} ${
              detache ? "h-8 w-8 rounded-full text-[13px]" : "h-11 w-11 rounded-xl text-[18px]"
            }`}
            aria-hidden
          >
            M
          </span>
          <div className="min-w-0">
            <h1 className={`truncate font-semibold leading-tight text-ink ${ANIM} ${detache ? "text-[15px]" : "text-[24px] tracking-tight"}`}>
              Meta Ads
            </h1>
            <p className={`overflow-hidden text-[12.5px] text-muted ${ANIM} ${detache ? "max-h-0 opacity-0" : "max-h-6 opacity-100"}`}>
              {lecture}
            </p>
          </div>
        </div>

        <SegmentVue vue={vue} params={params} visible={detache} />

        {/* `relative` ICI, pas sur chaque bouton : les menus s'alignent sur le
            bord droit du groupe. Calé sur le bouton de la campagne, son menu
            déborderait à gauche d'un téléphone. */}
        <div className={`relative flex min-w-0 items-center gap-2 ${enCours ? "opacity-70" : ""}`}>
          <ChoixCampagne
            campagnes={campagnes}
            choisie={campagneChoisie}
            periode={periode}
            compact={detache}
            choisir={(cle) => aller({ campagne: cle })}
          />
          <ChoixPeriode
            periode={periode}
            raccourcis={raccourcis}
            hier={hier}
            compact={detache}
            choisir={(from, to) => aller({ from, to })}
          />
        </div>
      </div>

      <p className={`overflow-hidden text-[12.5px] text-muted ${ANIM} ${detache ? "max-h-0 opacity-0" : "-mt-1 max-h-24 pb-4 opacity-100"}`}>
        {periode.parDefaut ? "Semaine mesurée" : duree} :{" "}
        <span className="text-ink">{bornes(periode.debut, periode.fin)}</span>, comparée aux {duree} d&apos;avant ({bornes(periode.avantDebut, periode.avantFin)}).
        {periode.rognee && " Le jour en cours n'est jamais compté : la période s'arrête hier."}
        {periode.arreteeAuDernierJourLu && " La dernière récolte a échoué : la période s'arrête au dernier jour lu."}
        {campagneChoisie && !campagneChoisie.connue && " La campagne demandée n'a aucune ligne sur ces dates : les chiffres sont vides, pas nuls."}
      </p>
    </header>
  );
}

/** Détaché dès que les cartes du Sélecteur de vue sont passées AU-DESSUS de
 *  l'écran — pas quand elles sont en dessous (une page ouverte en bas, un
 *  écran très court). Le bandeau rétrécit en se détachant, ce qui remonte les
 *  cartes plus loin hors de l'écran : aucun aller-retour au seuil. */
function useDetache(): boolean {
  const [detache, setDetache] = useState(false);
  useEffect(() => {
    const cible = document.getElementById(ID_SELECTEUR_VUE);
    if (!cible) return;
    // Aucune marge : les cartes doivent avoir quitté l'écran en entier. Un seuil
    // calé sur la hauteur de la pilule changerait avec elle (téléphone, barre
    // du haut) ; celui-ci ne dépend de rien.
    const o = new IntersectionObserver(([e]) => setDetache(!e.isIntersecting && e.boundingClientRect.top < 0));
    o.observe(cible);
    return () => o.disconnect();
  }, []);
  return detache;
}

// ── La vue active, repliée dans la pilule ────────────────────────────────────

function SegmentVue({ vue, params, visible }: { vue: Vue; params: Params; visible: boolean }) {
  const i = ORDRE_VUES.indexOf(vue);
  return (
    <div
      aria-hidden={!visible}
      className={`shrink-0 overflow-hidden ${ANIM} ${visible ? "max-w-[360px] opacity-100" : "pointer-events-none max-w-0 opacity-0"}`}
    >
      <nav
        aria-label="Vues"
        className="relative grid rounded-full bg-[#efeee9] p-1"
        style={{ gridTemplateColumns: `repeat(${ORDRE_VUES.length}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden
          className="absolute bottom-1 left-1 top-1 rounded-full bg-ink shadow transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          style={{ width: `calc((100% - 8px) / ${ORDRE_VUES.length})`, transform: `translateX(${i * 100}%)` }}
        />
        {ORDRE_VUES.map((v) => (
          <Link
            key={v}
            href={lienMeta(params, { vue: v })}
            scroll={false}
            tabIndex={visible ? undefined : -1}
            aria-current={v === vue ? "page" : undefined}
            title={VUES[v].titre}
            className={`relative z-10 flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-medium transition-colors duration-300 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand md:px-3.5 ${
              v === vue ? "text-white" : "text-muted hover:text-ink"
            }`}
          >
            <Icone nom={ICONE_VUE[v]} className="h-3.5 w-3.5 shrink-0" />
            <span className="sr-only md:not-sr-only">{VUES[v].titre}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

// ── Les menus ────────────────────────────────────────────────────────────────

/** Ferme le menu au clic dehors et à Échap. Le bouton qui l'ouvre compte comme
 *  dedans : sinon son propre clic le refermerait puis le rouvrirait. */
function useFermeture(ouvert: boolean, fermer: () => void, zones: RefObject<HTMLElement>[]) {
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!zones.some((z) => z.current?.contains(e.target as Node))) fermer();
    };
    const touche = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert, fermer, zones]);
}

function Menu({ ouvert, children, className = "", ref_ }: { ouvert: boolean; children: ReactNode; className?: string; ref_: RefObject<HTMLDivElement> }) {
  return (
    <div
      ref={ref_}
      hidden={!ouvert}
      className={`absolute right-0 top-[calc(100%+8px)] z-40 max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-line bg-white shadow-[0_20px_50px_rgba(14,15,18,0.16)] ${className}`}
    >
      {children}
    </div>
  );
}

function BoutonMenu({
  children,
  ouvert,
  basculer,
  controle,
  bouton,
  etiquette,
  className = "min-w-0",
}: {
  children: ReactNode;
  ouvert: boolean;
  basculer: () => void;
  controle: string;
  bouton: RefObject<HTMLButtonElement>;
  etiquette: string;
  className?: string;
}) {
  return (
    <button
      ref={bouton}
      type="button"
      onClick={basculer}
      aria-expanded={ouvert}
      aria-controls={controle}
      aria-label={etiquette}
      className={`${className} flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[13.5px] font-medium text-ink transition-all motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
        ouvert ? "border-ink/25 bg-white ring-4 ring-ink/5" : "border-line bg-white hover:border-ink/20"
      }`}
    >
      {children}
      <Icone nom="chevron" className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform motion-reduce:transition-none ${ouvert ? "rotate-180" : ""}`} />
    </button>
  );
}

const nomCampagne = (c: { nom: string }) => c.nom || "Campagne sans nom";

function Pastille({ couleur, className = "h-2.5 w-2.5" }: { couleur: string; className?: string }) {
  return <span aria-hidden className={`shrink-0 rounded-full ${className}`} style={{ background: couleur }} />;
}

// ── Le menu des campagnes (user stories 6, 7) ────────────────────────────────

function ChoixCampagne({
  campagnes,
  choisie,
  periode,
  compact,
  choisir,
}: {
  campagnes: Campagne[];
  choisie: CampagneChoisie | null;
  periode: Periode;
  compact: boolean;
  choisir: (cle: string | null) => void;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [actif, setActif] = useState(0);
  const bouton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const [fermer] = useState(() => () => setOuvert(false));
  const [zones] = useState(() => [bouton, menu]);
  useFermeture(ouvert, fermer, zones);

  const recherche = q.trim().toLocaleLowerCase("fr");
  // « Toutes les campagnes » en tête, tant qu'aucune recherche ne l'écarte.
  const options: (Campagne | null)[] = [
    ...(recherche === "" ? [null] : []),
    ...campagnes.filter((c) => nomCampagne(c).toLocaleLowerCase("fr").includes(recherche)),
  ];
  const courante = choisie ? campagnes.find((c) => c.cle === choisie.cle) ?? null : null;

  const ouvrir = () => {
    setQ("");
    setActif(0);
    setOuvert((o) => !o);
  };
  useEffect(() => {
    if (ouvert) champ.current?.focus();
  }, [ouvert]);
  const valider = (c: Campagne | null) => {
    setOuvert(false);
    bouton.current?.focus();
    if ((c?.cle ?? null) !== (choisie?.cle ?? null)) choisir(c?.cle ?? null);
  };
  const clavier = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && options[actif] !== undefined) {
      e.preventDefault();
      valider(options[actif]);
    }
  };

  const libelle = choisie
    ? choisie.connue
      ? nomCampagne(choisie)
      : "Campagne sans donnée sur ces dates"
    : compact
      ? "Toutes"
      : "Toutes les campagnes";

  return (
    <>
      <BoutonMenu ouvert={ouvert} basculer={ouvrir} controle={`${id}-menu`} bouton={bouton} etiquette={`Campagne : ${libelle}`}>
        {courante ? <Pastille couleur={courante.couleur} className="h-2 w-2" /> : <Icone nom="calques" className="h-4 w-4 shrink-0 text-muted" />}
        <span className={`min-w-0 truncate ${compact ? "max-w-[7rem] sm:max-w-[12rem]" : "max-w-[14rem]"}`}>{libelle}</span>
      </BoutonMenu>
      <Menu ouvert={ouvert} ref_={menu} className="w-[min(360px,calc(100vw-32px))] p-2">
        <div id={`${id}-menu`}>
          <label className="flex h-10 items-center gap-2 rounded-xl bg-canvas px-3 text-muted">
            <Icone nom="loupe" className="h-4 w-4 shrink-0" />
            <span className="sr-only">Chercher une campagne</span>
            <input
              ref={champ}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActif(0);
              }}
              onKeyDown={clavier}
              role="combobox"
              aria-expanded={ouvert}
              aria-controls={`${id}-liste`}
              aria-activedescendant={options.length ? `${id}-o${actif}` : undefined}
              placeholder="Chercher une campagne"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
            />
          </label>
          <p className="flex justify-between px-3 pb-1 pt-2.5 text-[11.5px] text-faint">
            <span>Campagne</span>
            <span>Dépense du {bornes(periode.debut, periode.fin)}</span>
          </p>
          <ul id={`${id}-liste`} role="listbox" aria-label="Campagnes">
            {options.map((c, i) => {
              const choisi = (c?.cle ?? null) === (choisie?.cle ?? null);
              return (
                <li
                  key={c?.cle ?? "toutes"}
                  id={`${id}-o${i}`}
                  role="option"
                  aria-selected={choisi}
                  onMouseEnter={() => setActif(i)}
                  onClick={() => valider(c)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] ${
                    i === actif ? "bg-canvas" : ""
                  } ${choisi ? "font-semibold" : ""}`}
                >
                  {c ? <Pastille couleur={c.couleur} /> : <Icone nom="calques" className="h-4 w-4 shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{c ? nomCampagne(c) : "Toutes les campagnes"}</span>
                    {c?.sansId && <span className="block text-[12px] font-normal text-faint">Avant l&apos;identifiant Meta, regroupée par son nom</span>}
                  </span>
                  {c && (
                    <span className="shrink-0 text-[12.5px] font-normal tabular-nums text-muted" title={c.depense === null ? "Aucune ligne sur la période : rien de dépensé n'a été lu." : undefined}>
                      {c.depense === null ? TIRET : `${nombre(c.depense)} ${DEVISE}`}
                    </span>
                  )}
                  <Icone nom="coche" className={`h-4 w-4 shrink-0 text-brand ${choisi ? "opacity-100" : "opacity-0"}`} />
                </li>
              );
            })}
            {options.length === 0 && <li className="px-3 py-3 text-[13.5px] text-muted">Aucune campagne ne porte « {q.trim()} » sur cette période.</li>}
          </ul>
        </div>
      </Menu>
    </>
  );
}

// ── La période (user stories 8, 9) ───────────────────────────────────────────

const JOURS_SEMAINE = ["L", "M", "M", "J", "V", "S", "D"];

function ChoixPeriode({
  periode,
  raccourcis,
  hier,
  compact,
  choisir,
}: {
  periode: Periode;
  raccourcis: Raccourci[];
  hier: string;
  compact: boolean;
  choisir: (from: string | null, to: string | null) => void;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  // Le mois de DROITE ; celui de gauche le précède. Il repart à chaque
  // ouverture du mois où finit la période affichée : on la voit en ouvrant.
  const [droite, setDroite] = useState(periode.fin.slice(0, 7));
  const [premier, setPremier] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [fermer] = useState(() => () => {
    setOuvert(false);
    setPremier(null);
  });
  const [zones] = useState(() => [bouton, menu]);
  useFermeture(ouvert, fermer, zones);

  const actif = raccourcis.find((r) => r.actif) ?? null;
  const ouvrir = () => {
    setDroite(periode.fin.slice(0, 7));
    setPremier(null);
    setOuvert((o) => !o);
  };
  const valider = (from: string | null, to: string | null) => {
    fermer();
    bouton.current?.focus();
    choisir(from, to);
  };
  const clic = (jour: string) => {
    if (premier === null) {
      setPremier(jour);
      return;
    }
    const p = periodeEntre(premier, jour);
    valider(p.from, p.to);
  };

  // Ce qui est surligné : la période affichée, ou celle qu'on trace entre le
  // premier clic et le jour survolé — avec la période d'avant qu'elle lira.
  const trace = premier !== null ? periodeEntre(premier, survol ?? premier) : { from: periode.debut, to: periode.fin };
  const avant = periodeAvant(trace.from, trace.to);
  const libelle = actif ? actif.nom : bornes(periode.debut, periode.fin);
  // Dans la pilule, la durée seule : « 14 j » se lit, « 10 ao… » non. Les
  // dates restent dans l'étiquette du bouton et à un geste, dans le menu.
  const court = compact ? `${periode.jours} j` : libelle;

  return (
    <>
      <BoutonMenu ouvert={ouvert} basculer={ouvrir} controle={`${id}-menu`} bouton={bouton} etiquette={`Période : ${libelle}`}
        // Compacte, la durée est courte : c'est le nom de la campagne qui cède.
        className={compact ? "shrink-0" : "min-w-0"}>
        <Icone nom="calendrier" className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 truncate tabular-nums">{court}</span>
        {actif && !compact && <span className="hidden font-normal text-faint xl:inline">{bornes(periode.debut, periode.fin)}</span>}
      </BoutonMenu>
      <Menu ouvert={ouvert} ref_={menu} className="w-[min(680px,calc(100vw-32px))]">
        <div id={`${id}-menu`} className="flex min-w-0 flex-col sm:flex-row">
          <div className="min-w-0 shrink-0 border-b border-line p-2 sm:w-[200px] sm:border-b-0 sm:border-r">
            <ul className="grid grid-cols-2 gap-0.5 sm:grid-cols-1">
              {raccourcis.map((r) => (
                <li key={r.jours} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => valider(r.from, r.to)}
                    aria-pressed={r.actif}
                    className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[13.5px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                      r.actif ? "bg-[#f1f4ff] font-semibold" : "hover:bg-canvas"
                    }`}
                  >
                    <span className="min-w-0 truncate">{r.nom}</span>
                    {r.actif && <Icone nom="coche" className="h-4 w-4 shrink-0 text-brand" />}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-line px-3 pt-3 text-[11.5px] leading-snug text-faint">
              Toujours comparée à la période d&apos;avant, de même durée. Le jour en cours n&apos;est jamais compté.
            </p>
          </div>

          <div className="min-w-0 flex-1 p-4">
            <div className="grid min-w-0 gap-5 sm:grid-cols-2">
              {[moisVoisin(droite, -1), droite].map((cle, i) => {
                const m = moisCalendrier(cle);
                return (
                  <div key={cle} className="min-w-0">
                    <div className="mb-2 flex items-center justify-between">
                      <BoutonMois visible={i === 0} etiquette="Mois précédent" sens="avant" onClick={() => setDroite(moisVoisin(droite, -1))} />
                      <p className="min-w-0 truncate text-[13px] font-semibold text-ink first-letter:uppercase">{m.nom}</p>
                      <BoutonMois
                        visible={i === 1}
                        desactive={droite >= hier.slice(0, 7)}
                        etiquette="Mois suivant"
                        sens="apres"
                        onClick={() => setDroite(moisVoisin(droite, 1))}
                      />
                    </div>
                    <div className="mb-1 grid grid-cols-7 text-center text-[11px] text-faint" aria-hidden>
                      {JOURS_SEMAINE.map((j, k) => (
                        <span key={k}>{j}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => setSurvol(null)}>
                      {m.cases.map((jour, k) => {
                        if (jour === null) return <span key={k} />;
                        const futur = jour > hier;
                        const dans = jour >= trace.from && jour <= trace.to;
                        const bord = jour === trace.from || jour === trace.to;
                        return (
                          <button
                            key={jour}
                            type="button"
                            disabled={futur}
                            onClick={() => clic(jour)}
                            onMouseEnter={() => setSurvol(jour)}
                            onFocus={() => setSurvol(jour)}
                            aria-label={dateCourte(jour)}
                            aria-pressed={dans}
                            title={futur ? "Le jour en cours et les suivants ne sont pas encore lus." : undefined}
                            className={`h-8 min-w-0 text-[12.5px] tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                              futur
                                ? "cursor-not-allowed text-[#d5d4ce]"
                                : dans
                                  ? bord
                                    ? "rounded-lg bg-ink font-semibold text-white"
                                    : "bg-[#eef2ff] text-ink"
                                  : "rounded-lg text-ink hover:bg-canvas"
                            }`}
                          >
                            {Number(jour.slice(8))}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[12.5px] text-muted" aria-live="polite">
              {premier === null
                ? "Ou clique le premier et le dernier jour d'une période sur mesure."
                : `${bornes(trace.from, trace.to)}, ${jours(avant.jours)}, comparée au ${bornes(avant.avantDebut, avant.avantFin)}. Clique le dernier jour.`}
            </p>
          </div>
        </div>
      </Menu>
    </>
  );
}

function BoutonMois({
  visible,
  desactive = false,
  etiquette,
  sens,
  onClick,
}: {
  visible: boolean;
  desactive?: boolean;
  etiquette: string;
  sens: "avant" | "apres";
  onClick: () => void;
}) {
  if (!visible) return <span className="h-7 w-7" aria-hidden />;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-label={etiquette}
      className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <Icone nom="chevron" className={`h-4 w-4 ${sens === "avant" ? "rotate-90" : "-rotate-90"}`} />
    </button>
  );
}
