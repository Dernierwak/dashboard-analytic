"use client";

import { useSearchParams } from "next/navigation";
import { PanneauLateral } from "@/components/meta/panneau";
import { enFrancais } from "@/lib/jour-de-travail";
import { jourOuvertDe, panneauDe, type ChangementGoogle, type CarteChangement, type NoeudCampagne } from "@/lib/google/changements";
import type { Campagne, Periode } from "@/lib/google/lecture";

// ── LE PANNEAU DU JOUR, TENU PAR LE NAVIGATEUR ───────────────────────────────
//
// Spec Google, § « Panneau latéral » (le jour) ; user stories 30, 31, 66 à 68.
// Le jour d'un point (`jour`) se calcule ici, depuis le journal de la période
// que la page a déjà lu : l'ouvrir ne relit rien (`lib/meta/sur-place.ts`,
// mesure du ticket 17 du journal Meta). L'état vit toujours dans l'URL — ce
// composant ne fait que la lire, au rendu serveur d'un lien partagé comme
// après un `pushState`. Un jour hors période ne s'ouvre pas (`jourOuvertDe`).
//
// Les changements sont rangés par campagne, chacun une petite carte : sa
// nature, l'heure du compte, la phrase de la récolte. Pas de groupe ni
// d'annonce en sous-niveau : une ligne Google ne dit pas l'élément touché
// autrement que dans sa phrase (`lib/google/changements.ts`).
//
// CE QUE LE JOURNAL NE COUVRE PAS NE SE DIT PAS ICI : c'est la « ⓘ » de la
// légende de la Tendance. Un panneau vide dit seulement que Google n'a rien
// déclaré.

const changements = (n: number) => (n === 0 ? "Aucun changement" : n === 1 ? "1 changement" : `${n} changements`);

export function JournalOuvert({
  journal,
  campagnes,
  campagne,
  periode,
  sujet,
  fermeture,
}: {
  journal: ChangementGoogle[];
  campagnes: Campagne[];
  /** Le filtre du Bandeau, par ID. */
  campagne: string | null;
  periode: Periode;
  /** « toutes tes campagnes », ou le nom de celle choisie. */
  sujet: string;
  fermeture: string;
}) {
  const url = useSearchParams();
  const jour = jourOuvertDe(url.get("jour") ?? undefined, periode);
  if (!jour) return null;
  const { total, campagnes: blocs, nonRattaches } = panneauDe(journal, jour, campagne, campagnes);

  return (
    <PanneauLateral
      titre={enFrancais(new Date(`${jour}T00:00:00Z`))}
      sousTitre={<span className="min-w-0 truncate">{changements(total)} sur {sujet}</span>}
      fermeture={fermeture}
      surPlace
    >
      {total === 0 && <p className="mt-2 text-[14px] text-muted">Google Ads ne déclare aucun changement sur {sujet} ce jour-là.</p>}

      <div className="mt-1 space-y-6">
        {blocs.map((c) => (
          <BlocCampagne key={c.id ?? "inconnue"} c={c} />
        ))}
      </div>

      {nonRattaches > 0 && (
        <p className="mt-6 rounded-xl bg-canvas px-4 py-3 text-[13px] text-muted">
          {nonRattaches > 1 ? `${nonRattaches} autres changements` : "Un autre changement"} sur{" "}
          {nonRattaches > 1 ? "des éléments" : "un élément"} dont Pulse n&apos;a pas retrouvé la campagne, comme un élément posé
          au niveau du compte : {nonRattaches > 1 ? "ils ne se montrent" : "il ne se montre"} que sans filtre.
        </p>
      )}
    </PanneauLateral>
  );
}

function BlocCampagne({ c }: { c: NoeudCampagne }) {
  return (
    <section className="min-w-0" aria-label={c.nom ?? "Campagne non retrouvée"}>
      <h3 className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.couleur }} aria-hidden />
        <span className="min-w-0 truncate text-[12.5px] font-semibold uppercase tracking-wide text-muted">
          {c.nom ?? "Campagne non retrouvée"}
        </span>
        <span className="ml-auto shrink-0 pl-2 font-mono text-[12px] text-faint">{c.cartes.length}</span>
      </h3>
      <div className="relative ml-[4px] mt-3 min-w-0 space-y-3 border-l-2 pl-4" style={{ borderColor: c.couleur }}>
        {c.cartes.map((carte) => (
          <Carte key={carte.id} carte={carte} />
        ))}
      </div>
    </section>
  );
}

function Carte({ carte }: { carte: CarteChangement }) {
  return (
    <article className="min-w-0 rounded-xl border border-line bg-canvas px-3.5 py-3">
      <header className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line pb-2">
        <h4 className="min-w-0 text-[14.5px] font-semibold text-ink">{carte.nature}</h4>
        {/* L'heure du compte, telle que Google l'écrit : pas de « UTC ». */}
        <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-faint">{carte.heure}</span>
      </header>
      <p className="mt-2 min-w-0 text-[14px] text-muted [overflow-wrap:anywhere] first-letter:uppercase">{carte.phrase}</p>
    </article>
  );
}
