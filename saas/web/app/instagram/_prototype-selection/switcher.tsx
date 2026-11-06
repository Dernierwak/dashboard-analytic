"use client";

// PROTOTYPE JETABLE — la barre qui bascule entre les variantes (`?variant=`).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function PrototypeSwitcher({ variantes }: { variantes: { cle: string; nom: string }[] }) {
  const router = useRouter();
  const chemin = usePathname();
  const sp = useSearchParams();
  const courante = sp.get("variant") ?? variantes[0].cle;
  const i = Math.max(0, variantes.findIndex((v) => v.cle === courante));

  const aller = (pas: number) => {
    const q = new URLSearchParams(sp.toString());
    q.set("variant", variantes[(i + pas + variantes.length) % variantes.length].cle);
    router.replace(`${chemin}?${q.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") aller(-1);
      if (e.key === "ArrowRight") aller(1);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  });

  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#1c1530] px-2 py-1.5 text-[12.5px] text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <button onClick={() => aller(-1)} className="rounded-full px-2.5 py-1 hover:bg-white/10" aria-label="Variante précédente">←</button>
      <span className="px-2 font-semibold tabular-nums">
        {variantes[i].cle} <span className="font-normal text-white/70">({variantes[i].nom})</span>
      </span>
      <button onClick={() => aller(1)} className="rounded-full px-2.5 py-1 hover:bg-white/10" aria-label="Variante suivante">→</button>
    </div>
  );
}
