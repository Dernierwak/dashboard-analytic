import Link from "next/link";
import type { CanalMuetLive } from "@/lib/canaux-muets";

// « CE QU'ON N'A PAS PU LIRE », SUR LES PAGES QUI CALCULENT ELLES-MÊMES.
//
// POURQUOI UN SECOND MODULE À CÔTÉ DE `CanalMuetAlerte`. Ce n'est pas un
// doublon, c'est la même chose dite sur une autre SOURCE. `CanalMuetAlerte` lit
// `canaux_muets` dans le payload : c'est la photo du jour où le worker a écrit,
// et c'est la bonne source pour le rapport, qui est ce payload. `/couts`,
// `/meta` et `/google` ne lisent aucun payload — ils rouvrent les tables brutes
// — donc ils ont besoin de l'état de MAINTENANT (`lib/canaux-muets.ts`), qui
// peut déjà être réparé quand le payload dit encore le contraire.
//
// CE MODULE EST LA MOITIÉ QUI TRANSFORME UN SILENCE EN GESTE. Sans lui, les
// « — » posés par le ticket 48 se lisent comme un bug de Pulse — et un produit
// qui a l'air cassé se ferme. Avec lui, ils se lisent comme une connexion à
// refaire, ce qu'ils sont. C'est le même arbitrage que sur le rapport, et il
// vaut ici encore plus : une page de budget qui affiche des tirets sans les
// expliquer fait douter du budget, pas de la récolte.
//
// IL DISPARAÎT QUAND IL N'A RIEN À DIRE. Pas de « toutes tes connexions vont
// bien ✓ » : un bloc qui rassure tous les jours s'apprend par cœur, et le jour
// où il dit autre chose on ne le lit plus.
//
// AMBRE, PAS ROUGE. Ce n'est pas une catastrophe, c'est une connexion à
// refaire ; le rouge reste réservé à ce qui coûte de l'argent maintenant.
export function TrouDeRecolte({
  muets,
  /** Ce que cette page-ci ne peut plus dire, en clair et au pluriel — « ta
   *  dépense et ton budget », « les chiffres de ce canal ». Écrit par la page,
   *  parce qu'elle seule sait ce qu'elle affiche : une phrase générique
   *  vaudrait faux sur l'une des trois. */
  taisent,
}: {
  muets: CanalMuetLive[];
  taisent: string;
}) {
  if (muets.length === 0) return null;

  return (
    <div className="rounded-xl border border-warn/25 bg-warn/[0.06] px-4 py-3 mb-4">
      <div className="text-[10px] uppercase tracking-widest text-warn font-bold mb-1.5">
        Ce qu&apos;on n&apos;a pas pu lire
      </div>
      <p className="text-[12.5px] text-ink leading-relaxed max-w-[68ch]">
        <strong className="font-semibold">{muets.map((c) => c.nom).join(" et ")}</strong>{" "}
        {muets.length > 1 ? "n'ont" : "n'a"} pas répondu au dernier passage. {taisent} —
        marqué «&nbsp;—&nbsp;» plutôt que calculé sans {muets.length > 1 ? "eux" : "lui"}.{" "}
        <span className="text-muted">
          Une donnée absente n&apos;est pas un zéro, et un total amputé se lirait comme une
          baisse que personne n&apos;a décidée.
        </span>
      </p>
      {/* LE DERNIER JOUR RÉELLEMENT LU — c'est ce qui borne le trou, et la seule
          chose qui dise si la panne date d'hier ou d'un mois. Un canal qui n'a
          jamais rien écrit n'a pas de date : on le dit, on n'en fabrique pas
          une (`CLAUDE.md` §7). */}
      <ul className="mt-2 space-y-1">
        {muets.map((c) => (
          <li key={c.canal} className="text-[11.5px] text-muted leading-relaxed">
            <span className="font-medium text-ink">{c.nom}</span>
            {c.depuis ? ` — lu jusqu'au ${fmtJour(c.depuis)}` : " — aucune donnée reçue"}
          </li>
        ))}
      </ul>
      {/* Le geste se pose SOUS le fait qui le motive : ce lien ne quitte pas le
          module, il répare sa cause. */}
      <Link
        href="/comptes"
        className="inline-block mt-2.5 text-[12px] font-medium text-brand hover:underline"
      >
        Reconnecter depuis Comptes &rarr;
      </Link>
    </div>
  );
}

// « 2026-09-05 » → « 5 septembre ». Construit en UTC : ces dates sont des jours
// pleins, pas des instants, et les relire dans le fuseau du navigateur les
// reculerait d'un jour à l'ouest de Greenwich.
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];

function fmtJour(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}
