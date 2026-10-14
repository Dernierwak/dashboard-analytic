import Link from "next/link";
import { Icone } from "@/components/meta/elements";
import { PanneauLateral } from "@/components/meta/panneau";
import type { Apercu } from "@/lib/meta/donnees";
import { pluriel, type AnnonceSelection } from "@/lib/meta/lecture";
import { lienMeta, SANS_PANNEAU, type Params } from "@/lib/meta/liens";

// ── L'ONGLET « APERÇUS » ─────────────────────────────────────────────────────
//
// Écran validé au ticket 10 de `.scratch/journal-meta/` (point 2) : pour
// chaque annonce de la sélection, le dernier visuel et le dernier texte que
// la récolte des créas a lus — de quoi voir à quoi elles ressemblent sans les
// ouvrir une à une. « Lire » ouvre l'annonce entière dans ce même panneau.
//
// Une annonce que la récolte n'a pas lue le dit : jamais un aperçu vide qu'on
// lirait « elle n'a pas de texte ». Sans directive : rendu côté serveur.

export function ApercusAnnonces({
  annonces,
  apercus,
  params,
  fermeture,
}: {
  annonces: AnnonceSelection[];
  /** `null` = la lecture a échoué. */
  apercus: Record<string, Apercu> | null;
  params: Params;
  fermeture: string;
}) {
  return (
    <PanneauLateral
      titre="Aperçus des annonces"
      sousTitre={`${pluriel(annonces.length, "annonce")} · le dernier visuel et le dernier texte lus par Pulse`}
      fermeture={fermeture}
    >
      {apercus === null && (
        <p className="mb-4 mt-2 rounded-xl bg-canvas px-4 py-3 text-[13px] text-muted">
          Le contenu des annonces n&apos;a pas pu être lu. Les chiffres de la page, eux, ne sont pas touchés.
        </p>
      )}
      {annonces.length === 0 && <p className="mt-2 text-[14px] text-muted">Aucune annonce n&apos;a de chiffres sur cette période.</p>}
      <ul className="mt-1 space-y-4">
        {annonces.map((a) => {
          const x = a.id && apercus ? apercus[a.id] : undefined;
          return (
            <li key={a.cle} className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-3">
              {x?.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- une vignette venue de Storage, comme celles de la Comparaison.
                <img src={x.image} alt="" className="h-14 w-14 rounded-lg object-cover" loading="lazy" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#efeee9] text-faint" title="Aucun visuel lu pour cette annonce">
                  <Icone nom="calques" className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-[14px] font-semibold text-ink">{a.nom || "Sans nom"}</p>
                  {a.id && (
                    <Link
                      href={lienMeta(params, { ...SANS_PANNEAU, annonce: a.id })}
                      scroll={false}
                      aria-label={`Lire l'annonce ${a.nom || "sans nom"}`}
                      className="shrink-0 rounded-md px-1.5 text-[12.5px] font-medium text-brand hover:bg-[#eef2ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      Lire
                    </Link>
                  )}
                </div>
                <p className="truncate text-[11.5px] text-faint">{a.sous}</p>
                {apercus !== null &&
                  (x ? (
                    <div className="mt-1 space-y-0.5 text-[13px] [overflow-wrap:anywhere]">
                      {x.titre && <p className="text-ink">« {x.titre} »</p>}
                      {x.texte && <p className="line-clamp-3 text-muted">{x.texte}</p>}
                      {!x.titre && !x.texte && <p className="text-muted">Ni titre ni texte lus pour cette annonce.</p>}
                    </div>
                  ) : (
                    <p className="mt-1 text-[13px] text-muted">Pulse n&apos;a pas encore lu le contenu de cette annonce.</p>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
    </PanneauLateral>
  );
}
