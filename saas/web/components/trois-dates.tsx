import { dateFr, dateNue, enFrancais, horodatage, prochainPassage } from "@/lib/jour-de-travail";

// ── LES TROIS DATES EN TÊTE DU RAPPORT ───────────────────────────────────────
//
// « Le hebdomadaire doit être clair sur le fait que nos données sont de X à X
// et seront mises à jour le X. » — David,
// `.scratch/refonte/issues/13-entre-deux-jours-de-travail.md` §4.
//
// MESURÉ du X au X · PUBLIÉ le X · MIS À JOUR le X. Toute la clarté du décalage
// entre deux Jours de travail tient dans ces trois dates — et dans rien
// d'autre. C'est ce qui rend inutile la mention d'âge par carte, refusée deux
// fois : *« on ne dit rien. Le client voit les changements des modules labels,
// il doit pouvoir comprendre seul, via l'hebdomadaire. »* La confiance est mise
// dans UNE mention globale, ici, plutôt que dans une pastille par bloc.
//
// CE QUE CETTE LIGNE N'A PAS LE DROIT DE DIRE : qu'un rapport est « périmé ».
// Un rapport de six jours est vieux, pas faux, et rien ne permet de mesurer à
// partir de quand il tromperait (`CLAUDE.md` §7). Aucune des trois dates ne
// porte donc de jugement — elles se lisent, elles ne s'alarment pas. Pas de
// couleur d'alerte, pas de « il y a N jours », pas de bandeau.
//
// POURQUOI « MIS À JOUR » ET PAS « REGROUPÉ ». `CONTEXT.md` déconseille « mise
// à jour » pour un Regroupement — parce que là, rien ne tourne, on relit
// autrement. Ici quelque chose tourne vraiment : le Jour de travail récolte,
// recalcule et publie. Le mot est celui de David et il est exact.
//
// CHAQUE DATE PEUT MANQUER, ET ALORS ELLE NE S'ÉCRIT PAS. Un payload publié
// avant août 2026 n'a ni `since` ni `until` ; une lecture ratée n'a pas
// d'`updated_at`. On affiche ce qu'on sait, jamais une date approchée.

export function TroisDates({
  since,
  until,
  publieLe,
  jourDeTravail,
  maintenant,
}: {
  /** Premier jour plein de la fenêtre mesurée (`payload.since`). */
  since: string | null | undefined;
  /** Dernier jour plein — jamais aujourd'hui, la journée du fetch est
   *  incomplète (`CLAUDE.md` §7). */
  until: string | null | undefined;
  /** `weekly_reports.updated_at` — quand ce payload a été écrit. */
  publieLe: string | null;
  /** Le Jour de travail du compte, en anglais comme en base. */
  jourDeTravail: string;
  /** L'heure du rendu, passée par la page : le composant ne lit pas l'horloge
   *  lui-même, pour que la ligne entière se calcule sur un seul instant. */
  maintenant: Date;
}) {
  const d1 = dateNue(since);
  const d2 = dateNue(until);
  const pub = horodatage(publieLe);
  const { date: prochain } = prochainPassage(jourDeTravail, maintenant);

  // La fenêtre ne s'écrit qu'entière : une moitié de fenêtre ne dit pas sur
  // quoi les chiffres portent, et « du 7 » tout seul se lirait comme un début
  // sans fin.
  const mesure = d1 && d2 ? `du ${dateFr(d1)} au ${dateFr(d2)}` : null;

  const bouts: React.ReactNode[] = [];
  if (mesure)
    bouts.push(
      <span key="m">
        Mesuré <span className="text-ink font-semibold">{mesure}</span>
      </span>
    );
  if (pub) bouts.push(<span key="p">publié le {dateFr(pub)}</span>);
  // La troisième est la nouveauté, et c'est elle qui porte les deux autres :
  // c'est elle qui répond au client qui vient de classer des campagnes un
  // mardi et qui voit ses dashboards bouger sans que le rapport bouge.
  bouts.push(<span key="j">mis à jour le {enFrancais(prochain)}</span>);

  return (
    <p className="text-[11px] text-faint leading-relaxed flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      {bouts.map((b, i) => (
        <span key={i} className="flex items-baseline gap-x-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          {b}
        </span>
      ))}
    </p>
  );
}
