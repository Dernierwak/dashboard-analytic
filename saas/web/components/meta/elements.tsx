import { formaterEcart, tonEcart, type CleMetrique, type Vue } from "@/lib/meta/lecture";

// Les petits éléments que les modules Meta partagent. Aucune directive : ils
// se rendent côté serveur comme côté client.

// Dessinées à la main (trait 1,75, 24 px), comme celles du prototype validé :
// pas de dépendance d'icônes ajoutée pour une poignée de glyphes.
export type NomIcone = "oeil" | "clic" | "cible" | "coche" | "fleche" | "calques" | "calendrier" | "chevron" | "loupe";

export function Icone({ nom, className = "h-4 w-4" }: { nom: NomIcone; className?: string }) {
  const t = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {nom === "oeil" && <><path {...t} d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle {...t} cx="12" cy="12" r="3" /></>}
      {nom === "clic" && <><path {...t} d="m9 9 5 12 1.8-5.2L21 14 9 9Z" /><path {...t} d="M7.2 2.2 8 5.1M5.1 8 2.2 7.2M14 4.1 12 6M6 12l-1.9 2" /></>}
      {nom === "cible" && <><circle {...t} cx="12" cy="12" r="9" /><circle {...t} cx="12" cy="12" r="5" /><circle {...t} cx="12" cy="12" r="1" /></>}
      {nom === "coche" && <path {...t} d="M20 6 9 17l-5-5" />}
      {nom === "fleche" && <path {...t} d="M5 12h14M12 5l7 7-7 7" />}
      {nom === "calques" && <><path {...t} d="m12 2 10 5-10 5L2 7l10-5Z" /><path {...t} d="m2 17 10 5 10-5M2 12l10 5 10-5" /></>}
      {nom === "calendrier" && <><rect {...t} x="3" y="4" width="18" height="18" rx="2" /><path {...t} d="M16 2v4M8 2v4M3 10h18" /></>}
      {nom === "chevron" && <path {...t} d="m6 9 6 6 6-6" />}
      {nom === "loupe" && <><circle {...t} cx="11" cy="11" r="7" /><path {...t} d="m21 21-4.3-4.3" /></>}
    </svg>
  );
}

export const ICONE_VUE: Record<Vue, NomIcone> = { notoriete: "oeil", trafic: "clic", conversion: "cible" };

/** L'ancre du Sélecteur de vue : quand ses cartes sortent de l'écran, le
 *  Bandeau se détache en pilule et la vue active s'y replie (user story 10).
 *  Ici, sans directive, parce que le serveur (le Sélecteur) et le client (le
 *  Bandeau) la lisent tous deux (`CLAUDE.md` §8). */
export const ID_SELECTEUR_VUE = "selecteur-vue";

/** Ce que veut dire un écart « — » : écrit au survol, pour qu'on ne le prenne
 *  pas pour une panne. */
export const SANS_ECART = "Pas d'écart : la période d'avant n'a rien de mesuré, ou vaut zéro.";

/** L'écart contre la période d'avant. Le signe est écrit en toutes lettres
 *  (« + », « − ») : la couleur ne porte jamais seule le sens. */
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
