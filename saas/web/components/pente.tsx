import type { ReactNode } from "react";

// Le lexique de la pente — un seul endroit.
//
// Le glyphe `▲` servait à TROIS choses dans dix-huit fichiers : la hausse, le
// repère d'une semaine où une action a été lancée, et le verdict « pas d'effet »
// (en rouge, pointe en haut, sur une mauvaise nouvelle). Trois sens pour un
// signe, c'est un signe qui ne dit plus rien.
//
// Répartition arrêtée :
//   ▲ ▼  la pente, et rien d'autre. Jamais sans un nombre à côté.
//   ┄    le repère d'action sur un graphe — un trait, pas un glyphe.
//   —    le verdict « pas d'effet » emprunte la flèche du delta réel.
//
// Le triangle est dessiné, pas tapé : le caractère `▲` se cale mal sur la ligne
// de base selon la plateforme, et il ne peut pas être mis à l'échelle du hero
// (68 px) comme d'une tuile (11 px). Les dimensions sont en `em` — il suit la
// taille du texte qui le porte.

export function Triangle({ sens, className }: { sens: "haut" | "bas"; className?: string }) {
  return (
    <svg
      viewBox="0 0 8 7"
      width="0.62em"
      height="0.55em"
      className={`inline-block ${className ?? ""}`}
      style={{ verticalAlign: "0.02em" }}
      aria-hidden="true"
      focusable="false"
    >
      <polygon points={sens === "haut" ? "4,0 8,7 0,7" : "4,7 8,0 0,0"} fill="currentColor" />
    </svg>
  );
}

/** Le sens d'un écart, colorié par ce qu'il VEUT DIRE, jamais par son signe. */
export function sensPente(
  ecart: number | null | undefined,
  baisseEstBonne = false,
  seuil = 0.5
): { plat: boolean; monte: boolean; bon: boolean; cls: string; fond: string } {
  if (ecart === null || ecart === undefined || Math.abs(ecart) < seuil)
    return { plat: true, monte: false, bon: false, cls: "text-muted", fond: "rgba(0,0,0,0.05)" };
  const monte = ecart > 0;
  const bon = baisseEstBonne ? !monte : monte;
  return {
    plat: false,
    monte,
    bon,
    cls: bon ? "text-pos" : "text-neg",
    fond: bon ? "#1a7a4a14" : "#c0392b14",
  };
}

/**
 * Le bloc d'écart standard : ▲ +12 % <base>. Huit implémentations de cette
 * même logique cohabitaient, avec trois seuils de « stable » différents.
 */
export function Pente({
  delta,
  baisseEstBonne = false,
  base,
  seuil = 0.5,
  className = "text-[11px] mt-1.5",
}: {
  delta: number | null | undefined;
  /** true quand une BAISSE est une bonne nouvelle (CPC, CPM, coût par contact). */
  baisseEstBonne?: boolean;
  base?: ReactNode;
  seuil?: number;
  className?: string;
}) {
  if (delta === null || delta === undefined) return null;
  const s = sensPente(delta, baisseEstBonne, seuil);
  if (s.plat) return <div className={`text-faint font-medium ${className}`}>≈ stable</div>;
  return (
    <div className={`font-semibold ${s.cls} ${className}`}>
      <Triangle sens={s.monte ? "haut" : "bas"} />{" "}
      {s.monte ? "+" : ""}
      {delta.toFixed(0)} %{base && <span className="text-faint font-normal"> {base}</span>}
    </div>
  );
}
