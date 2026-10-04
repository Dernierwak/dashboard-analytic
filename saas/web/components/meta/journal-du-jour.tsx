import { PanneauLateral } from "@/components/meta/panneau";
import { enFrancais } from "@/lib/jour-de-travail";
import type { PanneauJour } from "@/lib/meta/changements";

// ── LE JOUR OUVERT, DANS LE PANNEAU LATÉRAL ──────────────────────────────────
//
// User story 24 : tous les changements du jour, rangés par campagne, chacun
// avec son heure, sa nature et sa phrase — la phrase nomme l'élément touché,
// la récolte n'en écrit aucune sans lui. Le calcul (quoi montrer, sous quel
// nom, combien d'écartés) est dans `lib/meta/changements.ts`, testé.
//
// CE QUE LE JOURNAL NE COUVRE PAS NE SE DIT PAS ICI : c'est l'info-bulle de la
// légende de la Tendance, et nulle part ailleurs (décision du ticket 08 de la
// carte). Un panneau vide dit seulement que Meta n'a rien déclaré.
//
// Sans directive : rendu côté serveur, glissé dans le panneau client.

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export function JournalDuJour({
  panneau,
  sujet,
  fermeture,
}: {
  panneau: PanneauJour;
  /** « toutes tes campagnes », ou « "Soldes" ». */
  sujet: string;
  fermeture: string;
}) {
  const { total, groupes, nonRattaches } = panneau;
  return (
    <PanneauLateral
      titre={enFrancais(new Date(`${panneau.jour}T00:00:00Z`))}
      sousTitre={`${total === 0 ? "Aucun changement" : pluriel(total, "changement")} sur ${sujet}`}
      fermeture={fermeture}
    >
      {total === 0 && <p className="mt-2 text-[14px] text-muted">Meta ne déclare aucun changement sur {sujet} ce jour-là.</p>}

      {groupes.map((g) => (
        <section key={g.campagneId ?? "inconnue"} className="mb-7 mt-2">
          <h3 className="mb-3 flex min-w-0 items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.couleur }} aria-hidden />
            <span className="truncate">{g.nom ?? "Campagne non retrouvée"}</span>
          </h3>
          <ol className="ml-1 space-y-5 border-l border-line">
            {g.lignes.map((c) => (
              <li key={c.id} className="relative pl-5">
                <span className="absolute -left-[4px] top-2 h-2 w-2 rounded-full bg-[#dddcd6] ring-4 ring-white" aria-hidden />
                <span className="inline-block rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11.5px] font-semibold text-brand">{c.nature}</span>
                {/* « UTC » écrit : le fuseau du compte n'est pas récolté, et une
                    heure sans fuseau se lirait comme l'heure locale. */}
                <span className="ml-2 text-[12px] tabular-nums text-faint">{c.heure} UTC</span>
                <p className="mt-1.5 text-[15px] font-medium text-ink first-letter:uppercase">{c.phrase}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {nonRattaches > 0 && (
        <p className="rounded-xl bg-canvas px-4 py-3 text-[13px] text-muted">
          {nonRattaches > 1 ? `${nonRattaches} autres changements` : "Un autre changement"} ce jour-là, sur{" "}
          {nonRattaches > 1 ? "des éléments" : "un élément"} dont Pulse n&apos;a pas retrouvé la campagne :{" "}
          {nonRattaches > 1 ? "ils ne se montrent" : "il ne se montre"} que sans filtre.
        </p>
      )}
    </PanneauLateral>
  );
}
