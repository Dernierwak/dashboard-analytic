import Link from "next/link";
import type { CanalHebdo, SemaineHebdo, SourcesHebdo } from "@/lib/hebdo/payload";
import { MOT_CATEGORIE_HEBDO, jourCourt, lienJournal, parCategorie } from "@/lib/hebdo/changements";
import { SOURCE } from "@/lib/plateformes";
import { ScrollList } from "@/components/scroll-list";

// ── LES CHANGEMENTS DE LA SEMAINE, SUR LA CARTE DU CANAL ─────────────────────
//
// Ce que la plateforme a ÉCRIT dans son journal, rien de déduit : rangé par
// catégorie (« Budget · 3 »), chaque ligne jour · campagne · résumé. Les
// comptes se font ici, à l'affichage (spec hebdo, « Changements »).
//
// TROIS SILENCES QUI NE SE CONFONDENT PAS (spec, tableau des états) :
//   · journal non couvert → « en cours de récupération », SANS compte : une
//     liste vide y serait un trou de récolte, pas une semaine calme ;
//   · aucune clé `changements` → le journal n'a pas pu être lu ;
//   · couvert et vide → la plateforme n'a vraiment rien écrit.

type Journal = SourcesHebdo[string]["journal"];

// La hauteur des volumes et des trois ratios à gauche, à `lg` : au-delà, la
// liste défile au lieu d'allonger la carte (user story 26).
const HAUTEUR = "max-h-[340px]";

function Silence({ children }: { children: string }) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wide text-faint font-bold mb-2">Changements</h3>
      <p className="text-[12.5px] text-muted leading-relaxed">{children}</p>
    </div>
  );
}

export function ChangementsCanal({
  canal,
  donnees,
  journal,
  semaine,
}: {
  canal: string;
  donnees: CanalHebdo;
  journal: Journal | undefined;
  semaine: SemaineHebdo | null | undefined;
}) {
  const nom = SOURCE[canal]?.nom ?? canal;
  // Sans source connue, rien ne prouve que le journal couvre la semaine.
  if (journal !== "couvert") return <Silence>Changements en cours de récupération.</Silence>;
  const changements = donnees.changements;
  if (!changements) return <Silence>{`Le journal de ${nom} n'a pas pu être lu pour cette semaine.`}</Silence>;
  if (!changements.length) return <Silence>{`${nom} n'a écrit aucun changement cette semaine.`}</Silence>;

  const lien = lienJournal(canal, semaine);
  return (
    <ScrollList
      title="Changements"
      count={changements.length}
      maxH={HAUTEUR}
      divise={false}
      action={
        lien && (
          <Link href={lien} className="text-[11.5px] text-muted hover:text-ink hover:underline">
            journal →
          </Link>
        )
      }
    >
      {parCategorie(changements).map(({ categorie, lignes }) => (
        <section key={categorie} className="px-3 py-2.5 border-b border-line last:border-b-0">
          <h4 className="text-[11px] font-semibold text-ink mb-1">
            {MOT_CATEGORIE_HEBDO[categorie]} <span className="text-faint font-normal">· {lignes.length}</span>
          </h4>
          <ul className="space-y-1.5">
            {lignes.map((c, i) => (
              <li key={i} className="text-[12px] leading-snug min-w-0">
                <span className="text-faint tabular-nums">{jourCourt(c.jour)}</span>
                <span className="text-faint"> · </span>
                <span className="text-ink font-medium">{c.campagne ?? c.objet ?? "—"}</span>
                <span className="block text-muted break-words">{c.resume}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ScrollList>
  );
}
