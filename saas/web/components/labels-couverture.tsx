import { fmtCHF, type Couverture } from "@/components/labels-modele";
import { ThemeDonut } from "@/components/theme-donut";
import { NEUTRE, type Teinte } from "@/lib/palette";

// La couleur de « Sans thème » est FORCÉE, pas puisée dans `teinteLabel` : ce
// n'est pas un thème, c'est ce qui n'en a AUCUN — même raisonnement que
// `TEINTE_CANAL` dans `app/couts/page.tsx`. Le gris est `NEUTRE`, la même
// teinte que l'« autres » de tous les anneaux de l'app.
const TEINTE_SANS_THEME: Record<string, Teinte> = {
  "Sans thème": NEUTRE,
};

// LA COUVERTURE — le cœur pédagogique de la page Thèmes.
//
// LE CAMEMBERT DIT LA VRAIE QUESTION, PAS UN VERDICT BINAIRE.
// La première version opposait deux ÉTATS — « rattaché » / « non rattaché » —
// et il fallait deux paragraphes au-dessus pour l'expliquer, au point de
// devenir illisible (« 0 CHF... tout est rattaché » ne se comprend pas d'un
// coup d'œil). La vraie question qu'on se pose sur cette page n'est pas
// « est-ce que c'est rattaché » mais « où va mon argent, thème par thème » —
// et la réponse est directement le camembert : une part par thème, avec son
// nombre d'éléments et son montant.
//
// LE CAMEMBERT SE DIMENSIONNE PAR LE NOMBRE, PAS PAR LA DÉPENSE.
// « On s'en fiche de la dépense » : un thème purement organique (Instagram
// seul, 0 CHF) doit apparaître comme n'importe quel autre, avec le poids que
// lui donne son nombre d'éléments — un camembert dimensionné par le montant le
// ferait disparaître par construction (une part à 0 CHF a une surface nulle).
// `ThemeDonut` gagne donc `parNombre` : la taille des parts, le tri et le
// seuil « visible ou pas » suivent `count`. Le montant CHF reste affiché en
// info complémentaire (légende + info-bulle), via `montants`, comme avant.
//
// « SANS THÈME » RESTE UNE PART DU MÊME CAMEMBERT, PAS UN TEXTE À PART.
// C'est l'objet même du module : ce qui n'a aucun thème ne doit pas
// disparaître silencieusement sous prétexte que ce n'en est pas un vrai, ni se
// fondre dans le paquet générique « autres » si elle tombe hors du top 5 (un
// compte à quinze thèmes, par exemple). `ThemeDonut` gagne `epingles` pour
// cette raison précise : un label qui reste sa propre part, quel que soit son
// rang.
//
// INSTAGRAM N'A PAS DE DÉPENSE, ET ON NE FAIT PAS SEMBLANT.
// Une publication organique ne coûte rien. Elle compte dans le NOMBRE
// d'éléments de son thème (ou de « Sans thème »), jamais dans le montant —
// l'additionner au montant serait ajouter zéro en prétendant mesurer.
//
// TROIS PORTÉES TEMPORELLES, ET LE PIED LES DIT TOUTES.
// Le montant CHF de chaque part du camembert couvre la fenêtre de 90 jours ;
// le nombre d'éléments, lui, porte tout l'historique — la même convention que
// `sansTheme.length` (voir `lib/couverture.ts`). Le détail par canal (rang 7,
// juste en dessous) porte lui aussi la fenêtre de 90 jours, CHF comme nombre
// de publications Instagram (`postsSansTheme`, filtré par `dansFenetre` dans
// `lib/couverture.ts`) — un pied qui ne dirait que la règle du camembert
// laisserait croire, par contamination, que ce nombre de publications porte
// lui aussi tout l'historique. Un pied qui prétendrait que tout tient dans 90
// jours (ou l'inverse) mentirait sur la moitié de ce qu'il couvre.
//
// LE CAS OÙ IL N'Y A RIEN À MONTRER.
// Un compte tout neuf, sans la moindre campagne ni publication relevée
// (`c.total === 0`), n'a rien à répartir — pas de camembert, une phrase.
// Ce n'est plus un problème de dépense nulle (le camembert s'en moque
// désormais), seulement d'univers vide.
//
// LES RANGS (docs/03-grammaire-des-modules.md) :
//   1 surtitre · 6 UN anneau (`ThemeDonut`, même composant que `/conversions`
//   et `/couts` — voir docs/04-modules-partages-entre-sources.md), une part
//   par thème + « Sans thème », nombre d'éléments et montant · 7 la
//   répartition de ce qui échappe, par canal · 9 le pied.
// Pas de rang 3/4 séparé : le camembert PORTE son chiffre — le total et le
// nombre de thèmes, au centre de l'anneau (rang 6) — il n'y a plus de verdict
// binaire à résumer en mots au-dessus de lui.
export function LabelsCouverture({ c, labels }: { c: Couverture; labels: string[] }) {
  return (
    <section className="bg-white border border-line rounded-2xl shadow-card px-4 sm:px-5 py-4 mb-5">
      {/* Rang 1 — surtitre : c'est une tuile qu'on scanne, pas un texte qu'on lit. */}
      <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-2">
        Ce qui échappe à tes thèmes
      </div>

      {c.total > 0 ? (
        <>
          <p className="text-[12.5px] text-ink leading-relaxed">
            Tes éléments (campagnes + publications), répartis par thème — nombre et
            dépense pour chacun.{" "}
            <span className="font-semibold">« Sans thème » est sa propre part</span> :
            ce qui n&apos;en porte aucun n&apos;entre dans aucun bilan, ne reçoit aucun
            conseil et ne compte dans aucun budget par thème.
          </p>

          {/* Rang 6 — UNE forme, ses parts écrites : une par thème, plus
              « Sans thème », toujours sa propre part (`epingles`). Même
              anneau que `/conversions` et `/couts` — `ThemeDonut`, en mode
              `carte={false}` pour se fondre dans cette carte au lieu d'en
              ouvrir une seconde, et `parNombre` pour que la taille des parts
              suive le nombre d'éléments, pas la dépense. */}
          <div className="mt-4">
            <ThemeDonut
              rows={[
                ...c.parTheme.map((t) => ({ label: t.label, spend: t.depense, count: t.nb })),
                { label: "Sans thème", spend: c.depenseSansTheme, count: c.sansTheme },
              ]}
              teintes={TEINTE_SANS_THEME}
              univers={labels}
              unite="thème"
              uniteValeur="éléments"
              montants
              carte={false}
              parNombre
              epingles={["Sans thème"]}
            />
          </div>
        </>
      ) : (
        <p className="text-[12.5px] text-muted leading-relaxed">
          Aucune campagne ni publication relevée pour l&apos;instant — rien à répartir
          par thème.
        </p>
      )}

      {/* Rang 7 — le détail : où est le trou de la part « Sans thème », et le
          canal qui n'a pas de montant. Un seul fond, trois chiffres à 19 px
          contre 34 px en tête : on lit un titre et sa suite, pas trois titres
          qui se disputent. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 rounded-xl bg-black/[0.02] px-3 py-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1 truncate">
            <span style={{ color: "#1a56ff" }}>▣</span> Meta
          </div>
          <div className="font-mono text-[19px] leading-none text-ink">
            {fmtCHF(c.metaSansTheme)}
            <span className="text-[11px] text-faint"> CHF</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1 truncate">
            <span style={{ color: "#1a7a4a" }}>◆</span> Google
          </div>
          <div className="font-mono text-[19px] leading-none text-ink">
            {fmtCHF(c.googleSansTheme)}
            <span className="text-[11px] text-faint"> CHF</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1 truncate">
            <span style={{ color: "#7b4fff" }}>◎</span> Instagram
          </div>
          <div className="font-mono text-[19px] leading-none text-ink">
            {c.postsSansTheme}
            <span className="text-[11px] text-faint"> publi.</span>
          </div>
        </div>
      </div>

      {/* Rang 9 — le pied : TROIS portées à distinguer, chacune à l'endroit
          où elle s'applique. (1) Le nombre d'éléments du camembert porte tout
          l'historique. (2) Le montant CHF affiché à côté, dans le camembert,
          ne couvre que la fenêtre de 90 jours. (3) Le détail par canal juste
          au-dessus (rang 7) — CHF Meta/Google ET nombre de publications
          Instagram — porte lui aussi cette même fenêtre de 90 jours, pas
          l'historique complet : sans le dire, un lecteur applique la règle du
          camembert (« historique complet ») au nombre de publications d'à
          côté, qui lui est scopé 90 jours — même défaut que le camembert au
          premier passage, juste déplacé d'un rang plus bas. */}
      <p className="text-[10.5px] text-faint/90 mt-3 leading-relaxed">
        Dans le camembert, le nombre d&apos;éléments par part porte tout ton
        historique ; son montant CHF ne couvre que {c.fenetreLongue}, aujourd&apos;hui
        exclu — comme le détail par canal juste au-dessus (Meta, Google, et le nombre
        de publications Instagram). Une publication Instagram ne coûte rien : elle se
        compte, elle ne s&apos;ajoute jamais au montant.
      </p>
    </section>
  );
}
