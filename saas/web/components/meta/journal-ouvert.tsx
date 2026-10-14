"use client";

import { useSearchParams } from "next/navigation";
import { JournalChangements } from "@/components/meta/journal-changements";
import { enFrancais } from "@/lib/jour-de-travail";
import { panneauDe, panneauDemandeDe, type ChangementMeta, type Portee } from "@/lib/meta/changements";
import { bornes, pluriel, type Campagne, type Niveau, type Periode } from "@/lib/meta/lecture";

// ── LE JOURNAL OUVERT, TENU PAR LE NAVIGATEUR ────────────────────────────────
//
// Le jour d'un point (`jour`, et `element` depuis la Comparaison) et l'onglet
// « Changements » (`panneau=changements`) se calculent ici, depuis le journal
// de la période que la page a déjà lu : les ouvrir ne relit rien
// (`lib/meta/sur-place.ts`, mesure du ticket 17). L'état vit toujours dans
// l'URL — ce composant ne fait que la lire, au rendu serveur d'un lien
// partagé comme après un `pushState`.
//
// La règle de ce qui s'ouvre est celle de la page et des onglets
// (`panneauDemandeDe`).

const changements = (n: number) => (n === 0 ? "Aucun changement" : pluriel(n, "changement"));

export function JournalOuvert({
  journal,
  contexte,
  portee,
  periode,
  sujet,
  comparaison,
  fermeture,
}: {
  journal: ChangementMeta[];
  contexte: { campagnes: Campagne[]; noms: Record<string, string> };
  /** Le filtre du Bandeau, par ID. */
  portee: Portee;
  periode: Periode;
  /** « toutes tes campagnes », ou le nom de ce que le Bandeau a choisi. */
  sujet: string;
  /** Ce qu'il faut de la Comparaison pour nommer l'élément d'un point et
   *  reprendre la couleur de sa ligne. */
  comparaison: { niveau: Niveau; noms: Record<string, string>; couleurs: Record<string, string> };
  fermeture: string;
}) {
  const url = useSearchParams();
  const { jour, element, onglet } = panneauDemandeDe((cle) => url.get(cle) ?? undefined, periode);

  const panneau = jour
    ? panneauDe(journal, { debut: jour, fin: jour }, { ...portee, element }, contexte)
    : onglet === "changements"
      ? panneauDe(journal, { debut: periode.debut, fin: periode.fin }, portee, contexte)
      : null;

  if (!panneau) return null;

  if (jour) {
    const nom = element
      ? (comparaison.niveau === element.niveau && comparaison.noms[element.cle]) || contexte.noms[element.cle] || element.cle
      : null;
    const sujetJour = nom ? `« ${nom} »` : sujet;
    const couleur = element ? comparaison.couleurs[element.cle] : undefined;
    return (
      <JournalChangements
        panneau={panneau}
        titre={enFrancais(new Date(`${jour}T00:00:00Z`))}
        sousTitre={
          <>
            {couleur && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: couleur }} aria-hidden />}
            <span className="min-w-0 truncate">
              {changements(panneau.total)} sur {sujetJour}
            </span>
          </>
        }
        vide={`Meta ne déclare aucun changement sur ${sujetJour} ce jour-là.`}
        parJour={false}
        fermeture={fermeture}
      />
    );
  }
  return (
    <JournalChangements
      panneau={panneau}
      titre="Tous les changements"
      sousTitre={`${changements(panneau.total)} sur ${sujet} · ${bornes(periode.debut, periode.fin)}`}
      vide={`Meta ne déclare aucun changement sur ${sujet} sur cette période.`}
      parJour
      fermeture={fermeture}
    />
  );
}
