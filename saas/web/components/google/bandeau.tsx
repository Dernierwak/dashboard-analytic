"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BoutonMenu, ChoixPeriode, Menu, useFermeture } from "@/components/meta/bandeau";
import { Icone } from "@/components/meta/elements";
import { ICONE_VUE, ID_SELECTEUR_VUE, ReperType } from "@/components/google/elements";
import {
  bornes,
  nombre,
  DEVISE,
  ORDRE_VUES,
  TIRET,
  VUES,
  type Campagne,
  type CampagneChoisie,
  type Periode,
  type Raccourci,
  type Vue,
} from "@/lib/google/lecture";
import { lienGoogle, METRIQUES_DE_LA_VUE, type Params } from "@/lib/google/liens";

// ── MODULE 1 · LE BANDEAU DE COMMANDES ───────────────────────────────────────
//
// Spec Google, § « Solution », module 1 ; user stories 1, 8 à 13. Le module
// Meta de même nom (`components/meta/bandeau.tsx`) avec les chiffres de
// Google : le titre, la date à laquelle Pulse a lu Google, la campagne (menu
// avec recherche, pastille et coût de la période) et la période — le
// calendrier de Meta, repris tel quel comme le fait Instagram, toujours
// comparée à la période d'avant de même durée. Pas de menu de groupe : Google
// ne filtre que par campagne au Bandeau (ticket 01). Chaque campagne du menu
// porte son repère de type (ticket 02) ; pas de filtre par type au Bandeau
// (spec, § « La structure » : abandonné).
//
// Au défilement, dès que les cartes du Sélecteur de vue sortent de l'écran, il
// se détache en pilule flottante et la vue active s'y replie. L'animation se
// coupe pour qui a réduit les animations (`motion-reduce:`).
//
// Tout l'état vit dans l'URL ; chaque geste change UN réglage et garde les
// autres (`lienGoogle`).

const jours = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;

const ANIM = "transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none";

export function BandeauGoogle({
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
  const aller = (patch: Record<string, string | null>) => demarrer(() => router.push(lienGoogle(params, patch), { scroll: false }));
  const detache = useDetache();
  const duree = jours(periode.jours);

  return (
    <header
      aria-busy={enCours}
      // `top-[53px]` sous `lg` : la barre du téléphone (`side-nav.tsx`) est elle
      // aussi collée en haut ; à `top-0`, le Bandeau la recouvrait (mesuré sur Meta).
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
        <div className={`mr-auto flex min-w-0 items-center gap-3 ${detache ? "hidden sm:flex" : ""}`}>
          <span
            className={`flex shrink-0 items-center justify-center bg-brand font-semibold text-white ${ANIM} ${
              detache ? "h-8 w-8 rounded-full text-[13px]" : "h-11 w-11 rounded-xl text-[18px]"
            }`}
            aria-hidden
          >
            G
          </span>
          <div className="min-w-0">
            <h1 className={`truncate font-semibold leading-tight text-ink ${ANIM} ${detache ? "text-[15px]" : "text-[24px] tracking-tight"}`}>
              Google Ads
            </h1>
            <p className={`overflow-hidden text-[12.5px] text-muted ${ANIM} ${detache ? "max-h-0 opacity-0" : "max-h-6 opacity-100"}`}>
              {lecture}
            </p>
          </div>
        </div>

        <SegmentVue vue={vue} params={params} visible={detache} />

        <div className={`relative flex min-w-0 items-center gap-2 ${enCours ? "opacity-70" : ""}`}>
          {/* Choisir une campagne retire le niveau Campagnes de la Comparaison :
              ses cases ne désigneraient plus rien, elle repart du pré-cochage. */}
          <ChoixCampagne campagnes={campagnes} choisie={campagneChoisie} periode={periode} compact={detache} choisir={(cle) => aller({ campagne: cle, comparer: null })} />
          <ChoixPeriode periode={periode} raccourcis={raccourcis} hier={hier} compact={detache} choisir={(from, to) => aller({ from, to })} />
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
 *  l'écran — pas quand elles sont en dessous. Le bandeau rétrécit en se
 *  détachant, ce qui remonte les cartes plus loin : aucun aller-retour au seuil. */
function useDetache(): boolean {
  const [detache, setDetache] = useState(false);
  useEffect(() => {
    const cible = document.getElementById(ID_SELECTEUR_VUE);
    if (!cible) return;
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
    <div aria-hidden={!visible} className={`shrink-0 overflow-hidden ${ANIM} ${visible ? "max-w-[360px] opacity-100" : "pointer-events-none max-w-0 opacity-0"}`}>
      <nav aria-label="Vues" className="relative grid rounded-full bg-[#efeee9] p-1" style={{ gridTemplateColumns: `repeat(${ORDRE_VUES.length}, minmax(0, 1fr))` }}>
        <span
          aria-hidden
          className="absolute bottom-1 left-1 top-1 rounded-full bg-ink shadow transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          style={{ width: `calc((100% - 8px) / ${ORDRE_VUES.length})`, transform: `translateX(${i * 100}%)` }}
        />
        {ORDRE_VUES.map((v) => (
          <Link
            key={v}
            href={lienGoogle(params, { vue: v, ...METRIQUES_DE_LA_VUE })}
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

// ── Le menu de la campagne (user story 8) ────────────────────────────────────

function Pastille({ couleur, className = "h-2.5 w-2.5" }: { couleur: string; className?: string }) {
  return <span aria-hidden className={`shrink-0 rounded-full ${className}`} style={{ background: couleur }} />;
}


const TOUTES = "Toutes les campagnes";
const SANS_NOM = "Campagne sans nom";

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
  const nomDe = (c: { nom: string }) => c.nom || SANS_NOM;
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
    ...campagnes.filter((c) => nomDe(c).toLocaleLowerCase("fr").includes(recherche)),
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

  const libelle = choisie ? (choisie.connue ? nomDe(choisie) : "Campagne sans donnée sur ces dates") : compact ? "Toutes" : TOUTES;

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
            <span>Coût du {bornes(periode.debut, periode.fin)}</span>
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
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] ${i === actif ? "bg-canvas" : ""} ${choisi ? "font-semibold" : ""}`}
                >
                  {c ? <Pastille couleur={c.couleur} /> : <Icone nom="calques" className="h-4 w-4 shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-ink">{c ? nomDe(c) : TOUTES}</span>
                      {c?.type && <ReperType type={c.type} />}
                    </span>
                    {c?.sansId && <span className="block truncate text-[12px] font-normal text-faint">Sans identifiant Google, regroupée par son nom</span>}
                  </span>
                  {c && (
                    <span className="shrink-0 text-[12.5px] font-normal tabular-nums text-muted" title={c.cout === null ? "Aucune ligne sur la période : aucun coût n'a été lu." : undefined}>
                      {c.cout === null ? TIRET : `${nombre(c.cout)} ${DEVISE}`}
                    </span>
                  )}
                  <Icone nom="coche" className={`h-4 w-4 shrink-0 text-brand ${choisi ? "opacity-100" : "opacity-0"}`} />
                </li>
              );
            })}
            {options.length === 0 && <li className="px-3 py-3 text-[13.5px] text-muted">Aucun nom ne porte « {q.trim()} » sur cette période.</li>}
          </ul>
        </div>
      </Menu>
    </>
  );
}
