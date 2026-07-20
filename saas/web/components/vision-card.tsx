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
    <section className="mb-8">
      <div className="mb-3">
        <div className="flex items-baseline justify-between flex-wrap gap-x-3 gap-y-1">
          <h2 className="text-[14px] font-semibold text-ink">
            ◈ Ce qui fonctionne pour toi
          </h2>
          <span className="text-[11px] text-faint">
            tout ton historique{vision.period_label ? ` · ${vision.period_label}` : ""}
          </span>
        </div>
        <p className="text-[11.5px] text-faint mt-0.5">
          Valide ou écarte chaque constat — les conseils s&apos;appuient dessus.
          {(vision.priorities?.length ?? 0) > 0 && (
            <span className="text-warn font-semibold">
              {" "}★ Priorités : {vision.priorities!.join(" · ")}
            </span>
          )}
        </p>
      </div>
      <div className="bg-white border border-line rounded-xl shadow-card divide-y divide-line">
        {visible.map((c) => (
          <ConstatRow key={c.key} c={c} verdict={verdictOf(c)} />
        ))}
      </div>
      {rejected.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11.5px] text-faint cursor-pointer select-none">
            Écartés ({rejected.length}) — le moteur ne s&apos;appuie plus dessus
          </summary>
          <div className="mt-2 bg-white border border-line rounded-xl divide-y divide-line opacity-60">
            {rejected.map((c) => (
              <ConstatRow key={c.key} c={c} verdict="reject" />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
