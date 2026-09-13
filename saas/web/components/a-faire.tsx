import Link from "next/link";
import type { AFaire as Liste, EtatAFaire } from "@/lib/a-faire";
import { ancreTheme } from "@/lib/liens";
import { ListeAFaire, type ConseilRendu, type VerdictRendu } from "@/components/a-faire-lignes";

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
// CE FICHIER NE PORTE AUCUN ÉTAT : il compose ce que la page a lu, calcule les
// ancres (les seuls liens du module) et laisse la liste — un composant client —
// se vider sous le doigt.

/** L'ancre de la carte d'un thème, quand ce thème en a une sur cette page. */
function ancreDuTheme(theme: string | null, themesRendus: Set<string>): string | null {
  return theme && themesRendus.has(theme) ? `#${ancreTheme(theme)}` : null;
}

/** Ce que la ligne d'un conseil vise quand on clique son titre : la carte du
 *  thème, où il est EXPLIQUÉ. Un réglage de base n'a pas de carte — il a son
 *  propre bloc en bas de page. Ni l'un ni l'autre (thème renommé, ou sorti des
 *  étoiles depuis la publication) : on renvoie à la section des thèmes plutôt
 *  qu'à une ancre qui n'existe pas. */
function ancreDuConseil(
  c: { theme: string | null; reglage: boolean },
  themesRendus: Set<string>
): string {
  if (c.reglage) return "#reglages";
  return ancreDuTheme(c.theme, themesRendus) ?? "#conseils";
}

export function AFaire({
  liste,
  etat,
  themesRendus,
}: {
  liste: Liste;
  etat: EtatAFaire;
  /** Les thèmes qui ont réellement une carte sur cette page — c'est ce qui
   *  décide si le titre d'une ligne peut renvoyer quelque part. */
  themesRendus: Set<string>;
}) {
  const verdicts: VerdictRendu[] = liste.verdicts.map((a) => ({
    a,
    ancre: ancreDuTheme(a.theme, themesRendus),
  }));
  const conseils: ConseilRendu[] = liste.conseils.map((c) => ({
    c,
    ancre: ancreDuConseil(c, themesRendus),
  }));

  return (
    <div className="bg-white border border-line rounded-xl shadow-card px-4 py-3.5">
      <ListeAFaire verdicts={verdicts} notes={liste.notes} conseils={conseils} />

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
          et il est éteint par le premier usage du geste — pas par une semaine
          qui passe, pas par un clic « j'ai vu ». Sa condition et sa limite
          connue sont écrites sur `nudge` (`lib/a-faire.ts`). */}
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
    </div>
  );
}
