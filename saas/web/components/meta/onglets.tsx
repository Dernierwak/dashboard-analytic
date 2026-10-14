import Link from "next/link";
import { lienMeta, SANS_PANNEAU, type Params } from "@/lib/meta/liens";
import { ORANGE_REPERE } from "@/lib/palette";

// ── LES ONGLETS DU BORD DROIT ────────────────────────────────────────────────
//
// Écran validé au ticket 10 de `.scratch/journal-meta/` (point 2) : ni bouton
// dans la barre de filtres, ni onglet à gauche, mais des onglets accrochés au
// bord droit — « Changements » avec son nombre (tous ceux de la période,
// filtrés comme la page) et « Aperçus » (le dernier visuel et le dernier
// texte de chaque annonce). Ils ouvrent le Panneau latéral et restent
// accrochés à son bord ; un second clic sur l'onglet actif referme.
//
// Ce ne sont que des liens (l'état vit dans l'URL) : sans directive, rendus
// côté serveur. Au téléphone, le panneau prend toute la largeur : les onglets
// s'effacent tant qu'il est ouvert, la croix le referme.

export type Onglet = "changements" | "apercus";

export function Onglets({
  params,
  actif,
  ouvert,
  changements,
  annonces,
}: {
  params: Params;
  /** L'onglet dont le panneau est ouvert — « Changements » l'est aussi pour
   *  un jour ouvert depuis un point, puisque c'est le même journal. */
  actif: Onglet | null;
  /** Un panneau, quel qu'il soit, est ouvert : les onglets s'accrochent à son bord. */
  ouvert: boolean;
  /** `null` = le journal n'a pas pu être lu (la Tendance le dit). */
  changements: number | null;
  annonces: number;
}) {
  const onglets: { cle: Onglet; nom: string; nombre: number | null }[] = [
    { cle: "changements", nom: "Changements", nombre: changements },
    { cle: "apercus", nom: "Aperçus", nombre: annonces },
  ];
  // Le panneau fait 440 px et se tient à 12 px du bord (`panneau.tsx`).
  return (
    <nav
      aria-label="Panneaux"
      data-garde-choix
      className={`fixed top-[28%] z-[55] grid gap-2 transition-[right] duration-300 ease-out motion-reduce:transition-none ${
        ouvert ? "right-0 max-sm:hidden sm:right-[452px]" : "right-0"
      }`}
    >
      {onglets.map((o) => {
        // L'onglet actif referme, même sur un jour ouvert depuis un point :
        // il est surligné, un clic dessus ferme (David, ticket 13).
        const est = actif === o.cle;
        return (
          <Link
            key={o.cle}
            href={lienMeta(params, est ? SANS_PANNEAU : { ...SANS_PANNEAU, panneau: o.cle })}
            scroll={false}
            aria-current={est ? "true" : undefined}
            aria-label={`${o.nom}${o.nombre === null ? "" : ` : ${o.nombre}`}${est ? ", fermer" : ""}`}
            className={`flex items-center gap-2.5 rounded-l-xl border border-r-0 px-2 py-4 text-[13px] font-semibold tracking-wide shadow-[-4px_4px_16px_rgba(14,15,18,0.08)] [writing-mode:vertical-rl] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
              est ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink hover:bg-canvas"
            }`}
          >
            {o.nombre !== null && (
              <span
                className="min-w-[22px] rounded-full px-1.5 py-px text-center text-[12px] tabular-nums text-white [writing-mode:horizontal-tb]"
                style={{ background: ORANGE_REPERE }}
              >
                {o.nombre}
              </span>
            )}
            {o.nom}
          </Link>
        );
      })}
    </nav>
  );
}
