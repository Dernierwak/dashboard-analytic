"use client";

import { useState, useTransition } from "react";
import { saveRecoFeedback, saveComment, startTracking, resolveAction, type Reaction } from "@/app/actions";
import type { TrackedAction } from "@/lib/report";
import { dateCourte } from "@/components/etat-action";
import { Erreur } from "@/components/erreur";
import { Pari } from "@/components/pari";

export type TrackInfo = {
  title: string;
  theme: string | null;
  metric: string | null;
  metricLabel: string | null;
  direction: string | null;
  baseline: number | null;
  detail?: { observation?: string; pourquoi?: string; verifier?: string; effort?: string | null } | null;
};

// Boutons de réaction sous chaque conseil.
//
// « ▶ Je le teste » créait une action qui partait dans une SECTION AILLEURS sur
// la page. Elle n'existe plus : la carte porte maintenant l'état de sa propre
// décision — prise, pariée, faite — et l'action apparaît en face, dans le rail
// de la colonne de droite. Il n'y a plus de « tout en haut » où aller.
//
// Le « ✓ Je l'ai fait » est ici ET dans le rail. Ce n'est pas une hésitation :
// c'est la MÊME ligne écrite par la MÊME server action, avec deux points
// d'entrée. Le rail reste le recours quand le conseil aura disparu du rapport
// la semaine suivante — et c'est ce cas-là, pas l'autre, qui arrive tout le
// temps.
//
// Deux retraits qui ne font PAS la même chose, et qui doivent le dire :
//   « annuler » ici     → supprime la ligne, aucune trace, comme un clic repris
//   « × j'abandonne » là → status `dropped`, la trace reste dans l'historique
// Les deux rendent le conseil de nouveau disponible.
// « Utile » / « Pas pour moi » : re-pondèrent les conseils de l'IA.
// « Trop compliqué » : tu vois l'intérêt mais tu ne sais pas t'y prendre. Ce
// retour-là ne jette pas le conseil, il commande un mode d'emploi — il remonte
// dans « Pour aller plus loin » la semaine suivante.
// + commentaire libre : agrégé dans ton profil, l'IA adapte son ton.
const BUTTONS: { reaction: Reaction; label: string; activeCls: string }[] = [
  { reaction: "useful", label: "● Utile", activeCls: "bg-brand text-white border-brand" },
  { reaction: "not_for_me", label: "✕ Pas pour moi", activeCls: "bg-faint text-white border-faint" },
  { reaction: "too_hard", label: "◇ Trop compliqué", activeCls: "bg-warn text-white border-warn" },
];

export function RecoActions({
  recoKey,
  current,
  comment,
  track,
  action = null,
  capReached = false,
}: {
  recoKey: string;
  current: string | null;
  comment?: string | null;
  track?: TrackInfo;
  action?: TrackedAction | null;
  capReached?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showComment, setShowComment] = useState(false);
  const [text, setText] = useState(comment ?? "");
  const [commentSaved, setCommentSaved] = useState(false);
  const [isTracked, setIsTracked] = useState(Boolean(action));
  const [fait, setFait] = useState(action?.status === "done");
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="mt-3.5 pt-3 border-t border-line">
      {track &&
        (capReached && !isTracked ? (
          // Plafond : on ne peut pas mener 4 chantiers de front. Le conseil
          // reste lisible, mais on t'invite d'abord à en boucler un.
          <div className="w-full mb-2 text-[11.5px] font-semibold text-faint bg-black/[0.03] border border-line rounded-lg px-3 py-2 text-center leading-snug">
            Tu as déjà 3 chantiers en cours — finis-en un avant d&apos;en prendre un
            nouveau. Ils sont à droite de chaque courbe, sous « Tes actions sur ce thème ».
          </div>
        ) : isTracked ? (
          /* PRISE. La carte porte l'état, et le pari — c'est ici qu'on parie,
             au moment où l'on décide. Parier en relisant l'historique, ce
             serait parier après coup. */
          <div className="mb-2 rounded-lg border border-brand/25 bg-brand/[0.05] px-3 py-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[12px] font-semibold text-brand">
                {fait
                  ? `✓ Fait${action?.done_at ? ` le ${dateCourte(action.done_at)}` : ""}`
                  : `◷ Pris${action ? ` le ${dateCourte(action.decided_at)}` : ""}`}
              </span>
              {fait && action && (
                <span className="text-[11px] text-muted">
                  verdict le <b className="text-ink">{dateCourte(action.check_at)}</b>
                </span>
              )}
              {!fait && (
                <button
                  disabled={pending}
                  onClick={() => {
                    setErreur(null);
                    setIsTracked(false);
                    startTransition(async () => {
                      const r = await startTracking({ recoKey, ...track, tracked: true });
                      if (!r.ok) {
                        setIsTracked(true);
                        setErreur(r.message ?? "Enregistrement impossible — réessaie.");
                      }
                    });
                  }}
                  className="ml-auto text-[11px] font-semibold text-faint hover:text-muted underline disabled:opacity-50"
                >
                  annuler
                </button>
              )}
            </div>

            {action && !fait && (
              <Pari
                id={action.id}
                metricLabel={action.metric_label}
                checkAt={action.check_at}
                pariInitial={action.detail?.pari ?? null}
                compact
              />
            )}

            {action && !fait && (
              <button
                disabled={pending}
                onClick={() => {
                  setErreur(null);
                  setFait(true);
                  startTransition(async () => {
                    // Le 3e argument est le SEUL endroit de l'app qui écrit
                    // `reco_feedback.reaction = "done"` : sans lui, l'IA ne sait
                    // jamais qu'un conseil a été appliqué.
                    const r = await resolveAction(action.id, "done", recoKey);
                    if (!r.ok) {
                      setFait(false);
                      setErreur(r.message ?? "Enregistrement impossible — réessaie.");
                    }
                  });
                }}
                className="w-full mt-2 text-[12.5px] font-semibold rounded-lg bg-ink text-white px-3 py-2.5 hover:opacity-90 disabled:opacity-60"
              >
                ✓ Je l&apos;ai fait
              </button>
            )}
          </div>
        ) : (
          <button
            disabled={pending}
            onClick={() => {
              // Retour optimiste : l'état change tout de suite, on revient en
              // arrière si le serveur refuse. Un clic doit répondre, pas attendre.
              setErreur(null);
              setIsTracked(true);
              startTransition(async () => {
                const r = await startTracking({ recoKey, ...track, tracked: false });
                if (!r.ok) {
                  setIsTracked(false);
                  setErreur(r.message ?? "Enregistrement impossible — réessaie dans un instant.");
                }
              });
            }}
            className="w-full mb-2 text-[12.5px] font-semibold rounded-lg border border-brand bg-brand text-white px-3 py-2.5 hover:bg-brand/90 transition-colors disabled:opacity-60"
          >
            {pending ? "…" : "▶ Je le teste"}
          </button>
        ))}

      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
      <div className="flex items-center gap-2 flex-wrap">
        {BUTTONS.map((b) => {
          const active = current === b.reaction;
          return (
            <button
              key={b.reaction}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await saveRecoFeedback(recoKey, b.reaction, active);
                  if (!r?.ok) setErreur("Ton retour n'a pas pu être enregistré — réessaie.");
                })
              }
              className={`text-[12.5px] font-semibold rounded-full border px-4 py-2.5 transition-colors disabled:opacity-50 ${
                active
                  ? b.activeCls
                  : "border-line text-muted hover:bg-black/[0.03] bg-white"
              }`}
            >
              {b.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowComment((v) => !v)}
          className={`ml-auto text-[12.5px] font-semibold rounded-full border px-4 py-2.5 transition-colors ${
            comment || showComment
              ? "border-brand/30 text-brand bg-brand/[0.04]"
              : "border-line text-muted hover:bg-black/[0.03] bg-white"
          }`}
        >
          ✎ {comment ? "Commenté" : "Commenter"}
        </button>
      </div>

      {showComment && (
        <div className="mt-2.5">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCommentSaved(false);
            }}
            rows={2}
            placeholder="Ton retour sur ce conseil — l'IA en tient compte les semaines suivantes."
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[12.5px] text-ink outline-none focus:border-brand resize-none"
          />
          <div className="flex items-center gap-2 mt-1.5">
            <button
              disabled={pending || text === (comment ?? "")}
              onClick={() =>
                startTransition(async () => {
                  await saveComment(recoKey, text);
                  setCommentSaved(true);
                })
              }
              className="text-[12px] font-semibold text-white bg-brand rounded-full px-4 py-2 hover:bg-brand/90 disabled:opacity-40"
            >
              {pending ? "…" : "Envoyer"}
            </button>
            {commentSaved && (
              <span className="text-[11px] text-pos font-semibold">✓ pris en compte</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
