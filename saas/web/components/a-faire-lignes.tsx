"use client";

import { useState, useTransition } from "react";
import {
  completeNote,
  markRecoDone,
  resolveAction,
  saveNoteOuverte,
  saveRecoFeedback,
} from "@/app/actions";
import type { ConseilAFaire } from "@/lib/a-faire";
import type { TrackedAction } from "@/lib/report";
import { Effet, dateCourte } from "@/components/etat-action";
import { Erreur } from "@/components/erreur";

// ── LA LISTE DU MODULE « À FAIRE », ET SES GESTES ────────────────────────────
//
// LA LIGNE, PAS LA CARTE. Le conseil est EXPLIQUÉ sur la carte de son thème
// (pourquoi, comment vérifier, effort) et EXPÉDIÉ ici : titre, thème, gestes.
// Déplier la carte entière dans le module sortirait le conseil de son thème,
// alors que le thème est ce qui le rend légitime. Le titre est un lien ancré
// vers l'endroit où il s'explique.
//
// LES GESTES SONT DANS LE MODULE, et c'est la raison d'être de tout ça : la
// liste qui se vide EST la récompense, on ne peut pas devoir la quitter pour la
// vider. Le doublon de boutons avec la carte est assumé, et le précédent est
// écrit dans `reco-actions.tsx` : « c'est la MÊME ligne écrite par la MÊME
// server action, avec deux points d'entrée ».
//
// UN SEUL ÉTAT POUR TOUTE LA LISTE, ET C'EST LE COMPTEUR QUI L'EXIGE. Chaque
// ligne a d'abord porté son propre « je suis partie » : la ligne disparaissait
// bien au clic, mais le compteur, rendu côté serveur, ne descendait qu'au retour
// de `revalidatePath` — pendant une fraction de seconde, le chiffre contredisait
// la liste qu'il compte. Or ne pas pouvoir se contredire est la seule chose que
// ce module doit garantir. L'état monte donc ici, et le compteur se lit sur lui.
//
// PAS D'ÉCRAN DE FÉLICITATIONS, pas de barre de complétion, pas d'animation —
// refusés deux fois par la carte de refonte : une barre de progression peut
// RÉDUIRE la complétion, et féliciter d'avoir cliqué félicite le clic. On ne
// fête que le mesuré, à l'arrivée d'un verdict `better`.

type Reponse = { ok: boolean; message?: string };

/** Une ligne de verdict ou de conseil, avec l'ancre que le serveur a calculée
 *  pour elle — aucun lien ne se recalcule ici. */
export type VerdictRendu = { a: TrackedAction; ancre: string | null };
export type ConseilRendu = { c: ConseilAFaire; ancre: string };

/** Ce que les trois sortes de lignes reçoivent pour agir. */
type Gestes = {
  poser: (cle: string, travail: () => Promise<Reponse>) => void;
  pending: boolean;
  oublier: (cle: string) => void;
};

/** La même clé-règle peut vivre sur deux thèmes : l'identité d'une ligne de
 *  conseil, c'est la paire. */
const cleConseil = (c: ConseilAFaire) => `${c.key}:${c.theme ?? ""}`;

function Bouton({
  children,
  onClick,
  disabled,
  ton = "clair",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ton?: "encre" | "clair";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-[11.5px] font-semibold rounded-full px-3 py-1.5 border transition-colors disabled:opacity-50 whitespace-nowrap ${
        ton === "encre"
          ? "bg-ink text-white border-ink hover:opacity-90"
          : "border-line text-muted bg-white hover:bg-black/[0.03]"
      }`}
    >
      {children}
    </button>
  );
}

/** L'enveloppe commune : le surtitre, le titre, les gestes à droite. */
function Ligne({
  titre,
  ancre,
  surtitre,
  erreur,
  onFermerErreur,
  children,
}: {
  titre: string;
  /** `null` pour ce qu'on s'est écrit soi-même : il n'y a rien à aller lire. */
  ancre: string | null;
  surtitre: React.ReactNode;
  erreur?: string;
  onFermerErreur: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-line py-2.5 flex items-start gap-3 flex-wrap">
      <div className="min-w-0 flex-1 basis-[240px]">
        <div className="text-[10px] uppercase tracking-widest text-faint font-semibold">
          {surtitre}
        </div>
        <div className="text-[13.5px] text-ink leading-snug mt-0.5">
          {ancre ? (
            <a href={ancre} className="hover:text-brand hover:underline">
              {titre}
            </a>
          ) : (
            titre
          )}
        </div>
        {erreur && <Erreur texte={erreur} onFermer={onFermerErreur} />}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

/** Le thème d'une ligne, quand elle en a un. */
function MotTheme({ theme }: { theme: string | null }) {
  if (!theme) return null;
  return <span className="text-muted normal-case tracking-normal"> · {theme}</span>;
}

/** UN VERDICT EST TOMBÉ — la seule chose du module qui soit le résultat de TON
 *  travail, d'où sa place en tête. Un seul geste : le regarder et le ranger. */
function LigneVerdict({ v, poser, pending, oublier, erreur }: { v: VerdictRendu; erreur?: string } & Gestes) {
  const { a } = v;
  return (
    <Ligne
      titre={a.title}
      ancre={v.ancre}
      surtitre={
        <>
          {/* « VERDICT » SEULEMENT QUAND IL Y EN A UN. Une action arrivée à
              échéance sans indicateur mesurable n'a rien à montrer : le worker
              n'a pas pu la juger, et l'appeler verdict laisserait croire à une
              mesure qui n'existe pas (`CLAUDE.md` §7). C'est le mot du rail —
              « à juger » — qui est alors juste. */}
          {a.verdict ? `Verdict du ${dateCourte(a.check_at)}` : "À juger"}
          <MotTheme theme={a.theme} />
        </>
      }
      erreur={erreur}
      onFermerErreur={() => oublier(a.id)}
    >
      <span className="text-[11.5px]">
        <Effet a={a} />
      </span>
      <Bouton
        ton="encre"
        disabled={pending}
        onClick={() => poser(a.id, () => resolveAction(a.id, "seen"))}
      >
        ✓ Vu — je range
      </Bouton>
    </Ligne>
  );
}

/** CE QUE TU T'ES ÉCRIT TOI-MÊME. Elle se coche, et c'est en la cochant qu'elle
 *  se date : le calendrier est le sien, pas celui d'un verdict — elle n'en aura
 *  jamais. Libre vers le passé, comme toute Note (« on note souvent le lendemain
 *  ce qu'on a fait la veille »), jamais dans le futur. */
function LigneNote({ a, poser, pending, oublier, erreur }: { a: TrackedAction; erreur?: string } & Gestes) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [jour, setJour] = useState(aujourdhui);
  return (
    <Ligne
      titre={a.title}
      ancre={null}
      surtitre={
        <>
          Écrit par toi
          <MotTheme theme={a.theme} />
        </>
      }
      erreur={erreur}
      onFermerErreur={() => oublier(a.id)}
    >
      <input
        type="date"
        value={jour}
        max={aujourdhui}
        onChange={(ev) => setJour(ev.target.value || aujourdhui)}
        aria-label="Le jour où tu l'as fait"
        className="rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] text-muted outline-none focus:border-brand"
      />
      <Bouton
        ton="encre"
        disabled={pending}
        onClick={() => poser(a.id, () => completeNote(a.id, jour))}
      >
        ✓ C&apos;est fait
      </Bouton>
    </Ligne>
  );
}

/** UN CONSEIL DE LA SEMAINE, non tranché. Trois sorties, toutes de même poids :
 *  aucune raison n'est demandée sur un refus — « ◇ Trop compliqué » est déjà la
 *  sortie non pénalisante (elle SIMPLIFIE le conseil au lieu de le repousser),
 *  et poser une friction sur le geste qui vide la liste reviendrait à défaire la
 *  raison d'être du module. */
function LigneConseil({ r, poser, pending, oublier, erreur }: { r: ConseilRendu; erreur?: string } & Gestes) {
  const { c } = r;
  const cle = cleConseil(c);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [jour, setJour] = useState(aujourdhui);
  const retour = (reaction: "not_for_me" | "too_hard") =>
    poser(cle, () => saveRecoFeedback(c.key, reaction, false, c.theme, c.titre));
  return (
    <Ligne
      titre={c.titre}
      ancre={r.ancre}
      surtitre={
        <>
          {c.reglage ? "Réglage de base" : "Conseil"}
          <MotTheme theme={c.theme} />
          {c.effort && <span className="text-muted normal-case tracking-normal"> · {c.effort}</span>}
        </>
      }
      erreur={erreur}
      onFermerErreur={() => oublier(cle)}
    >
      {/* Le jour où tu l'as fait — il écrit la décision ET le fait, puisque le
          conseil n'avait pas été pris avant ce clic. Prérempli sur aujourd'hui :
          le geste reste un seul clic. */}
      <input
        type="date"
        value={jour}
        max={aujourdhui}
        onChange={(ev) => setJour(ev.target.value || aujourdhui)}
        aria-label="Le jour où tu l'as fait"
        className="rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] text-muted outline-none focus:border-brand"
      />
      <Bouton
        ton="encre"
        disabled={pending}
        onClick={() => poser(cle, () => markRecoDone(c.prise, jour))}
      >
        ✓ C&apos;est fait
      </Bouton>
      <Bouton disabled={pending} onClick={() => retour("not_for_me")}>
        ✕ Pas pour moi
      </Bouton>
      <Bouton disabled={pending} onClick={() => retour("too_hard")}>
        ◇ Trop compliqué
      </Bouton>
    </Ligne>
  );
}

function sansCle<T>(o: Record<string, T>, cle: string): Record<string, T> {
  const copie = { ...o };
  delete copie[cle];
  return copie;
}

export function ListeAFaire({
  verdicts,
  notes,
  conseils,
}: {
  verdicts: VerdictRendu[];
  notes: TrackedAction[];
  conseils: ConseilRendu[];
}) {
  const [pending, startTransition] = useTransition();
  const [partis, setPartis] = useState<Record<string, true>>({});
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  // LE GESTE, UNE SEULE FOIS POUR LES TROIS SORTES DE LIGNES : la ligne s'en va
  // AVANT la réponse du serveur, et elle revient — avec son message — s'il
  // refuse. Un clic doit répondre, pas attendre ; mais il ne doit jamais mentir
  // sur ce qui a été écrit.
  const poser = (cle: string, travail: () => Promise<Reponse>) => {
    setErreurs((e) => sansCle(e, cle));
    setPartis((p) => ({ ...p, [cle]: true }));
    startTransition(async () => {
      const r = await travail();
      if (!r.ok) {
        setPartis((p) => sansCle(p, cle));
        setErreurs((e) => ({ ...e, [cle]: r.message ?? "Enregistrement impossible — réessaie." }));
      }
    });
  };
  const gestes: Gestes = { poser, pending, oublier: (cle) => setErreurs((e) => sansCle(e, cle)) };

  const restantes = <T,>(items: T[], cle: (x: T) => string) => items.filter((x) => !partis[cle(x)]);
  const vRestants = restantes(verdicts, (v) => v.a.id);
  const nRestantes = restantes(notes, (a) => a.id);
  const cRestants = restantes(conseils, (r) => cleConseil(r.c));

  // Les deux compteurs de la refonte 12 : ce ne sont pas deux listes, ce sont
  // deux comptages de celle-ci — lus sur l'état qui vient de changer, donc
  // jamais en retard d'un aller-retour sur les lignes qu'ils comptent.
  const compteurs = [
    vRestants.length > 0
      ? `${vRestants.length} verdict${vRestants.length > 1 ? "s" : ""} à regarder`
      : null,
    nRestantes.length + cRestants.length > 0
      ? `${nRestantes.length + cRestants.length} à décider`
      : null,
  ].filter(Boolean);

  return (
    <>
      {compteurs.length > 0 && (
        <div className="text-[11px] uppercase tracking-widest text-faint font-semibold pb-1">
          {compteurs.join(" · ")}
        </div>
      )}
      {vRestants.map((v) => (
        <LigneVerdict key={v.a.id} v={v} erreur={erreurs[v.a.id]} {...gestes} />
      ))}
      {nRestantes.map((a) => (
        <LigneNote key={a.id} a={a} erreur={erreurs[a.id]} {...gestes} />
      ))}
      {cRestants.map((r) => (
        <LigneConseil key={cleConseil(r.c)} r={r} erreur={erreurs[cleConseil(r.c)]} {...gestes} />
      ))}
    </>
  );
}

/** LA PORTE VERS CE QUE PULSE N'A PAS VU. Repliée : on ne vient pas sur cette
 *  page pour écrire. Ce qu'on y écrit entre dans la liste SANS verdict — juger
 *  la note du client obligerait Pulse à choisir le chiffre à sa place, donc à
 *  inventer une intention.
 *
 *  ELLE SURVIT À LA DISPARITION DU MODULE, et c'est un cul-de-sac réparé : le
 *  module s'efface quand il est vide ET n'a plus rien à faire découvrir, or il
 *  portait la seule porte d'écriture — une fois effacé, plus rien n'aurait pu le
 *  faire revenir. Le module disparaît, la porte reste (`app/page.tsx`). */
export function AjoutAFaire({ themes }: { themes: string[] }) {
  const [pending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [theme, setTheme] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ouvert)
    return (
      <button
        onClick={() => setOuvert(true)}
        className="mt-2 text-[11.5px] font-semibold text-brand hover:underline"
      >
        ✎ Ajouter quelque chose à faire
      </button>
    );

  return (
    <div className="mt-2 rounded-lg border border-line bg-black/[0.015] p-2.5">
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={2}
        autoFocus
        maxLength={180}
        placeholder="Ce que tu veux faire — « refaire les visuels », « relancer la promo »…"
        className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-brand resize-none"
      />
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {themes.length > 0 && (
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            aria-label="Le thème que ça concerne"
            className="rounded-lg border border-line bg-white px-2 py-1.5 text-[11.5px] text-muted outline-none focus:border-brand"
          >
            <option value="">Aucun thème</option>
            {themes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <button
          disabled={pending || !texte.trim()}
          onClick={() => {
            setErreur(null);
            startTransition(async () => {
              const r = await saveNoteOuverte(texte, theme || null);
              if (r.ok) {
                setTexte("");
                setTheme("");
                setOuvert(false);
              } else {
                setErreur(r.message ?? "Ta ligne n'a pas pu être enregistrée.");
              }
            });
          }}
          className="text-[12px] font-semibold text-white bg-ink rounded-full px-3.5 py-1.5 disabled:opacity-40"
        >
          {pending ? "…" : "Ajouter"}
        </button>
        <button
          onClick={() => {
            setOuvert(false);
            setErreur(null);
          }}
          className="text-[11.5px] font-semibold text-faint hover:text-muted"
        >
          annuler
        </button>
      </div>
      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
    </div>
  );
}
