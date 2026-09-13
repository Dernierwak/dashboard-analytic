import Link from "next/link";
import { compteursAFaire, type AFaire as Liste, type EtatAFaire } from "@/lib/a-faire";
import { ancreTheme } from "@/components/theme-card";
import { LigneConseil, LigneTache, LigneVerdict, TacheAjout } from "@/components/a-faire-lignes";

// ── LE MODULE « À FAIRE CETTE SEMAINE » ──────────────────────────────────────
//
// Il liste CE QUI ATTEND UNE DÉCISION DE TOI ; le rail, lui, montre le temps qui
// passe. Cette frontière est la seule qui empêche un quatrième objet de
// contredire les trois qui montrent déjà les mêmes actions — le tri est dans
// `lib/a-faire.ts`, qui est aussi le seul endroit où le compte se fait.
//
// L'ORDRE : les verdicts, puis ce que tu t'es écrit, puis les conseils. C'est
// déjà l'ordre du rail (`ORDRE = { juger: 0, running: 1, observation: 2 }`) —
// deux modules qui trient les mêmes objets en sens inverse sont la
// contradiction qu'on passe son temps à éviter. Et ce que TU as accompli passe
// devant ce que Pulse propose.
//
// AUCUN ÉCRAN DE FÉLICITATIONS, aucune barre de complétion, aucune animation.
// La récompense, c'est la ligne qui s'en va et le compteur qui descend, AU
// MOMENT DU CLIC. On ne fête que le mesuré — à l'arrivée d'un verdict `better`,
// et nulle part ailleurs.

/** Ce que la ligne d'un conseil vise quand on clique son titre : la carte du
 *  thème, où il est EXPLIQUÉ. Un réglage de base n'a pas de carte — il a son
 *  propre bloc en bas de page. */
function ancre(theme: string | null, reglage: boolean, themesRendus: Set<string>): string {
  if (reglage) return "#reglages";
  if (theme && themesRendus.has(theme)) return `#${ancreTheme(theme)}`;
  // Ni carte ni bloc : le thème a été renommé, ou il est sorti des étoiles
  // depuis la publication. On renvoie au moins à la section des thèmes plutôt
  // qu'à une ancre qui n'existe pas.
  return "#conseils";
}

export function AFaire({
  liste,
  etat,
  themesRendus,
  themes,
}: {
  liste: Liste;
  etat: EtatAFaire;
  /** Les thèmes qui ont réellement une carte sur cette page — c'est ce qui
   *  décide si le titre d'un conseil peut renvoyer quelque part. */
  themesRendus: Set<string>;
  /** Le vocabulaire du compte, pour dire sur quoi porte une ligne écrite à la
   *  main. */
  themes: string[];
}) {
  if (!etat.visible) return null;

  const n = compteursAFaire(liste);
  const compteurs = [
    n.verdicts > 0 ? `${n.verdicts} verdict${n.verdicts > 1 ? "s" : ""} à regarder` : null,
    n.decisions > 0 ? `${n.decisions} à décider` : null,
  ].filter(Boolean);

  return (
    <div className="bg-white border border-line rounded-xl shadow-card px-4 py-3.5">
      {compteurs.length > 0 && (
        <div className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1">
          {compteurs.join(" · ")}
        </div>
      )}

      {liste.verdicts.map((a) => (
        <LigneVerdict
          key={a.id}
          a={a}
          ancre={a.theme && themesRendus.has(a.theme) ? `#${ancreTheme(a.theme)}` : null}
        />
      ))}
      {liste.taches.map((a) => (
        <LigneTache key={a.id} a={a} />
      ))}
      {liste.conseils.map((c) => (
        <LigneConseil key={`${c.key}:${c.theme ?? ""}`} c={c} ancre={ancre(c.theme, c.reglage, themesRendus)} />
      ))}

      {/* L'ÉTAT BLOQUÉ, ET C'EST CE MODULE QUI LE PORTE. Les conseils sont
          filtrés DUR sur les thèmes prioritaires (ADR 0003) : sans étoile,
          aucun conseil ne peut entrer ici, jamais — le module ne disparaît donc
          pas, il dit pourquoi il est vide et donne le geste. La ligne de partage
          avec le module verrouillé d'une carte de thème est nette : celui-là
          parle de ce qui manque EN BASE (classe tes campagnes et tu débloques
          X), celui-ci de ce qui manque À TA DÉCISION. Une priorité n'est pas une
          donnée absente, c'est un choix que Pulse refuse de faire à ta place
          (`CLAUDE.md` §1). */}
      {etat.bloque && (
        <div className="rounded-lg border border-dashed border-line bg-black/[0.02] px-3.5 py-3 mt-2.5">
          <p className="text-[12.5px] text-muted leading-relaxed max-w-[68ch]">
            <span className="font-semibold text-ink">
              Désigne un thème prioritaire pour recevoir des conseils.
            </span>{" "}
            Étoile jusqu&apos;à trois thèmes sur{" "}
            <Link href="/labels" className="text-brand font-semibold hover:underline">
              ◫ Thèmes
            </Link>{" "}
            : Pulse travaille dedans, et seulement dedans. En attendant, tu gardes le point
            de vue de la semaine — tes chiffres, ta courbe et ce qui a bougé sur tes
            plateformes.
          </p>
        </div>
      )}

      {/* LE CONSEIL D'USAGE NE VIT QUE DANS LE MODULE VIDE, un seul à la fois,
          et il est éteint POUR TOUJOURS par le premier usage du geste — pas par
          une semaine qui passe, pas par un clic « j'ai vu ». C'est la seule
          condition d'extinction qui tienne : un conseil d'usage déclenché par le
          temps devient un décor en trois semaines. */}
      {etat.nudge && (
        <p className="text-[12.5px] text-muted leading-relaxed max-w-[68ch] py-1">
          {etat.nudge.texte}
          {etat.nudge.lien && (
            <>
              {" "}
              <Link
                href={etat.nudge.lien.href}
                className="text-brand font-semibold hover:underline"
              >
                {etat.nudge.lien.mot}
              </Link>
            </>
          )}
        </p>
      )}

      {/* CE QUE PULSE N'A PAS VU ENTRE SANS VERDICT. Aucun objet neuf : c'est une
          Note (`kind = "note"`), à qui il manquait seulement de pouvoir naître
          « en cours ». Elle se coche, elle marque la courbe, elle n'a ni
          indicateur ni baseline ni verdict — juger la note du client obligerait
          Pulse à choisir le chiffre à sa place, donc à inventer une intention.
          Conséquence assumée : le compteur peut monter parce que le client l'a
          fait monter lui-même, et ça, ce n'est pas un reproche. */}
      <TacheAjout themes={themes} />
    </div>
  );
}
