"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import type { SemaineHebdo } from "@/lib/hebdo/semaine";
import { SOURCE } from "@/lib/plateformes";
import { MOIS } from "@/lib/jour-de-travail";
import {
  ajouteJours,
  cleStatut,
  decalageDuJour,
  jourDeLAnnee,
  joursDansAnnee,
  nomStatut,
  segments,
  semaineDecalee,
  tourneDans,
  type Bornes,
  type CampagneFrise,
  type CleStatut,
  type FriseHebdo,
} from "@/lib/hebdo/frise";

export type Zoom = "annee" | "mois";

// Au Mois, 20 px par jour : celui de la maquette validée (variante E), où une
// campagne d'une semaine se lit avec son nom. À l'Année, la frise tient dans
// la largeur.
const PX_PAR_JOUR_MOIS = 20;
// Au Mois, seules les campagnes qui vivent à ± 6 semaines de la semaine
// choisie : sinon le mois se lit entre des rangées vides (maquette).
const VOISINAGE_SEMAINES = 6;
const PLATEFORMES = ["meta", "google"] as const;

export function FriseAnnee({
  frise,
  semaine,
  w,
  zoom,
  masques,
  recentrer,
  onChoisir,
}: {
  frise: FriseHebdo;
  semaine: SemaineHebdo;
  w: number;
  zoom: Zoom;
  masques: ReadonlySet<CleStatut>;
  /** Change quand la frise doit se recentrer sur la semaine choisie. */
  recentrer: number;
  onChoisir: (w: number) => void;
}) {
  const vue = useRef<HTMLDivElement>(null);
  const annee = frise.annee;
  const nj = joursDansAnnee(annee);
  const choisie = semaineDecalee(semaine, w);
  const pct = (iso: string) => (Math.min(nj, Math.max(0, jourDeLAnnee(iso, annee))) / nj) * 100;

  useEffect(() => {
    const el = vue.current;
    if (!el || zoom !== "mois") return;
    const x = (jourDeLAnnee(choisie.debut, annee) + 3.5) * PX_PAR_JOUR_MOIS;
    el.scrollLeft = Math.max(0, x - el.clientWidth / 2);
    // Seuls `recentrer` et le zoom déplacent la vue — voir `FriseEtPanneau`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentrer, zoom]);

  const voisinage: Bornes = {
    debut: semaineDecalee(semaine, w + VOISINAGE_SEMAINES).debut,
    fin: semaineDecalee(semaine, Math.max(0, w - VOISINAGE_SEMAINES)).fin,
  };
  const visibles = frise.campagnes.filter(
    (c) =>
      !masques.has(cleStatut(c)) &&
      (zoom === "annee" || tourneEntre(c, voisinage, semaine, annee))
  );

  const cliquer = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const jour = Math.floor(((e.clientX - r.left) / r.width) * nj);
    const iso = new Date(Date.UTC(annee, 0, 1 + jour)).toISOString().slice(0, 10);
    onChoisir(decalageDuJour(semaine, annee, iso));
  };

  return (
    <div
      ref={vue}
      className="relative overflow-auto max-h-[560px] rounded-xl border border-line bg-white defile"
    >
      <div
        className="relative cursor-pointer pb-2"
        style={{ width: zoom === "annee" ? "100%" : `${nj * PX_PAR_JOUR_MOIS}px` }}
        onClick={cliquer}
      >
        {/* Le fond : les mois en bandes, la semaine choisie en surbrillance. */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {MOIS.map((m, i) => {
            const d = `${annee}-${String(i + 1).padStart(2, "0")}-01`;
            const f = i < 11 ? `${annee}-${String(i + 2).padStart(2, "0")}-01` : `${annee + 1}-01-01`;
            return (
              <div
                key={m}
                className={`absolute inset-y-0 ${i % 2 ? "bg-canvas" : ""}`}
                style={{ left: `${pct(d)}%`, width: `${pct(f) - pct(d)}%` }}
              />
            );
          })}
          <div
            className="absolute inset-y-0 bg-brand/10 ring-1 ring-inset ring-brand/50 rounded"
            style={{ left: `${pct(choisie.debut)}%`, width: `${(7 / nj) * 100}%` }}
          />
        </div>

        <div className="relative h-7">
          {MOIS.map((m, i) => (
            <span
              key={m}
              className="absolute top-1.5 text-[11px] text-faint whitespace-nowrap"
              style={{ left: `calc(${pct(`${annee}-${String(i + 1).padStart(2, "0")}-01`)}% + 6px)` }}
            >
              {zoom === "annee" ? m.slice(0, 3) : m}
            </span>
          ))}
        </div>

        {visibles.length === 0 && (
          <p className="sticky left-0 px-3 py-6 text-[12.5px] text-muted">
            {frise.campagnes.length === 0
              ? `Aucune campagne en ${annee}.`
              : "Aucune campagne à afficher ici."}
          </p>
        )}

        {PLATEFORMES.map((p) => {
          const rangees = visibles
            .filter((c) => c.plateforme === p)
            .sort((a, b) => a.debut.localeCompare(b.debut));
          if (rangees.length === 0) return null;
          return (
            <div key={p} className="relative mt-1">
              <div className="sticky left-2 inline-block text-[10.5px] font-bold uppercase tracking-wide px-1 py-0.5"
                style={{ color: SOURCE[p].couleur }}>
                {SOURCE[p].glyphe} {SOURCE[p].nom}
              </div>
              {rangees.map((c) => (
                <Barre key={c.id} c={c} semaine={semaine} annee={annee} choisie={choisie} pct={pct} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function tourneEntre(c: CampagneFrise, b: Bornes, semaine: SemaineHebdo, annee: number): boolean {
  const { plein, pointilles } = segments(c, semaine, annee);
  return [plein, pointilles].some((s) => s !== null && s.debut <= b.fin && s.fin >= b.debut);
}

function Barre({
  c,
  semaine,
  annee,
  choisie,
  pct,
}: {
  c: CampagneFrise;
  semaine: SemaineHebdo;
  annee: number;
  choisie: Bornes;
  pct: (iso: string) => number;
}) {
  const { plein, pointilles } = segments(c, semaine, annee);
  const couleur = SOURCE[c.plateforme].couleur;
  const supprimee = c.statut === "supprimee";
  const active = tourneDans(c, choisie, semaine);
  // Bornes incluses : le dernier jour compte, d'où le jour ajouté à droite.
  const largeur = (s: Bornes) => pct(ajouteJours(s.fin, 1)) - pct(s.debut);
  const depart = plein ?? pointilles;
  if (!depart) return null;

  return (
    <div className="relative h-6" title={`${c.nom} · ${nomStatut(c)}`}>
      {plein && (
        <div
          className="absolute top-[3px] h-[18px] rounded-full"
          style={{
            left: `${pct(plein.debut)}%`,
            width: `max(6px, ${largeur(plein)}%)`,
            background: supprimee ? "rgba(139,142,152,0.18)" : `${couleur}1f`,
            boxShadow: active ? `inset 0 0 0 1.5px ${supprimee ? "#8b8e98" : couleur}` : "none",
            opacity: active ? 1 : 0.55,
          }}
        />
      )}
      {pointilles && (
        <div
          className="absolute top-[11px] border-t-2 border-dashed"
          style={{
            left: `${pct(pointilles.debut)}%`,
            width: `${largeur(pointilles)}%`,
            borderColor: couleur,
            opacity: 0.45,
          }}
        />
      )}
      <span
        className={`absolute top-[3px] h-[18px] flex items-center gap-1.5 pl-1 pr-2 text-[11.5px] whitespace-nowrap pointer-events-none ${
          supprimee ? "text-faint line-through" : "text-ink"
        } ${active ? "" : "opacity-70"}`}
        style={{ left: `${pct(depart.debut)}%` }}
      >
        {c.visuels[0] ? (
          // Les créas vivent dans le Storage Supabase : `next/image` demanderait
          // d'y déclarer le domaine, pour une vignette de 14 px.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.visuels[0]} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
        ) : (
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: couleur }} />
        )}
        {c.nom}
      </span>
    </div>
  );
}
