import Link from "next/link";
import { ancreTheme } from "@/lib/liens";

// ── ON NE RAMÈNE RIEN, MAIS ON N'ABANDONNE PERSONNE ──────────────────────────
//
// Écrire depuis une page canal appartient au carnet, pas à la porte : ce module
// ne rapporte donc rien au rapport. En revanche, une page canal atteinte depuis
// la carte d'un thème DIT D'OÙ ELLE VIENT et propose d'y retourner — sans ça on
// lâche la personne dans un tableau de campagnes, qui est exactement le
// cul-de-sac qu'on vient de fermer de l'autre côté
// (`.scratch/refonte/issues/09-la-porte-vers-la-plateforme.md`).
//
// IL NE S'AFFICHE QUE SI ON VIENT VRAIMENT DE LÀ. `de` n'est posé que par
// `porteVersCanal` ; arriver par la colonne de gauche ne l'écrit pas, donc
// aucun bandeau n'apparaît. Et il SURVIT à l'exploration : tous les liens de
// ces pages énumèrent ce qu'ils CHANGENT et gardent le reste (`lib/liens.ts`,
// et le bandeau qui repart de `useSearchParams`), donc on peut changer la
// période, trier une table, décocher le thème — le chemin du retour reste.
//
// IL NOMME LE THÈME D'OÙ L'ON VIENT, PAS CELUI QUI EST FILTRÉ. Les deux sont le
// même au premier écran, et ils divergent dès que la personne touche au filtre
// de thème. Lire `l` ici ferait changer la phrase « tu viens de… » au gré des
// réglages : ce serait dire faux sur le passé pour rester synchrone avec le
// présent.

export function RetourRapport({ de }: { de?: string | string[] }) {
  // `de` EST TYPÉ `string` DANS `DashParams`, MAIS L'URL DÉCIDE. Next rend un
  // tableau dès qu'un paramètre est répété, et `?de=a&de=b` s'écrit à la main :
  // appeler `.trim()` dessus ferait tomber la page entière pour un fil
  // d'Ariane. On prend le premier, comme `themesChoisis` (`lib/commandes.ts`).
  const theme = (Array.isArray(de) ? de[0] ?? "" : de ?? "").trim();
  if (!theme) return null;

  return (
    <Link
      href={`/#${ancreTheme(theme)}`}
      className="mt-4 flex items-center gap-2 flex-wrap text-[12px] text-muted bg-white border border-line rounded-xl px-3.5 py-2 hover:bg-black/[0.02]"
    >
      <span className="text-brand font-semibold">↩</span>
      <span>
        Tu es parti du rapport de la semaine, thème{" "}
        <span className="font-semibold text-ink">« {theme} »</span>
      </span>
      <span className="text-brand font-semibold ml-auto">Revenir à sa carte</span>
    </Link>
  );
}
