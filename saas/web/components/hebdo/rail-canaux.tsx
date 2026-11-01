import type { ReportPayload } from "@/lib/report";
import { SectionTitle } from "@/components/hebdo/section-titre";
import { CarteCanal } from "@/components/hebdo/carte-canal";
import { RailDefilant } from "@/components/hebdo/rail-defilant";

// ── LE MODULE DES CANAUX, EN RAIL ────────────────────────────────────────────
//
// Une carte par canal (spec hebdo, « Rail ») : à 90 % de la largeur, la
// suivante dépasse à droite pour dire qu'il y en a d'autres ; ‹ › ou glisser.
// Une seule carte prend toute la largeur — il n'y a rien à faire dépasser.
//
// Le verdict, le focus KPI et l'alerte « canal muet » ont quitté la page avec
// ce module ; un payload publié avant le ticket 05 n'a pas de `canaux` et ne
// rend donc rien ici, plutôt que l'ancien jugement.

const ORDRE = ["meta", "google"] as const;

export function RailCanaux({ report }: { report: ReportPayload }) {
  const canaux = report.canaux;
  if (!canaux) return null;
  const presents = ORDRE.filter((c) => canaux[c]);
  if (!presents.length) return null;

  const largeur = presents.length > 1 ? "basis-[90%]" : "basis-full";
  return (
    <section className="mb-9">
      <RailDefilant titre={<SectionTitle>Les canaux</SectionTitle>} plusieurs={presents.length > 1}>
        {presents.map((canal) => (
          <div key={canal} className={`snap-start shrink-0 min-w-0 ${largeur}`}>
            <CarteCanal canal={canal} donnees={canaux[canal]} etat={report.sources?.[canal]?.etat} />
          </div>
        ))}
      </RailDefilant>
    </section>
  );
}
