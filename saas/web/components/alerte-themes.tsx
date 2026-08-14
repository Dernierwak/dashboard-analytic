import Link from "next/link";
import { fmtCHF, type Couverture } from "@/components/labels-modele";

// « IL TE MANQUE DES THÈMES » — la version courte, sur le rapport du lundi.
//
// CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS.
// Il alerte et il renvoie. Il n'étiquette rien sur place, et c'est la seule
// raison pour laquelle il a le droit d'exister à côté de `labels-couverture` :
// deux modules qui montrent le même nombre sont un doublon dès que le second
// permet aussi d'AGIR dessus. Ici le geste vit à un seul endroit, la page
// Thèmes, et ce module en est le panneau indicateur.
//
// LE CHIFFRE EST LE MÊME, AU FRANC PRÈS, ET C'EST LE POINT.
// Il vient de `getCouverture()` (`lib/couverture.ts`), la fonction que la page
// Thèmes utilise pour son propre module. On ne recalcule pas « à peu près la
// même chose » sur une fenêtre voisine : deux montants proches mais inégaux
// entre deux écrans du même produit ne se lisent pas comme deux mesures, ils se
// lisent comme une erreur — et on ne sait pas laquelle croire.
//
// IL DISPARAÎT QUAND IL N'A PLUS RIEN À DIRE.
// La règle est celle de la fenêtre qu'il annonce : rien qui échappe sur les 90
// derniers jours pleins → pas de module. Pas de « tout est rattaché ✓ » chaque
// lundi. Un bloc qui dit que tout va bien toutes les semaines s'apprend par
// cœur en trois semaines, et le jour où il dit autre chose, on ne le lit plus.
// C'est aussi ce qui en fait une tâche qui se VIDE : on étiquette, il s'en va.
//
// POURQUOI PAS DE FORME (rang 6). La page Thèmes porte la barre « X % rattaché
// à un thème » parce qu'on y vient pour suivre un chantier. Ici on vient
// apprendre un fait en deux secondes : le verdict en mots (rang 4) dit déjà la
// part, et la grammaire n'autorise qu'une forme par module — autant n'en mettre
// aucune plutôt qu'une barre qui allongerait un module dont la vertu est
// d'être court. Même arbitrage que `EnveloppeAnnee`.
//
// LE LIEN EST EN BAS (rang 8) et c'est un choix à assumer : la grammaire range
// le lien qui QUITTE le module au rang 2, à droite du titre. Celui-ci ne quitte
// pas le module, il le RÉPARE — c'est le seul geste que le module propose, et
// un geste se pose sous le chiffre qui le motive, jamais au-dessus. Si la
// grammaire doit trancher un jour, c'est cette distinction-là qu'elle aura à
// écrire : sortir vers un ailleurs, ou aller corriger la cause.
export function AlerteThemes({ c }: { c: Couverture }) {
  // La fenêtre annoncée est la seule juge. Un vieux reliquat non étiqueté qui
  // n'a rien dépensé depuis trois mois appartient à la page Thèmes, pas au
  // rapport de cette semaine — sinon le module ne s'éteint jamais.
  const rienNEchappe = c.depenseSansTheme <= 0 && c.postsSansTheme === 0;
  if (rienNEchappe) return null;

  // Le montant PARLE, ou il se tait. Écrire « 0 CHF » là où l'argent est
  // intégralement rattaché ferait passer une bonne nouvelle pour une alerte, et
  // écrire « 0 CHF » là où rien n'a été relevé serait un chiffre faux.
  const montantParle = c.mesurable && c.depenseSansTheme > 0;
  const part =
    c.depenseTotale > 0 ? (c.depenseSansTheme / c.depenseTotale) * 100 : 0;

  // Coloré par le SENS : plus il en échappe, plus c'est grave. Seuils grossiers
  // volontairement — c'est une alerte, pas une note. Ce sont ceux de
  // `labels-couverture`, et ils ne se dédoublent pas d'un module à l'autre.
  const verdict = !montantParle
    ? { texte: "aucune dépense n'échappe", couleur: "#5a5d66" }
    : part >= 20
      ? { texte: `${Math.round(part)} % de ta dépense`, couleur: "#c0392b" }
      : part >= 5
        ? { texte: `${Math.round(part)} % de ta dépense`, couleur: "#b86b00" }
        : { texte: `${Math.round(part)} % de ta dépense`, couleur: "#1a7a4a" };

  return (
    <section className="bg-white border border-line rounded-2xl shadow-card px-4 sm:px-5 py-4 mb-5">
      {/* Rang 1 — surtitre : une tuile qu'on scanne en passant, pas un texte
          qu'on lit. Le titre de lecture est réservé aux sections. */}
      <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-2">
        Il te manque des thèmes
      </div>

      {/* Rang 3 — LE chiffre, et rien de graphique au-dessus de lui. */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {montantParle ? fmtCHF(c.depenseSansTheme) : c.postsSansTheme}
          {montantParle && <span className="text-[15px] text-faint"> CHF</span>}
        </span>
        {/* Rang 4 — le verdict, en mots, recette maison couleur / couleur + 14. */}
        <span
          className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
          style={{ color: verdict.couleur, background: `${verdict.couleur}14` }}
        >
          {verdict.texte}
        </span>
      </div>

      <p className="text-[12.5px] text-muted mt-2 leading-snug">
        {montantParle ? (
          <>
            de dépense n&apos;entrent dans aucun de tes thèmes ·{" "}
            <span className="text-faint">{c.fenetreCourte}</span>
          </>
        ) : (
          <>
            {c.postsSansTheme > 1 ? "publications n'ont" : "publication n'a"} aucun thème ·{" "}
            <span className="text-faint">{c.fenetreCourte}</span>
          </>
        )}
      </p>

      {/* Ce que ça CHANGE — la phrase appartient au chiffre, pas au pied : sans
          elle, « 4 200 CHF » est un fait sans conséquence, et un fait sans
          conséquence ne fait rien faire un lundi matin. Elle dit exactement ce
          que les cartes de thèmes ci-dessous ne montrent pas. */}
      <p className="text-[12.5px] text-ink mt-2.5 leading-relaxed max-w-[70ch]">
        Les bilans par thème plus bas ne comptent pas cet argent, et aucun conseil ne
        porte dessus — <span className="font-semibold">ce qui n&apos;a pas de thème
        n&apos;est analysé nulle part</span>.
      </p>

      {/* Rang 7 — le détail, sur UNE ligne : par où commencer. Les canaux à
          zéro ne s'écrivent pas ; un « 0 CHF » ajouté pour la symétrie serait
          trois fois plus long à lire pour la même information. */}
      <p className="text-[11.5px] text-muted mt-2 leading-relaxed">
        {[
          c.metaSansTheme > 0 ? (
            <span key="m">
              <span style={{ color: "#1a56ff" }}>▣</span> Meta{" "}
              <span className="font-mono text-ink">{fmtCHF(c.metaSansTheme)}</span> CHF
            </span>
          ) : null,
          c.googleSansTheme > 0 ? (
            <span key="g">
              <span style={{ color: "#1a7a4a" }}>◆</span> Google{" "}
              <span className="font-mono text-ink">{fmtCHF(c.googleSansTheme)}</span> CHF
            </span>
          ) : null,
          c.postsSansTheme > 0 ? (
            <span key="i">
              <span style={{ color: "#7b4fff" }}>◎</span> Instagram{" "}
              <span className="font-mono text-ink">{c.postsSansTheme}</span> publi.
            </span>
          ) : null,
        ]
          .filter(Boolean)
          .map((el, i) => (
            <span key={i}>
              {i > 0 && <span className="text-faint"> · </span>}
              {el}
            </span>
          ))}
      </p>

      {/* Rang 8 — le seul geste, et il est ailleurs. Il ne s'agit pas de
          quitter le module pour voir plus grand : il s'agit d'aller supprimer
          la cause de son chiffre. D'où sa place sous le chiffre, et pas à
          côté du titre. */}
      <div className="mt-3.5">
        <Link
          href="/labels"
          className="inline-block text-[12.5px] font-semibold text-brand border border-brand/25 rounded-full px-3.5 py-1.5 hover:bg-brand/[0.06] transition-colors"
        >
          ◫ Étiqueter sur la page Thèmes →
        </Link>
        {/* La précision reste HORS de la pastille. Dedans, sur un téléphone de
            375 px, elle la faisait passer à deux lignes et la coupait en deux
            colonnes : une cible de clic qui a l'air de deux boutons. Elle
            n'appartient pas au pied pour autant — le rang 9 dit ce qui rend le
            module honnête, pas ce que coûte son geste. */}
        <p className="text-[11.5px] text-muted mt-1.5 leading-snug">
          L&apos;IA peut poser un thème sur tout ce qui n&apos;en a pas, d&apos;un clic.
        </p>
      </div>

      {/* Rang 9 — le pied, un seul : les deux conventions sans lesquelles le
          chiffre se lit de travers. La seconde ne s'écrit que si Instagram
          pèse dans ce qu'on vient de montrer. */}
      <p className="text-[10.5px] text-faint/90 mt-3 leading-relaxed">
        Fenêtre : {c.fenetreLongue}, aujourd&apos;hui exclu.
        {c.postsSansTheme > 0 && (
          <>
            {" "}
            Une publication Instagram ne coûte rien : elle se compte, elle ne s&apos;ajoute
            pas au montant.
          </>
        )}
      </p>
    </section>
  );
}
