import type { NomIcone } from "@/components/meta/elements";
import { formaterEcart, tonEcart, type CleMetrique, type Vue } from "@/lib/google/lecture";

// Les petits éléments que les modules Google partagent. Aucune directive : ils
// se rendent côté serveur comme côté client. Les icônes viennent de
// `components/meta/elements.tsx` (dessins neutres, Instagram les reprend
// aussi) ; l'écart, lui, suit les métriques de Google.

export const ICONE_VUE: Record<Vue, NomIcone> = { notoriete: "oeil", trafic: "clic", conversion: "cible" };

/** L'ancre du Sélecteur de vue : quand ses cartes sortent de l'écran, le
 *  Bandeau se détache en pilule. Ici, sans directive, parce que le serveur
 *  (le Sélecteur) et le client (le Bandeau) la lisent tous deux (`CLAUDE.md` §8). */
export const ID_SELECTEUR_VUE = "selecteur-vue";

/** Ce que veut dire un écart « — » : écrit au survol, pour qu'on ne le prenne
 *  pas pour une panne. */
export const SANS_ECART = "Pas d'écart : la période d'avant n'a rien de mesuré, ou vaut zéro.";

/** L'écart contre la période d'avant. Le signe est écrit en toutes lettres :
 *  la couleur ne porte jamais seule le sens. */
export function PastilleEcart({ m, e, sombre = false }: { m: CleMetrique; e: number | null; sombre?: boolean }) {
  const ton = tonEcart(m, e);
  const texte = formaterEcart(e);
  if (sombre) {
    const c = ton === "pos" ? "text-[#7ee2a8]" : ton === "neg" ? "text-[#ff9d8f]" : "text-white/60";
    return <span className={`text-[12.5px] font-semibold tabular-nums whitespace-nowrap ${c}`} title={e === null ? SANS_ECART : undefined}>{texte}</span>;
  }
  const c = ton === "pos" ? "bg-[#e6f3ec] text-pos" : ton === "neg" ? "bg-[#fbe9e7] text-neg" : "bg-[#f1f0ec] text-muted";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums whitespace-nowrap ${c}`} title={e === null ? SANS_ECART : undefined}>
      {texte}
    </span>
  );
}
