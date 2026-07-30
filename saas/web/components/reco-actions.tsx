"use client";

import { useState, useTransition } from "react";
import { saveRecoFeedback, saveComment, startTracking, type Reaction } from "@/app/actions";

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
// « ▶ Je le teste » : la décision part dans ta liste, tout en haut du rapport,
// et n'en bouge plus tant que tu ne l'as pas marquée faite. Le « ✓ C'est fait »
// n'est QUE là-haut : un conseil se prend ici, il ne se termine pas ici. Deux
// chemins pour le même résultat, c'est une hésitation à chaque semaine.
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
  tracked = false,
  capReached = false,
}: {
  recoKey: string;
  current: string | null;
  comment?: string | null;
  track?: TrackInfo;
  tracked?: boolean;
  capReached?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showComment, setShowComment] = useState(false);
  const [text, setText] = useState(comment ?? "");
  const [commentSaved, setCommentSaved] = useState(false);
  const [isTracked, setIsTracked] = useState(tracked);
  const [erreur, setErreur] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  return (
    <div className="mt-3.5 pt-3 border-t border-line">
      {track &&
        (capReached && !isTracked ? (
          // Plafond : on ne peut pas mener 4 chantiers de front. Le conseil
          // reste lisible, mais on t'invite d'abord à en boucler un.
          <div className="w-full mb-2 text-[11.5px] font-semibold text-faint bg-black/[0.03] border border-line rounded-lg px-3 py-2 text-center leading-snug">
            Tu as déjà 3 chantiers en cours — finis-en un avant d&apos;en prendre un
            nouveau.
          </div>
        ) : (
          <button
            disabled={pending}
            onClick={() => {
              // Retour optimiste : l'état change tout de suite, on revient en
              // arrière si le serveur refuse. Un clic doit répondre, pas attendre.
              const avant = isTracked;
              setErreur(null);
              setIsTracked(!avant);
              setJustAdded(!avant);
              startTransition(async () => {
                const r = await startTracking({ recoKey, ...track, tracked: avant });
                if (!r.ok) {
                  setIsTracked(avant);
                  setJustAdded(false);
                  setErreur(r.message ?? "Enregistrement impossible — réessaie dans un instant.");
                }
              });
            }}
            className={`w-full mb-2 text-[12.5px] font-semibold rounded-lg border px-3 py-2.5 transition-colors disabled:opacity-60 ${
              isTracked
                ? "bg-brand/[0.06] text-brand border-brand/30"
                : "bg-brand text-white border-brand hover:bg-brand/90"
            }`}
          >
            {pending ? "…" : isTracked ? "◷ Dans ta liste, tout en haut — retirer" : "▶ Je le teste"}
          </button>
        ))}

      {/* Ce qui part en haut de page est à 3 écrans d'ici : on le confirme sur
          place, avec un lien qui y remonte. */}
      {justAdded && !erreur && (
        <a
          href="#a-faire"
          className="flex items-center gap-1.5 mb-2 text-[11.5px] font-semibold text-pos bg-pos/[0.07] border border-pos/25 rounded-lg px-3 py-2"
        >
          ◷ Ajouté à ta liste, tout en haut
          <span className="ml-auto underline">y aller ↑</span>
        </a>
      )}

      {erreur && (
        <div className="mb-2 text-[11.5px] leading-snug text-neg bg-neg/[0.05] border border-neg/25 rounded-lg px-3 py-2">
          {erreur}
          <button
            onClick={() => setErreur(null)}
            className="block mt-1 text-[10.5px] font-semibold text-faint"
          >
            fermer
          </button>
        </div>
      )}
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
