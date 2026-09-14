"use client";

// PROTOTYPE — À JETER. Barre flottante pour comparer des variantes d'un même
// module sur une vraie page, via `?variant=`. Elle n'est PAS du produit : elle
// se retire avec les variantes le jour où l'une d'elles gagne.
//
// Invisible en production (`NODE_ENV`) : un prototype fusionné par accident ne
// doit jamais montrer sa barre à un client.

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function PrototypeSwitcher({
  variantes,
  courant,
}: {
  variantes: { cle: string; nom: string }[];
  courant: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const index = Math.max(
    0,
    variantes.findIndex((v) => v.cle === courant)
  );

  useEffect(() => {
    const aller = (pas: number) => {
      const suivant = variantes[(index + pas + variantes.length) % variantes.length];
      // Le lien énumère ce qu'il CHANGE : on repart des paramètres présents.
      const p = new URLSearchParams(sp.toString());
      p.set("variant", suivant.cle);
      router.replace(`${pathname}?${p.toString()}`);
    };
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      const tag = cible?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || cible?.isContentEditable) return;
      if (e.key === "ArrowLeft") aller(-1);
      if (e.key === "ArrowRight") aller(1);
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [index, pathname, router, sp, variantes]);

  if (process.env.NODE_ENV === "production") return null;

  const bouger = (pas: number) => {
    const suivant = variantes[(index + pas + variantes.length) % variantes.length];
    const p = new URLSearchParams(sp.toString());
    p.set("variant", suivant.cle);
    router.replace(`${pathname}?${p.toString()}`);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full bg-[#0e0f12] text-white shadow-xl px-1.5 py-1.5">
      <button
        onClick={() => bouger(-1)}
        aria-label="Variante précédente"
        className="w-10 h-10 rounded-full hover:bg-white/15 text-[15px]"
      >
        ←
      </button>
      <span className="px-2 text-[12px] font-semibold whitespace-nowrap">
        PROTO {variantes[index]?.cle} · {variantes[index]?.nom}
      </span>
      <button
        onClick={() => bouger(1)}
        aria-label="Variante suivante"
        className="w-10 h-10 rounded-full hover:bg-white/15 text-[15px]"
      >
        →
      </button>
    </div>
  );
}
