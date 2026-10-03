"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

// ── LE PANNEAU LATÉRAL ───────────────────────────────────────────────────────
//
// Spec, § « L'état de la page vit dans l'URL » ; user stories 44 à 46. UN SEUL
// panneau à droite, pour deux usages : le jour d'un changement (ticket 11) et
// l'annonce à lire (ticket 12). Il n'a PAS d'état à lui : il existe tant que
// l'URL porte `jour` (ou `annonce`), et la page le rend ou non. Ouvrir l'un
// retire l'autre dans le lien — il ne peut donc jamais y en avoir deux.
//
// FERMER REMPLACE, OUVRIR EMPILE. Ouvrir est un `push` : « retour » referme.
// Fermer est un `replace` : un `push` ferait rouvrir le panneau au « retour »
// suivant, comme si on revenait en arrière vers lui.
//
// Forme reprise du prototype validé (ticket 05 de la carte) : une carte
// flottante à droite, un voile léger sur la page, Échap ou un clic sur le
// voile pour fermer.

export function PanneauLateral({
  titre,
  sousTitre,
  fermeture,
  children,
}: {
  titre: string;
  sousTitre?: string;
  /** Le lien de la page sans le panneau (`lienMeta(params, { jour: null })`). */
  fermeture: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const bouton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fermer = () => demarrer(() => router.replace(fermeture, { scroll: false }));
    const touche = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [router, fermeture]);

  // Le focus entre dans le panneau à l'ouverture : au clavier, on lit ce qui
  // vient de s'ouvrir au lieu de rester sur le point de la courbe.
  useEffect(() => bouton.current?.focus({ preventScroll: true }), [titre]);

  const fermer = () => demarrer(() => router.replace(fermeture, { scroll: false }));

  return (
    <div className="fixed inset-0 z-50" aria-busy={enCours}>
      <div onClick={fermer} className="voile-entre absolute inset-0 bg-ink/25 backdrop-blur-[2px]" aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-panneau"
        className="panneau-entre absolute bottom-3 right-3 top-3 flex w-[calc(100%-24px)] min-h-0 flex-col rounded-2xl bg-white shadow-2xl sm:w-[440px]"
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
          <div className="min-w-0">
            <h2 id="titre-panneau" className="text-[20px] font-semibold leading-tight text-ink first-letter:uppercase">{titre}</h2>
            {sousTitre && <p className="mt-1 text-[13px] text-muted">{sousTitre}</p>}
          </div>
          <button
            ref={bouton}
            type="button"
            onClick={fermer}
            aria-label="Fermer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-muted hover:bg-[#ecebe6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </aside>
    </div>
  );
}
