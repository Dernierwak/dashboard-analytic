import { fmtCHF, type Couverture } from "@/components/labels-modele";
import { ThemeDonut } from "@/components/theme-donut";
import { NEUTRE, type Teinte } from "@/lib/palette";

// La couleur du rang 6 est FORCÉE, pas puisée dans `teinteLabel` : ce ne sont
// pas deux thèmes qui se partagent l'anneau, mais deux ÉTATS (rattaché / pas)
// — même raisonnement que `TEINTE_CANAL` dans `app/couts/page.tsx`. Le vert
// reprend celui du verdict « tout est rattaché » (rang 4, ci-dessous) ; le
// gris est `NEUTRE`, la même teinte que l'« autres » de tous les anneaux de
// l'app pour « pas rattaché à un thème ».
const TEINTE_COUVERTURE: Record<string, Teinte> = {
  "Rattaché à un thème": { nom: "vert", trait: "#1a7a4a", aplat: "rgba(26, 122, 74, 0.14)" },
  "Non rattaché": NEUTRE,
};

// LA COUVERTURE — le cœur pédagogique de la page Thèmes.
//
// LE CHIFFRE, ET POURQUOI CE CHIFFRE-LÀ.
// Le réflexe était « 12 campagnes sans thème ». Ça ne fait rien faire à
// personne : douze campagnes, c'est peut-être douze essais à 4 CHF arrêtés en
// mars. Ce qu'on perd quand une campagne n'a pas de thème, ce n'est pas une
// ligne dans un tableau, c'est de l'ARGENT sorti du compte qu'aucun bilan ne
// sait rattacher à quoi que ce soit. « 18 400 CHF ne sont rattachés à aucun
// thème » se comprend sans explication et fait ouvrir la liste ; « 12 » se lit
// et s'oublie.
//
// Le compte de lignes ne disparaît pas — il descend au rang 7, où il est à sa
// place : la répartition de ce montant, et le canal qui n'a pas de montant.
//
// INSTAGRAM N'A PAS DE DÉPENSE, ET ON NE FAIT PAS SEMBLANT.
// Une publication organique ne coûte rien. L'additionner au montant serait
// ajouter zéro et prétendre avoir mesuré ; l'oublier laisserait croire que
// l'Instagram est couvert. Elle se COMPTE, dans le bilan, sous son propre mot
// — et le pied dit l'asymétrie au lieu de la laisser se deviner.
//
// LE CAS OÙ LE MONTANT N'EXISTE PAS.
// Un compte qui n'a encore aucune dépense relevée (Instagram seul, ou récolte
// jamais lancée) verrait « 0 CHF ne sont rattachés à aucun thème », ce qui est
// à la fois vrai et parfaitement trompeur — un zéro non mesuré présenté comme
// mesuré. Le module bascule alors son rang 3 sur le comptage, et écrit
// pourquoi. C'est le même arbitrage que la page Coûts entre « au prochain
// relevé » et « rien de réglé en ce moment » : deux vides, deux mots.
//
// LES NEUF RANGS (docs/03-grammaire-des-modules.md) :
//   1 surtitre · 3 le montant hors thème · 4 la part, en verdict ·
//   6 UN anneau (`ThemeDonut`, même composant que `/conversions` et
//   `/couts` — voir docs/04-modules-partages-entre-sources.md), ses deux
//   parts nommées et coloriées, le total au centre · 7 la répartition ·
//   9 le pied.
// Rang 5 absent : il n'y a pas de « couverture de la semaine dernière » à
// comparer — le rapport ne l'a jamais archivée, et un delta inventé vaut moins
// que pas de delta.
export function LabelsCouverture({ c }: { c: Couverture }) {
  const partHorsTheme =
    c.depenseTotale > 0 ? (c.depenseSansTheme / c.depenseTotale) * 100 : 0;

  // Le verdict est coloré par le SENS : ici, plus il en échappe, plus c'est
  // grave. Les seuils sont grossiers volontairement — c'est une alerte, pas
  // une note.
  const verdict: { texte: string; couleur: string } =
    !c.mesurable
      ? { texte: "aucune dépense relevée", couleur: "#5a5d66" }
      : c.depenseSansTheme <= 0
      ? { texte: "tout est rattaché", couleur: "#1a7a4a" }
      : partHorsTheme >= 20
      ? { texte: `${Math.round(partHorsTheme)} % de ta dépense`, couleur: "#c0392b" }
      : partHorsTheme >= 5
      ? { texte: `${Math.round(partHorsTheme)} % de ta dépense`, couleur: "#b86b00" }
      : { texte: `${Math.round(partHorsTheme)} % de ta dépense`, couleur: "#1a7a4a" };

  return (
    <section className="bg-white border border-line rounded-2xl shadow-card px-4 sm:px-5 py-4 mb-5">
      {/* Rang 1 — surtitre : c'est une tuile qu'on scanne, pas un texte qu'on lit. */}
      <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-2">
        Ce qui échappe à tes thèmes
      </div>

      {/* Rang 3 — LE chiffre. Aucune forme au-dessus de lui. */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {c.mesurable ? fmtCHF(c.depenseSansTheme) : c.sansTheme}
          {c.mesurable && <span className="text-[15px] text-faint"> CHF</span>}
        </span>
        {/* Rang 4 — le verdict, en mots, recette maison couleur / couleur+14. */}
        <span
          className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
          style={{ color: verdict.couleur, background: `${verdict.couleur}14` }}
        >
          {verdict.texte}
        </span>
      </div>

      <p className="text-[12px] text-muted mt-2 leading-snug">
        {c.mesurable ? (
          <>
            de dépense au total ne sont rattachés à aucun thème ·{" "}
            <span className="text-faint">{c.fenetreCourte}</span>
          </>
        ) : (
          <>
            contenus n&apos;ont aucun thème, sur tout ton historique. Aucune dépense
            n&apos;a été relevée sur {c.fenetreCourte} — alors on les compte, faute de
            pouvoir les chiffrer.
          </>
        )}
      </p>

      {/* LA PHRASE QUI FAIT COMPRENDRE — elle appartient au chiffre, pas au
          pied. Le rang 9 est réservé à ce qui rend le module honnête (une
          limite de mesure) ; ceci explique l'ENJEU, ce n'est pas la même
          chose, et ça se lit avant la forme ou ça ne se lit pas. */}
      <p className="text-[12.5px] text-ink mt-2.5 leading-relaxed">
        Un thème regroupe une campagne Meta, une campagne Google et une publication sous
        le même sujet. Ce qui n&apos;en porte pas{" "}
        <span className="font-semibold">
          n&apos;entre dans aucun bilan par thème, ne reçoit aucun conseil et ne compte
          dans aucun budget par thème
        </span>{" "}
        — la dépense sort du compte, l&apos;analyse ne la voit jamais.
      </p>

      {/* Rang 6 — UNE forme, ses deux parts écrites. Même anneau que
          `/conversions` (le camembert des catégories de conversions) et
          `/couts` — `ThemeDonut`, en mode `carte={false}` pour se fondre
          dans cette carte au lieu d'en ouvrir une seconde. Les deux parts
          sont RATTACHÉ (vert, l'état qu'on veut voir grandir) et NON
          RATTACHÉ (gris `NEUTRE`, même convention que l'« autres » des
          anneaux par thème) — même sens que l'ancienne barre. Il ne s'affiche
          pas quand il n'y a pas de dépense — un anneau sur un dénominateur
          nul est du décor. */}
      {c.mesurable && (
        <div className="mt-4">
          <ThemeDonut
            rows={[
              { label: "Rattaché à un thème", spend: Math.max(0, c.depenseTotale - c.depenseSansTheme) },
              { label: "Non rattaché", spend: c.depenseSansTheme },
            ]}
            teintes={TEINTE_COUVERTURE}
            unite="part"
            uniteValeur="CHF"
            montants
            carte={false}
          />
        </div>
      )}

      {/* Rang 7 — le détail : où est le trou, et le canal qui n'a pas de
          montant. Un seul fond, trois chiffres à 19 px contre 34 px en tête :
          on lit un titre et sa suite, pas trois titres qui se disputent. */}
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

      {/* Rang 9 — le pied, un seul, deux lignes : les deux conventions sans
          lesquelles les chiffres ci-dessus se lisent de travers. */}
      <p className="text-[10.5px] text-faint/90 mt-3 leading-relaxed">
        Tout ce module couvre {c.fenetreLongue}, aujourd&apos;hui exclu — publications
        comprises. Les publications Instagram ne coûtent rien : elles se comptent, elles
        ne s&apos;ajoutent pas au montant. Les listes ci-dessous, elles, portent tout ton
        historique.
      </p>
    </section>
  );
}
