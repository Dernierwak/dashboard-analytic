import Link from "next/link";
import { porteVersCanal, type Canal } from "@/lib/liens";
import type { ThemeFocus } from "@/lib/report";

// ── LA SORTIE DE LA CARTE D'UN THÈME ─────────────────────────────────────────
//
// Le rapport se lisait en cul-de-sac : ses seuls liens sortants allaient vers
// `/labels`, et on n'atteignait `/meta`, `/google` ou `/instagram` qu'en
// quittant le fil par la colonne de gauche — donc sans emporter le thème qu'on
// était en train de lire. Ce module est la porte, et elle part de la carte du
// thème et d'elle seule : un chiffre du point général de la semaine ne désigne
// aucune plateforme, un lien posé là serait vague, et un lien vague ne se
// clique pas (`.scratch/refonte/issues/09-la-porte-vers-la-plateforme.md`).
//
// RIEN N'EST CALCULÉ ICI, ET AUCUN CHIFFRE N'EST AFFICHÉ. La porte dit OÙ ce
// thème tourne, pas combien il y porte : `theme.campaigns` est **plafonné à
// huit** par le worker (`build_report.py`, `t_camps[:8]`), donc un « 8
// campagnes » écrit d'après cette liste vaudrait « huit ou plus » sans le dire
// — un chiffre qu'on ne peut pas tenir (`CLAUDE.md` §7). Le compte exact
// existe (`summary.n_campaigns`) et il est déjà affiché trente pixels plus
// bas, sur « Ses campagnes » : le répéter ici n'apprendrait rien.
//
// LE PLAFOND MORD AUSSI SUR LA PRÉSENCE, et c'est la limite assumée de ce
// module : les huit campagnes gardées sont les huit plus grosses dépenses du
// thème, donc une régie où il dépense peu peut ne pas ouvrir de porte sur un
// thème qui en porte plus de huit. Rien dans le payload ne dit mieux — et une
// porte manquante se répare d'un clic dans la colonne de gauche, là où une
// porte qui ment se paie en confiance.
//
// PAS DE FENÊTRE, PAS DE PORTE. C'est la seule chose que ce module refuse de
// faire : ouvrir sans la période du bilan. Le lien emporte le thème ET la
// fenêtre ou il n'existe pas — voir `porteVersCanal` dans `lib/liens.ts` pour
// le « 4 520 CHF » qui devient « 103 CHF » au clic.

/** Le glyphe, la couleur et le nom d'un canal — un seul endroit, et le même
 *  lexique que la colonne de gauche (`components/side-nav.tsx`). */
export const CANAUX: Record<Canal, { glyphe: string; couleur: string; nom: string }> = {
  meta: { glyphe: "▣", couleur: "#1a56ff", nom: "Meta" },
  google: { glyphe: "◆", couleur: "#1a7a4a", nom: "Google" },
  instagram: { glyphe: "◎", couleur: "#7b4fff", nom: "Instagram" },
};

/** Les plateformes où ce thème tourne, dans l'ordre de lecture des pages : les
 *  deux régies puis l'organique. Une plateforme où il n'a rien n'ouvre aucune
 *  porte — promettre une page vide est pire que de ne rien promettre. */
function destinations(theme: ThemeFocus): Canal[] {
  const regies = new Set(theme.campaigns.map((c) => c.channel));
  const sorties: Canal[] = (["meta", "google"] as const).filter((c) => regies.has(c));
  if ((theme.summary.posts ?? 0) > 0) sorties.push("instagram");
  return sorties;
}

export function PorteCanal({
  theme,
  fenetre,
}: {
  theme: ThemeFocus;
  /** Les bornes du bilan de la carte (`matrice.period`). `null` = pas de porte. */
  fenetre: { from: string; to: string } | null;
}) {
  if (!fenetre) return null;
  const sorties = destinations(theme);
  if (sorties.length === 0) return null;

  return (
    <div className="border-t border-line px-4 py-3 flex items-center gap-2 flex-wrap">
      <span className="text-[11px] uppercase tracking-wide text-faint font-bold mr-1">
        Creuser ce thème
      </span>
      {sorties.map((canal) => {
        const c = CANAUX[canal];
        return (
          <Link
            key={canal}
            href={porteVersCanal(canal, theme.label, fenetre)}
            className="inline-flex items-baseline gap-1.5 text-[12px] font-semibold text-ink border border-line rounded-full pl-2.5 pr-3 py-1 bg-white hover:bg-black/[0.03]"
          >
            <span style={{ color: c.couleur }}>{c.glyphe}</span>
            {c.nom}
          </Link>
        );
      })}
      {/* LA PHRASE QUI DÉSAMORCE LE DOUTE AVANT LE CLIC. Sans elle, une page
          canal qui s'ouvre sur une période inattendue fait soupçonner un bug ;
          avec elle, le lecteur sait que les chiffres qu'il va voir sont ceux
          qu'il vient de lire. */}
      <span className="text-[10.5px] text-faint basis-full sm:basis-auto sm:ml-auto">
        sur la fenêtre de ce bilan
      </span>
    </div>
  );
}
