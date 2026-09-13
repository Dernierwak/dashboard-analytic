"use client";

import { useState, useTransition } from "react";
import {
  completeNote,
  markRecoDone,
  resolveAction,
  saveRecoFeedback,
  saveTache,
} from "@/app/actions";
import type { ConseilAFaire } from "@/lib/a-faire";
import type { TrackedAction } from "@/lib/report";
import { Effet, dateCourte } from "@/components/etat-action";
import { Erreur } from "@/components/erreur";

// ── LES LIGNES DU MODULE « À FAIRE » ─────────────────────────────────────────
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
// LA LIGNE S'EN VA SOUS LE DOIGT. Chaque ligne est un composant CLIENT pour
// ça : elle se retire elle-même au clic, avant même la réponse du serveur, et
// revient si le serveur refuse. Pas d'écran de félicitations, pas de barre de
// complétion, pas d'animation — refusés deux fois par la carte de refonte : une
// barre de progression peut RÉDUIRE la complétion, et féliciter d'avoir cliqué
// félicite le clic. On ne fête que le mesuré, à l'arrivée d'un verdict `better`.

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

/** L'enveloppe commune : la ligne, son titre, ses gestes à droite. Elle
 *  disparaît dès que le geste est posé — c'est tout le module. */
function Ligne({
  titre,
  ancre,
  surtitre,
  parti,
  erreur,
  onFermerErreur,
  children,
}: {
  titre: string;
  /** `null` pour ce qu'on s'est écrit soi-même : il n'y a rien à aller lire. */
  ancre: string | null;
  surtitre: React.ReactNode;
  parti: boolean;
  erreur: string | null;
  onFermerErreur: () => void;
  children: React.ReactNode;
}) {
  if (parti) return null;
  return (
    <div className="border-t border-line first:border-t-0 py-2.5 flex items-start gap-3 flex-wrap">
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

/** UN VERDICT EST TOMBÉ — la seule chose du module qui soit le résultat de TON
 *  travail, d'où sa place en tête. Un seul geste : le regarder et le ranger. */
export function LigneVerdict({ a, ancre }: { a: TrackedAction; ancre: string | null }) {
  const [pending, startTransition] = useTransition();
  const [parti, setParti] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <Ligne
      titre={a.title}
      ancre={ancre}
      surtitre={
        <>
          {/* « VERDICT » SEULEMENT QUAND IL Y EN A UN. Une action arrivée à
              échéance sans indicateur mesurable n'a rien à montrer : le worker
              n'a pas pu la juger, et l'appeler verdict laisserait croire à une
              mesure qui n'existe pas (`CLAUDE.md` §7). C'est le mot du rail —
              « à juger » — qui est alors juste. */}
          {a.verdict ? `Verdict du ${dateCourte(a.check_at)}` : "À juger"}
          {a.theme && <span className="text-muted normal-case tracking-normal"> · {a.theme}</span>}
        </>
      }
      parti={parti}
      erreur={erreur}
      onFermerErreur={() => setErreur(null)}
    >
      <span className="text-[11.5px]">
        <Effet a={a} />
      </span>
      <Bouton
        ton="encre"
        disabled={pending}
        onClick={() => {
          setErreur(null);
          setParti(true);
          startTransition(async () => {
            const r = await resolveAction(a.id, "seen");
            if (!r.ok) {
              setParti(false);
              setErreur(r.message ?? "Enregistrement impossible — réessaie.");
            }
          });
        }}
      >
        ✓ Vu — je range
      </Bouton>
    </Ligne>
  );
}

/** CE QUE TU T'ES ÉCRIT TOI-MÊME. Elle se coche, et c'est en la cochant qu'elle
 *  se date : le calendrier est le sien, pas celui d'un verdict — elle n'en aura
 *  jamais. */
export function LigneTache({ a }: { a: TrackedAction }) {
  const [pending, startTransition] = useTransition();
  const [parti, setParti] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [jour, setJour] = useState(aujourdhui);
  return (
    <Ligne
      titre={a.title}
      ancre={null}
      surtitre={
        <>
          Écrit par toi
          {a.theme && <span className="text-muted normal-case tracking-normal"> · {a.theme}</span>}
        </>
      }
      parti={parti}
      erreur={erreur}
      onFermerErreur={() => setErreur(null)}
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
        onClick={() => {
          setErreur(null);
          setParti(true);
          startTransition(async () => {
            const r = await completeNote(a.id, jour);
            if (!r.ok) {
              setParti(false);
              setErreur(r.message ?? "Enregistrement impossible — réessaie.");
            }
          });
        }}
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
export function LigneConseil({ c, ancre }: { c: ConseilAFaire; ancre: string }) {
  const [pending, startTransition] = useTransition();
  const [parti, setParti] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const poser = (travail: () => Promise<{ ok: boolean; message?: string }>) => {
    setErreur(null);
    setParti(true);
    startTransition(async () => {
      const r = await travail();
      if (!r.ok) {
        setParti(false);
        setErreur(r.message ?? "Enregistrement impossible — réessaie.");
      }
    });
  };
  const retour = (reaction: "not_for_me" | "too_hard") =>
    poser(() => saveRecoFeedback(c.key, reaction, false, c.theme, c.titre));

  return (
    <Ligne
      titre={c.titre}
      ancre={ancre}
      surtitre={
        <>
          {c.reglage ? "Réglage de base" : "Conseil"}
          {c.theme && <span className="text-muted normal-case tracking-normal"> · {c.theme}</span>}
          {c.effort && <span className="text-muted normal-case tracking-normal"> · {c.effort}</span>}
        </>
      }
      parti={parti}
      erreur={erreur}
      onFermerErreur={() => setErreur(null)}
    >
      <Bouton ton="encre" disabled={pending} onClick={() => poser(() => markRecoDone(c.prise))}>
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

/** LA PORTE VERS CE QUE PULSE N'A PAS VU. Repliée : on ne vient pas sur cette
 *  page pour écrire. Ce qu'on y écrit entre dans la liste SANS verdict — juger
 *  la note du client obligerait Pulse à choisir le chiffre à sa place, donc à
 *  inventer une intention. */
export function TacheAjout({ themes }: { themes: string[] }) {
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
              const r = await saveTache(texte, theme || null);
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
