import Link from "next/link";
import { dansCombien, echeanceDe } from "@/lib/echeance";
import { dateFr, horodatage } from "@/lib/jour-de-travail";

// ── L'ÉCHÉANCE D'UNE CONNEXION, DITE SUR LE RAPPORT ──────────────────────────
//
// `.scratch/recolte/tickets/05-l-echeance-se-dit-avant-la-panne.md`. Le rapport
// est la page que le client ouvre chaque semaine ; la page Connexions, il n'y
// revient que quand quelque chose est cassé. Un préavis qui ne vit que là-bas
// arrive donc après la panne. Il se dit ICI, tant qu'il reste le temps d'agir.
//
// IL NE SE LIT PAS DANS LE PAYLOAD, et c'est voulu : le rapport est publié une
// fois par semaine, il dirait encore « expire dans 3 jours » six jours après
// la reconnexion. La date vient de `connected_accounts`, à chaque affichage.
//
// SEUL LE PROPRIÉTAIRE LE VOIT : un invité ne lit pas `connected_accounts`
// (`CLAUDE.md` §7) et ne pourrait de toute façon pas se reconnecter à sa place.
//
// Rien ne s'affiche hors de la fenêtre de préavis, ni sans date : le module
// rend `null`, et la page s'ouvre sur son titre comme avant.

const PLATEFORMES = [
  { cle: "meta", nom: "Meta", sert: "tes campagnes Meta ni tes publications Instagram" },
  { cle: "google", nom: "Google", sert: "tes campagnes Google Ads ni ton Analytics" },
] as const;

export function EcheanceConnexion({
  echeances,
  maintenant,
}: {
  echeances: { meta: string | null; google: string | null };
  maintenant: Date;
}) {
  const lignes = PLATEFORMES.flatMap((p) => {
    const e = echeanceDe(echeances[p.cle], maintenant);
    const jour = e && horodatage(e.expireLe);
    return e && jour && e.bientot ? [{ ...p, e, jour }] : [];
  });
  if (!lignes.length) return null;

  return (
    <section
      aria-label="Connexions bientôt à échéance"
      className="mb-6 rounded-xl border border-warn/25 bg-warn/[0.04] px-4 py-3"
    >
      <ul className="space-y-1.5">
        {lignes.map(({ cle, nom, sert, e, jour }) => (
          <li key={cle} className="text-[12.5px] text-ink leading-relaxed">
            <span className="font-semibold">
              {e.passee
                ? `Ton autorisation ${nom} est arrivée à échéance le ${dateFr(jour)}.`
                : `Ton autorisation ${nom} prend fin le ${dateFr(jour)}, ${dansCombien(e)}.`}
            </span>{" "}
            {e.passee
              ? `Le prochain rapport ne pourra plus lire ${sert}.`
              : `Passé cette date, ce rapport ne pourra plus lire ${sert}.`}
          </li>
        ))}
      </ul>
      <Link
        href="/comptes"
        className="inline-block mt-2 text-[12.5px] font-semibold text-brand hover:underline"
      >
        Reconnecter sur la page Connexions
      </Link>
    </section>
  );
}
