import Link from "next/link";
import type { CanalMuet } from "@/lib/report";
import { PriseDebranchee } from "@/components/illustrations";
import { IconeAttention, IconeConnexions } from "@/components/icones";

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
// AMBRE ET PAS ROUGE, MÊME À LA TROISIÈME SEMAINE. Ce n'est toujours pas une
// catastrophe, c'est une connexion à refaire ; le rouge reste réservé à ce qui
// coûte de l'argent maintenant. Ce qui change quand ça dure, c'est le REGISTRE
// du texte, pas son volume — voir `dure` plus bas.
export function CanalMuetAlerte({ canaux }: { canaux?: CanalMuet[] | null }) {
  // `undefined` = payload publié avant le ticket 20. Il ne dit pas « aucun
  // trou », il dit « je ne sais pas répondre » — on se tait plutôt que
  // d'affirmer que tout va bien.
  const tus = (canaux ?? []).filter((c) => c.chiffres_tus);
  if (tus.length === 0) return null;

  // LA NOTE CHANGE DE REGISTRE À LA DEUXIÈME SEMAINE (ticket 47), elle n'élève
  // pas le ton. Un compte au jeton mort depuis un mois recevait quatre fois la
  // même phrase — « n'a pas répondu cette semaine » — et on s'habitue à une
  // phrase qui ne bouge pas comme à un bandeau de cookies. Elle cesse donc de
  // décrire LA SEMAINE et nomme LA DURÉE, qui est le seul fait nouveau.
  //
  // LE REGISTRE SE DÉCIDE CANAL PAR CANAL. Deux canaux peuvent avoir deux âges
  // — Google tombé lundi, Meta mort depuis deux mois — et « ce n'est plus la
  // première semaine » vaut alors FAUX sur l'un des deux. Un seul `some()` sur
  // toute la liste aurait promu le fait de l'un en phrase sur l'ensemble, et le
  // détail juste, plus bas, aurait contredit le titre.
  //
  // `?? 1` : les payloads d'avant ce ticket n'ont pas le compteur. Les lire
  // comme une première semaine sous-estime la panne au lieu de l'inventer.
  const durent = tus.filter((c) => (c.semaines_muettes ?? 1) >= 2);
  const recents = tus.filter((c) => (c.semaines_muettes ?? 1) < 2);

  return (
    // La prise débranchée à gauche dit la nature du trou avant qu'on ait lu
    // un mot : une connexion à refaire, pas une panne de Pulse.
    <div className="flex gap-5 items-start rounded-2xl border border-warn/20 bg-alerte shadow-card px-5 py-4 sm:px-6 mb-3">
      <PriseDebranchee className="hidden sm:block w-[92px] shrink-0 mt-1" />
      <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[14px] text-warn font-semibold mb-1.5">
        <IconeAttention taille={16} />
        Ce qu&apos;on n&apos;a pas pu lire
      </p>
      <p className="text-[13.5px] text-ink leading-relaxed max-w-[68ch]">
        {durent.length > 0 && (
          <>
            <strong className="font-semibold">{joindre(durent)}</strong>{" "}
            {durent.length > 1 ? "ne répondent" : "ne répond"} toujours pas, et
            ce n&apos;est plus la première semaine. Tant que ça dure, Pulse ne
            peut rien dire de ta publicité — ni dépense, ni coût par clic, ni
            ROAS.{" "}
          </>
        )}
        {recents.length > 0 && (
          <>
            <strong className="font-semibold">{joindre(recents)}</strong>{" "}
            {recents.length > 1 ? "n'ont" : "n'a"} pas répondu cette semaine. Les
            chiffres de publicité qui en dépendent — dépense, coût par clic,
            ROAS — sont marqués «&nbsp;—&nbsp;» au lieu d&apos;être calculés sans
            eux.{" "}
          </>
        )}
        <span className="text-muted">
          Une donnée absente n&apos;est pas un zéro, et un total amputé se lirait comme
          une baisse que personne n&apos;a décidée.
        </span>
      </p>
      {/* Le dernier jour réellement lu — c'est ce qui borne le trou, et c'est la
          seule chose qui dise au client si la panne date d'hier ou d'un mois.
          C'EST CETTE DATE QU'ON MONTRE, JAMAIS LE COMPTEUR DE SEMAINES : la date
          est mesurée, le compteur n'est qu'un seuil interne (ticket 47). Un
          canal qui n'a jamais rien écrit n'a pas de date — on le dit, on n'en
          fabrique pas une. */}
      <ul className="mt-2.5 space-y-1">
        {tus.map((c) => (
          <li key={c.canal} className="text-[12px] text-muted leading-relaxed">
            <span className="font-medium text-ink">{c.nom}</span>
            {c.depuis
              ? (c.semaines_muettes ?? 1) >= 2
                ? ` — sans réponse depuis le ${fmtJour(c.depuis)}`
                : ` — lu jusqu'au ${fmtJour(c.depuis)}`
              : " — aucune donnée reçue"}
          </li>
        ))}
      </ul>
      {/* Le geste se pose SOUS le fait qui le motive, jamais au-dessus : même
          arbitrage que `AlerteThemes`, et pour la même raison — ce lien ne
          quitte pas le module, il répare sa cause. */}
      <Link
        href="/comptes"
        className="inline-flex items-center gap-2 mt-3.5 rounded-lg bg-white border border-line shadow-card px-3 py-1.5 text-[13px] font-medium text-ink hover:border-brand/40 hover:text-brand transition-colors"
      >
        <IconeConnexions taille={16} className="text-brand" />
        Reconnecter dans Connexions
      </Link>
      </div>
    </div>
  );
}

// « 2026-09-05 » → « 5 septembre ». Construit en UTC : les dates du payload sont
// des jours pleins, pas des instants, et les relire dans le fuseau du
// navigateur les reculerait d'un jour à l'ouest de Greenwich.
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];

function joindre(canaux: CanalMuet[]): string {
  return canaux.map((c) => c.nom).join(" et ");
}

function fmtJour(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}
