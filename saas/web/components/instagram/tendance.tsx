"use client";

import { useState } from "react";
import { TendanceGraphe } from "@/components/instagram/tendance-graphe";
import { dateBulle, formaterEcart, nombre } from "@/lib/meta/lecture";
import { dateCourte, TIRET } from "@/lib/instagram/tableau";
import {
  lienDuPost,
  NOM_VENTILATION,
  VENTILATIONS,
  type ParamsUrl,
  type Serie,
  type SerieComptable,
  type Somme,
  type Tendance,
  type Ventilation,
} from "@/lib/instagram/tendance";

// ── LA TENDANCE « TA PAGE » ──────────────────────────────────────────────────
//
// Spec § La page — Tendance ; user stories 6 à 10. Le compte seul : à gauche
// les abonnés en grand (courbe du total, barres gagnés / perdus dessous), à
// droite la portée et les interactions empilées. Aucune table dessous : les
// valeurs sont dans l'infobulle (spec, Out of Scope).
//
// L'interrupteur Tout / Organique / Boosté vit dans l'état du composant, pas
// dans l'URL : la spec ne met dans l'URL que les Règles de lecture et le post
// ouvert, et il ne touche à rien d'autre sur la page — ni à « sans les
// boostés », ni à l'Objectif.
//
// Composant client : le graphe suit le pointeur et reçoit des fonctions de
// format, qui ne traversent pas la frontière serveur → client.

const valeur = (v: number | null) => (v === null ? TIRET : nombre(v));

/** « sur 5 jours lus des 7 » quand des jours manquent : une somme partielle
 *  ne se lit pas comme le total de la période. */
function couverture(s: Somme): string | null {
  if (s.total === null || s.lus === s.sur) return null;
  return `sur ${s.lus} jour${s.lus > 1 ? "s" : ""} lu${s.lus > 1 ? "s" : ""} des ${s.sur}`;
}

function Ecart({ e }: { e: number | null }) {
  if (e === null) return null;
  // Aucune couleur de jugement : plus de portée n'est pas « bien » en soi, et
  // Pulse ne conseille rien (`CLAUDE.md` §1).
  return <span className="rounded-full bg-canvas px-2 py-0.5 text-[12px] font-medium tabular-nums text-ink">{formaterEcart(e)}</span>;
}

function Raison({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 max-w-prose text-[12.5px] leading-snug text-muted">{children}</p>;
}

export function TendanceTaPage({ tendance: t, params }: { tendance: Tendance; params: ParamsUrl }) {
  const [vent, setVent] = useState<Ventilation>("tout");
  const etiquettes = t.dates.map(dateBulle);
  const etiquettesAvant = t.datesAvant.map(dateBulle);
  const lien = (id: string) => lienDuPost(params, id);
  const commun = { etiquettes, etiquettesAvant, recents: t.recents, publications: t.publications, lienDuPost: lien, format: valeur };

  const portee: Serie | null = vent === "tout" ? t.portee.tout : vent === "booste" ? t.portee.booste : null;
  const inter: SerieComptable = t.interactions[vent];

  return (
    <section aria-labelledby="titre-ta-page">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="titre-ta-page" className="text-[22px] font-semibold tracking-tight text-ink">Ta page</h2>
          <p className="mt-1 text-[14px] text-muted">Ton compte jour par jour, hors de tes posts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded-full bg-[#7b4fff]" /> Cette période</span>
          <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-faint" /> Période d&apos;avant</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7b4fff]" /> Un jour de publication</span>
          <span title="Meta complète les chiffres du compte jusqu'à 48 h après la fin d'un jour.">◔ Peut encore changer</span>
          <span title="Un jour sans chiffre récolté n'est pas un zéro : la courbe s'y interrompt.">Un trou = aucun chiffre ce jour-là</span>
          <div role="radiogroup" aria-label="Part de la portée et des interactions" className="flex rounded-full border border-line bg-white p-0.5">
            {VENTILATIONS.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={vent === v}
                onClick={() => setVent(v)}
                className={`rounded-full px-3 py-1 text-[12.5px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${vent === v ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              >
                {NOM_VENTILATION[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {t.illisible && <p className="mb-4 rounded-xl bg-canvas px-4 py-3 text-[13px] text-warn">{t.illisible}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Les abonnés : l'interrupteur n'y change rien, Meta ne les ventile pas. */}
        <div className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5 sm:p-6 lg:row-span-2">
          <h3 className="text-[13px] font-normal text-muted">Abonnés</h3>
          <p className="mt-2 text-[44px] font-semibold leading-none tracking-tight tabular-nums text-ink">{valeur(t.abonnes.dernier?.valeur ?? null)}</p>
          <p className="mt-2 text-[12.5px] text-muted">
            {t.abonnes.dernier ? `au ${dateCourte(t.abonnes.dernier.jour)}` : "Aucun total d'abonnés mesuré sur la période."}
          </p>
          <p className="mt-1 text-[12.5px] tabular-nums text-muted">
            <span className="text-pos">{valeur(t.abonnes.sommeGagnes.total)} gagnés</span>
            {couverture(t.abonnes.sommeGagnes) && <span className="text-faint"> ({couverture(t.abonnes.sommeGagnes)})</span>}
            {" · "}
            <span className="text-neg">{valeur(t.abonnes.sommePerdus.total)} perdus</span>
            {couverture(t.abonnes.sommePerdus) && <span className="text-faint"> ({couverture(t.abonnes.sommePerdus)})</span>}
            {" sur la période"}
          </p>
          {vent !== "tout" && <Raison>L&apos;interrupteur ne change rien ici : Meta ne sépare pas les abonnés venus d&apos;un boost.</Raison>}
          <div className="mt-auto min-w-0 pt-6">
            <TendanceGraphe
              {...commun}
              titre="Abonnés, jour par jour : le total, puis les gagnés et les perdus"
              serie={t.abonnes.serie}
              serieAvant={t.abonnes.serieAvant}
              depuisZero={false}
              hauteur={300}
              barres={{ gagnes: t.abonnes.gagnes, perdus: t.abonnes.perdus }}
            />
          </div>
        </div>

        <div className={`flex min-w-0 flex-col rounded-2xl border border-line p-5 sm:p-6 ${portee ? "bg-white" : "bg-canvas"}`}>
          <h3 className="text-[13px] font-normal text-muted">Portée du compte{vent !== "tout" && ` · ${NOM_VENTILATION[vent].toLowerCase()}`}</h3>
          {vent === "organique" ? (
            <>
              <p className="mt-2 text-[28px] font-semibold leading-none text-faint">{TIRET}</p>
              <Raison>{t.portee.organique.raison}</Raison>
            </>
          ) : vent === "booste" ? (
            <>
              <p className="mt-2 text-[28px] font-semibold leading-none text-faint">{TIRET}</p>
              <Raison>{t.portee.raisonPeriodeBoostee} Les jours ci-dessous sont la part boostée de chaque jour.</Raison>
            </>
          ) : t.portee.periode.etat === "lue" ? (
            <>
              <div className="mt-2 flex items-start justify-between gap-3">
                <p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink">{nombre(t.portee.periode.reach)}</p>
                <Ecart e={t.portee.ecart} />
              </div>
              <p className="mt-2 text-[12.5px] text-muted">comptes touchés sur la période, chacun compté une fois</p>
              <p className="mt-1 text-[12px] text-faint">
                {t.portee.periodeAvant.etat === "lue"
                  ? `contre ${nombre(t.portee.periodeAvant.reach)} la période d'avant`
                  : `la période d'avant : ${TIRET} — ${t.portee.periodeAvant.raison}`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-[28px] font-semibold leading-none text-faint">{TIRET}</p>
              <Raison>{t.portee.periode.raison}</Raison>
            </>
          )}
          {portee && (
            <div className="mt-auto min-w-0 pt-4">
              {portee.raisonVide && <Raison>{portee.raisonVide}</Raison>}
              <TendanceGraphe {...commun} titre="Portée du compte, jour par jour" serie={portee.serie} serieAvant={portee.serieAvant} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h3 className="text-[13px] font-normal text-muted">Interactions du compte{vent !== "tout" && ` · ${NOM_VENTILATION[vent].toLowerCase()}`}</h3>
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink">{valeur(inter.somme.total)}</p>
            <Ecart e={inter.ecart} />
          </div>
          <p className="mt-2 text-[12.5px] text-muted">
            sur la période{couverture(inter.somme) && <span className="text-faint"> ({couverture(inter.somme)})</span>}
          </p>
          <p className="mt-1 text-[12px] text-faint">
            contre {valeur(inter.sommeAvant.total)} la période d&apos;avant
            {couverture(inter.sommeAvant) && ` (${couverture(inter.sommeAvant)})`}
          </p>
          <div className="mt-auto min-w-0 pt-4">
            {inter.raisonVide && <Raison>{inter.raisonVide}</Raison>}
            <TendanceGraphe {...commun} titre="Interactions du compte, jour par jour" serie={inter.serie} serieAvant={inter.serieAvant} />
          </div>
        </div>
      </div>
    </section>
  );
}
