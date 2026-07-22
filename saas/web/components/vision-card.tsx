"use client";

import Link from "next/link";
import { useTransition } from "react";
import { saveInsightFeedback } from "@/app/actions";
import type { VisionBlock, VisionConstat } from "@/lib/report";

// « ◈ Ce qui fonctionne pour toi » — la vision globale calculée sur tout
// l'historique, validée constat par constat. Un ✗ écarte le constat (replié,
// jamais supprimé) et le moteur cesse de s'appuyer dessus ; un ✓ le renforce.

const KIND_ICON: Record<string, string> = {
  theme_best: "◈",
  theme_worst: "▲",
  format_best: "◎",
  slot_best: "◷",
  campagne_locomotive: "▣",
  angle_mort: "◌",
};

function ConstatRow({ c, verdict }: { c: VisionConstat; verdict: string | null }) {
  const [pending, startTransition] = useTransition();
  const isAngleMort = c.kind === "angle_mort";

  // Mobile d'abord : texte pleine largeur, boutons EN DESSOUS (jamais sur le
  // côté — sur téléphone ils écrasaient le texte).
  return (
    <div className="px-4 sm:px-5 py-3.5">
      <div className="flex items-start gap-3">
        <span
          className={`text-[15px] leading-snug ${c.kind === "theme_worst" ? "text-warn" : isAngleMort ? "text-faint" : "text-brand"}`}
        >
          {KIND_ICON[c.kind] ?? "◈"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink leading-snug">{c.title}</p>
          <p className="text-[12.5px] text-muted leading-relaxed mt-0.5">
            {c.detail}
            {isAngleMort && (
              <>
                {" "}
                <Link href="/labels" className="text-ig font-semibold hover:underline">
                  → page Thèmes
                </Link>
              </>
            )}
          </p>
          {!isAngleMort && (
            <div className="flex items-center gap-2 flex-wrap mt-2.5">
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await saveInsightFeedback(c.key, "agree", verdict === "agree");
                  })
                }
                className={`text-[11.5px] font-semibold rounded-full border px-3 py-1.5 transition-colors disabled:opacity-50 ${
                  verdict === "agree"
                    ? "bg-pos text-white border-pos"
                    : "border-line text-muted hover:bg-black/[0.03] bg-white"
                }`}
              >
                ✓ Ça me parle
              </button>
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await saveInsightFeedback(c.key, "reject", verdict === "reject");
                  })
                }
                className={`text-[11.5px] font-semibold rounded-full border px-3 py-1.5 transition-colors disabled:opacity-50 ${
                  verdict === "reject"
                    ? "bg-faint text-white border-faint"
                    : "border-line text-muted hover:bg-black/[0.03] bg-white"
                }`}
              >
                ✗ Pas d&apos;accord
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function VisionCard({
  vision,
  insightFeedback,
}: {
  vision: VisionBlock;
  insightFeedback: Record<string, string>;
}) {
  const verdictOf = (c: VisionConstat): string | null =>
    insightFeedback[c.key] ?? (c.status !== "new" ? c.status : null);

  const visible = vision.constats.filter((c) => verdictOf(c) !== "reject");
  const rejected = vision.constats.filter((c) => verdictOf(c) === "reject");
  if (vision.constats.length === 0) return null;

  return (
    <div>
      <p className="text-[12.5px] text-muted leading-relaxed mb-3 max-w-2xl">
        Le bilan de ton compte sur tout ton historique
        {vision.period_label ? ` (${vision.period_label})` : ""} : ce qui marche, ce
        qui coince. <span className="text-ink font-medium">Dis-nous si chaque constat
        te parle</span> — tes conseils, plus bas, s&apos;appuient dessus (et ignorent ce
        que tu écartes).
      </p>
      {/* Grille sur desktop : les constats côte à côte, pas une colonne étirée. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map((c) => (
          <div key={c.key} className="bg-white border border-line rounded-xl shadow-card">
            <ConstatRow c={c} verdict={verdictOf(c)} />
          </div>
        ))}
      </div>
      {rejected.length > 0 && (
        <details className="mt-3">
          <summary className="text-[11.5px] text-faint cursor-pointer select-none">
            Écartés ({rejected.length}) — le moteur ne s&apos;appuie plus dessus
          </summary>
          <div className="grid gap-3 lg:grid-cols-2 mt-2 opacity-60">
            {rejected.map((c) => (
              <div key={c.key} className="bg-white border border-line rounded-xl">
                <ConstatRow c={c} verdict="reject" />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
