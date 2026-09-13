"use client";

import { useState, useTransition } from "react";
import { resolveAction } from "@/app/actions";
import type { TrackedAction } from "@/lib/report";
import { Effet, Etape, dateCourte, etat } from "@/components/etat-action";
import { Erreur } from "@/components/erreur";

// UNE ACTION QUI COURT ENCORE, dans le rail — celui de la carte de son
// thème, et celui de la page d'accueil, qui sert le même module sur les
// seules actions en cours (`lib/a-faire.ts`, `chantiersEnCours`).
//
// C'est ici que vit le cycle de vie — et il fallait qu'il vive ici, pas
// seulement dans la carte du conseil. La raison est simple et elle arrive
// chaque semaine : le worker republie un rapport où le conseil appliqué n'est
// plus, la carte disparaît, et avec elle la case à cocher. Une action serait
// bloquée en `running` à vie, sans un seul endroit où la clore. Le rail est la
// maison de référence ; la carte du conseil en est le miroir tant qu'elle
// existe.
//
// La pastille du rail reste PASSIVE — 7 px qu'on ne clique pas. Les gestes
// sont des boutons posés SOUS l'entrée : une cible de 44 px ne tient pas dans
// une gouttière de 24 px sans percuter le trait.

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
      className={`text-[11.5px] font-semibold rounded-full px-3 py-1.5 border transition-colors disabled:opacity-50 ${
        ton === "encre"
          ? "bg-ink text-white border-ink hover:opacity-90"
          : "border-line text-muted bg-white hover:bg-black/[0.03]"
      }`}
    >
      {children}
    </button>
  );
}

export function ActionVivante({ a }: { a: TrackedAction }) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);
  // LE JOUR OÙ TU L'AS FAIT, et pas celui où tu cliques. Il part sur
  // aujourd'hui : un clic sans y toucher écrit exactement ce qu'il écrivait
  // avant, et la liste se vide toujours sous le doigt. Les bornes sont dans le
  // calendrier lui-même (`min`/`max`) — un jour hors bornes ne s'offre pas,
  // donc il n'y a pas de message d'erreur à écrire (refonte 20).
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [jourFait, setJourFait] = useState(aujourdhui);
  const e = etat(a);

  // Retour optimiste : l'état change tout de suite, on revient en arrière si le
  // serveur refuse. Un clic doit répondre, pas attendre.
  const lancer = (mode: "done" | "seen" | "drop", optimiste?: () => void, annuler?: () => void) => {
    setErreur(null);
    optimiste?.();
    startTransition(async () => {
      // `recoKey` n'est pas décoratif : c'est le SEUL endroit de l'app qui
      // écrit `reco_feedback.reaction = "done"`. Sans lui, l'IA ne sait jamais
      // qu'un conseil a été appliqué. `a.theme`/`a.title` (TASK-025) : le
      // contexte de CETTE action, persisté avec la réaction.
      const r = await resolveAction(
        a.id,
        mode,
        mode === "done"
          ? { recoKey: a.reco_key, theme: a.theme, title: a.title, doneAt: jourFait }
          : {}
      );
      if (!r.ok) {
        annuler?.();
        setErreur(r.message ?? "Enregistrement impossible — réessaie.");
      }
    });
  };

  // `"auto"` (l'hypothèse d'un thème, posée par le worker sans clic) suit le
  // même verdict que `"done"` — voir `rang()` (`rail-actions.tsx`) et `etat()`
  // (`etat-action.tsx`), qui font la même distinction.
  const aJuger = (a.status === "done" || a.status === "auto") && a.due;
  const enObservation = (a.status === "done" || a.status === "auto") && !a.due;

  return (
    <>
      <div className="text-[11.5px] mt-0.5">
        <span className={`font-semibold ${fait ? "text-pos" : e.cls}`}>
          {fait ? "fait — en observation" : e.label}
        </span>
        {aJuger ? (
          <Effet a={a} />
        ) : enObservation ? (
          <span className="text-faint">
            {" "}
            · verdict le <b className="text-muted">{dateCourte(a.check_at)}</b>
          </span>
        ) : (
          <Effet a={a} />
        )}
      </div>

      {enObservation && <Etape a={a} />}

      {/* Le conseil aura disparu du rapport dans deux jours : sans son détail
          sous la main, l'action redevient un titre énigmatique. Vaut aussi
          pour `"auto"` : la piste IA qui l'a produite disparaîtra pareil. */}
      {(a.status === "running" || a.status === "auto") &&
        (a.detail?.observation || a.detail?.pourquoi || a.detail?.verifier) && (
          <details className="group mt-1">
            <summary className="text-[11.5px] font-semibold text-brand cursor-pointer select-none list-none">
              <span className="group-open:hidden">▸ Voir pourquoi</span>
              <span className="hidden group-open:inline">▾ Replier</span>
            </summary>
            <div className="mt-1.5 space-y-1.5">
              {a.detail?.observation && (
                <p className="text-[12px] text-muted leading-relaxed">{a.detail.observation}</p>
              )}
              {a.detail?.pourquoi && (
                <p className="text-[12px] text-muted leading-relaxed">
                  <span className="font-semibold text-ink">Pourquoi — </span>
                  {a.detail.pourquoi}
                </p>
              )}
              {a.detail?.verifier && (
                <p className="text-[12px] text-muted leading-relaxed">
                  <span className="font-semibold text-ink">Comment faire — </span>
                  {a.detail.verifier}
                </p>
              )}
            </div>
          </details>
        )}

      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
        {/* `"auto"` peut aussi être confirmée « faite » : le client dit alors
            qu'il l'a réellement mise en place, et le compte à rebours repart
            de ce jour — même geste, même `resolveAction`, que pour `"running"`. */}
        {(a.status === "running" || a.status === "auto") && !fait && (
          <>
            {/* Le calendrier AVANT le bouton, et déjà rempli : le geste reste un
                seul clic, la date n'est là que pour qui a fait le changement
                mardi et ouvre Pulse vendredi. C'est cette date qui pilote
                l'échéance du verdict (`done_at + 14`), pas le jour du clic. */}
            <input
              type="date"
              value={jourFait}
              min={a.decided_at}
              max={aujourdhui}
              onChange={(ev) => setJourFait(ev.target.value || aujourdhui)}
              aria-label="Le jour où tu l'as fait"
              className="rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] text-muted outline-none focus:border-brand"
            />
            <Bouton
              ton="encre"
              disabled={pending}
              onClick={() => lancer("done", () => setFait(true), () => setFait(false))}
            >
              ✓ Je l&apos;ai fait
            </Bouton>
          </>
        )}
        {aJuger && (
          <Bouton ton="encre" disabled={pending} onClick={() => lancer("seen")}>
            ✓ Vu — je range
          </Bouton>
        )}
        <Bouton disabled={pending} onClick={() => lancer("drop")}>
          × j&apos;abandonne
        </Bouton>
      </div>

      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
    </>
  );
}
