import Link from "next/link";
import type { CanalMuet } from "@/lib/report";

// « CE QU'ON N'A PAS PU LIRE » — le trou de récolte, dit au client.
//
// POURQUOI CE MODULE EXISTE, ET POURQUOI IL EST EN HAUT.
// Depuis le ticket 20 de la construction, un canal dont la récolte a échoué ne
// fait plus taire le rapport entier : il fait taire les mesures qui traversent
// son trou. Le client voit donc des « — » là où il lisait une dépense, un CPC,
// un ROAS. Sans ce module, ces tirets se lisent comme un bug de Pulse — et un
// produit qui a l'air cassé se ferme. Avec lui, ils se lisent comme une
// connexion à refaire, ce qu'ils sont.
//
// C'est la moitié qui transforme un silence en geste. Retenir le rapport (ce
// que faisait le worker) ou le publier troué sans l'expliquer reviennent au
// même pour le client : il ne comprend pas, et il ne reconnecte pas. Le rapport
// est le SEUL canal par lequel on peut le lui dire — d'où sa place au-dessus
// des chiffres qu'il explique, et pas en note de bas de page.
//
// IL NE PARLE QUE DES CANAUX QUI TAISENT VRAIMENT QUELQUE CHOSE.
// Un canal tombé APRÈS avoir écrit toute la semaine est signalé dans le payload
// mais ne creuse aucun trou : l'annoncer userait l'alarme pour rien. C'est
// `chiffres_tus` qui tranche, et il est calculé par le worker — le seul à
// savoir jusqu'à quel jour chaque canal a réellement écrit.
//
// IL DISPARAÎT QUAND IL N'A PLUS RIEN À DIRE, comme `AlerteThemes` : pas de
// « toutes tes connexions vont bien ✓ » chaque lundi. Un bloc qui rassure toutes
// les semaines s'apprend par cœur, et le jour où il dit autre chose on ne le lit
// plus.
//
// AMBRE ET PAS ROUGE. Ce n'est pas une catastrophe, c'est une connexion à
// refaire ; le rouge est réservé à ce qui coûte de l'argent maintenant.
export function CanalMuetAlerte({ canaux }: { canaux?: CanalMuet[] | null }) {
  // `undefined` = payload publié avant le ticket 20. Il ne dit pas « aucun
  // trou », il dit « je ne sais pas répondre » — on se tait plutôt que
  // d'affirmer que tout va bien.
  const tus = (canaux ?? []).filter((c) => c.chiffres_tus);
  if (tus.length === 0) return null;

  const noms = tus.map((c) => c.nom).join(" et ");

  return (
    <div className="rounded-2xl border border-warn/25 bg-warn/[0.06] px-5 py-4 sm:px-6 mb-3">
      <p className="text-[11px] uppercase tracking-widest text-warn font-semibold mb-1.5">
        Ce qu&apos;on n&apos;a pas pu lire
      </p>
      <p className="text-[13.5px] text-ink leading-relaxed max-w-[68ch]">
        <strong className="font-semibold">{noms}</strong> n&apos;a pas répondu cette
        semaine. Les chiffres de publicité qui en dépendent — dépense, coût par clic,
        ROAS — sont marqués «&nbsp;—&nbsp;» au lieu d&apos;être calculés sans eux :{" "}
        <span className="text-muted">
          une donnée absente n&apos;est pas un zéro, et un total amputé se lirait comme
          une baisse que personne n&apos;a décidée.
        </span>
      </p>
      {/* Le dernier jour réellement lu — c'est ce qui borne le trou, et c'est la
          seule chose qui dise au client si la panne date d'hier ou d'un mois. */}
      <ul className="mt-2.5 space-y-1">
        {tus.map((c) => (
          <li key={c.canal} className="text-[12px] text-muted leading-relaxed">
            <span className="font-medium text-ink">{c.nom}</span>
            {c.depuis ? ` — lu jusqu'au ${fmtJour(c.depuis)}` : " — aucune donnée reçue"}
          </li>
        ))}
      </ul>
      {/* Le geste se pose SOUS le fait qui le motive, jamais au-dessus : même
          arbitrage que `AlerteThemes`, et pour la même raison — ce lien ne
          quitte pas le module, il répare sa cause. */}
      <Link
        href="/comptes"
        className="inline-block mt-3 text-[12.5px] font-medium text-brand hover:underline"
      >
        Reconnecter depuis Comptes &rarr;
      </Link>
    </div>
  );
}

// « 2026-09-05 » → « 5 septembre ». Construit en UTC : les dates du payload sont
// des jours pleins, pas des instants, et les relire dans le fuseau du
// navigateur les reculerait d'un jour à l'ouest de Greenwich.
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];

function fmtJour(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}
