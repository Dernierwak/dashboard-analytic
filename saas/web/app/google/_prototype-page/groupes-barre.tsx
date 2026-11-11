"use client";
// PROTOTYPE JETABLE — ticket 21. Fait défiler les variantes des groupes de termes
// (`?gv=`), flèches ou touches ← →. Jamais en production.
import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function BarreGroupes({ variantes }: { variantes: { cle: string; nom: string }[] }) {
  const router = useRouter();
  const chemin = usePathname();
  const sp = useSearchParams();
  const i = Math.max(0, variantes.findIndex((v) => v.cle === (sp.get("gv") ?? variantes[0].cle)));

  const aller = useCallback(
    (pas: number) => {
      const q = new URLSearchParams(sp.toString());
      q.set("gv", variantes[(i + pas + variantes.length) % variantes.length].cle);
      router.replace(`${chemin}?${q.toString()}#groupes`, { scroll: false });
    },
    [sp, i, variantes, router, chemin],
  );

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") aller(-1);
      if (e.key === "ArrowRight") aller(1);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [aller]);

  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#2b1a4d] p-1 text-[12.5px] font-semibold text-white shadow-2xl">
      <button onClick={() => aller(-1)} className="h-8 w-8 rounded-full hover:bg-white/15" aria-label="Variante précédente">←</button>
      <span className="px-2">Groupes de termes {variantes[i].cle} · {variantes[i].nom} <span className="font-normal text-white/60">· chiffres fictifs</span></span>
      <button onClick={() => aller(1)} className="h-8 w-8 rounded-full hover:bg-white/15" aria-label="Variante suivante">→</button>
    </div>
  );
}
