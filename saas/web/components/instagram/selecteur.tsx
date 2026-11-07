import Link from "next/link";
import { METRIQUES, METRIQUES_DE, type CleMetrique, type Objectif } from "@/lib/instagram/lecture";
import { lienInstagram, type Params } from "@/lib/instagram/liens";

// ── LE SÉLECTEUR DE VUE : L'OBJECTIF, PUIS SA MÉTRIQUE ──────────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Sélecteur de vue » ; user stories 11
// à 13. L'Objectif donne la métrique par défaut ; le module, la liste et le
// Tableau suivent la métrique choisie — une place à la fois. Tout est lien
// (`?metrique=`, le reste de l'URL gardé) : une vue se partage.
//
// Une métrique qu'aucun post n'a encore reste là, grisée, avec sa raison
// écrite sous les pastilles — pas seulement au survol, qu'un téléphone n'a pas.

const OBJECTIFS: { cle: Objectif; nom: string; question: string }[] = [
  { cle: "portee", nom: "Portée", question: "Combien de comptes mes posts touchent-ils ?" },
  { cle: "engagement", nom: "Engagement", question: "Ceux qui les voient réagissent-ils ?" },
  { cle: "abonnes", nom: "Abonnés", question: "Mes posts me font-ils gagner du monde ?" },
];

export function SelecteurObjectif({
  metrique,
  indisponibles,
  params,
}: {
  metrique: CleMetrique;
  /** Métrique → pourquoi elle est grisée (`raisonIndisponible`). */
  indisponibles: Partial<Record<CleMetrique, string>>;
  params: Params;
}) {
  const objectif = METRIQUES[metrique].objectif;
  const grisees = METRIQUES_DE[objectif].filter((m) => indisponibles[m]);

  return (
    <section aria-labelledby="titre-objectif" className="min-w-0">
      <p id="titre-objectif" className="mb-3 text-[13px] text-muted">
        Choisis ce que tu veux lire : l&apos;objectif, puis sa métrique. Le module et la place de chaque post la suivent.
      </p>
      <nav className="grid gap-3 sm:grid-cols-3" aria-label="Objectifs">
        {OBJECTIFS.map((o) => {
          const actif = o.cle === objectif;
          return (
            <Link
              key={o.cle}
              href={lienInstagram(params, { metrique: METRIQUES_DE[o.cle][0] })}
              scroll={false}
              aria-current={actif ? "page" : undefined}
              className={`min-w-0 rounded-2xl p-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                actif ? "bg-ink text-white" : "border border-line bg-white hover:border-ink/20"
              }`}
            >
              <p className={`text-[16px] font-semibold ${actif ? "text-white" : "text-ink"}`}>{o.nom}</p>
              <p className={`mt-0.5 text-[13px] ${actif ? "text-white/65" : "text-muted"}`}>{o.question}</p>
            </Link>
          );
        })}
      </nav>
      <div className="mt-3 flex flex-wrap gap-1.5" role="list" aria-label={`Métriques de l'objectif ${objectif}`}>
        {METRIQUES_DE[objectif].map((m) => {
          const raison = indisponibles[m];
          const choisie = m === metrique;
          const classe = "rounded-full border px-3 py-1 text-[12.5px] font-medium";
          if (raison && !choisie) {
            return (
              <span key={m} role="listitem" aria-disabled title={raison} className={`${classe} cursor-not-allowed border-line bg-canvas text-faint`}>
                {METRIQUES[m].nom}
              </span>
            );
          }
          return (
            <Link
              key={m}
              role="listitem"
              href={lienInstagram(params, { metrique: m })}
              scroll={false}
              aria-current={choisie ? "true" : undefined}
              title={METRIQUES[m].aide}
              className={`${classe} ${choisie ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:text-ink"} ${raison ? "opacity-60" : ""}`}
            >
              {METRIQUES[m].nom}
            </Link>
          );
        })}
      </div>
      {grisees.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12px] text-faint">
          {grisees.map((m) => (
            <li key={m}>
              {METRIQUES[m].nom} : {indisponibles[m]}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
