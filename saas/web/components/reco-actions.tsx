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
};

// Boutons de réaction sous chaque conseil.
// « ▶ Je le teste » : démarre le suivi (photo de la décision, échéance +2 sem.).
// « ✓ Fait » / « Utile » / « Pas pour moi » : re-pondèrent les conseils de l'IA.
// + commentaire libre : agrégé dans ton profil, l'IA adapte son ton.
const BUTTONS: { reaction: Reaction; label: string; activeCls: string }[] = [
  { reaction: "done", label: "✓ Fait", activeCls: "bg-pos text-white border-pos" },
  { reaction: "useful", label: "● Utile", activeCls: "bg-brand text-white border-brand" },
  { reaction: "not_for_me", label: "✕ Pas pour moi", activeCls: "bg-faint text-white border-faint" },
];

export function RecoActions({
  recoKey,
  current,
  comment,
  track,
  tracked = false,
}: {
  recoKey: string;
  current: string | null;
  comment?: string | null;
  track?: TrackInfo;
  tracked?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showComment, setShowComment] = useState(false);
  const [text, setText] = useState(comment ?? "");
  const [commentSaved, setCommentSaved] = useState(false);
  const [isTracked, setIsTracked] = useState(tracked);

  return (
    <div className="mt-3.5 pt-3 border-t border-line">
      {track && (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await startTracking({ recoKey, ...track, tracked: isTracked });
              if (r.ok) setIsTracked(!isTracked);
            })
          }
          className={`w-full mb-2 text-[12px] font-semibold rounded-lg border px-3 py-2 transition-colors disabled:opacity-50 ${
            isTracked
              ? "bg-brand/[0.06] text-brand border-brand/30"
              : "bg-brand text-white border-brand hover:bg-brand/90"
          }`}
        >
          {isTracked ? "◷ En test — on revérifie dans ~2 semaines (retirer)" : "▶ Je le teste"}
        </button>
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
                  await saveRecoFeedback(recoKey, b.reaction, active);
                })
              }
              className={`text-[11.5px] font-semibold rounded-full border px-3 py-1.5 transition-colors disabled:opacity-50 ${
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
          className={`ml-auto text-[11.5px] font-semibold rounded-full border px-3 py-1.5 transition-colors ${
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
              className="text-[11.5px] font-semibold text-white bg-brand rounded-full px-3 py-1.5 hover:bg-brand/90 disabled:opacity-40"
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
