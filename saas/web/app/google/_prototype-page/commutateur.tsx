"use client";
// PROTOTYPE JETABLE — ticket « Améliorer la Comparaison »
// (.scratch/google-ads/issues/16-ameliorer-la-comparaison.md). Barre flottante
// qui passe d'une variante à l'autre (← →). Ne part jamais sur `main`.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Changer de variante repart de zéro sur ce qui n'a pas le même sens d'une
// variante à l'autre ; la vue, la plateforme et le type restent.
const REMIS_A_ZERO = ["comparer", "niveau", "parent", "ouvert", "mx", "my", "courbe", "inv"];

export function Commutateur({ variantes }: { variantes: { cle: string; nom: string }[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const actuelle = Math.max(0, variantes.findIndex((v) => v.cle === (sp.get("av") ?? variantes[1].cle)));
  const href = (i: number) => {
    const q = new URLSearchParams(sp.toString());
    REMIS_A_ZERO.forEach((k) => q.delete(k));
    q.set("av", variantes[(i + variantes.length) % variantes.length].cle);
    return `/google?${q.toString()}#comparaison`;
  };
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (cible && (cible.closest("input, textarea, [contenteditable]"))) return;
      if (e.key === "ArrowLeft") router.replace(href(actuelle - 1), { scroll: false });
      if (e.key === "ArrowRight") router.replace(href(actuelle + 1), { scroll: false });
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  });
  const v = variantes[actuelle];
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#2b1a4d] px-2 py-1.5 text-[12.5px] font-semibold text-white shadow-2xl">
      <Link href={href(actuelle - 1)} scroll={false} className="rounded-full px-2.5 py-1 hover:bg-white/15" aria-label="Variante précédente">←</Link>
      <span className="px-2">{v.cle} · {v.nom} <span className="font-normal text-white/60">· chiffres fictifs</span></span>
      <Link href={href(actuelle + 1)} scroll={false} className="rounded-full px-2.5 py-1 hover:bg-white/15" aria-label="Variante suivante">→</Link>
    </div>
  );
}
