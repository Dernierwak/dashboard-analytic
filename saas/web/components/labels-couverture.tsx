import { fmtCHF, type Couverture } from "@/components/labels-modele";

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
//   6 UNE barre, ses deux bornes écrites · 7 la répartition · 9 le pied.
// Rang 5 absent : il n'y a pas de « couverture de la semaine dernière » à
// comparer — le rapport ne l'a jamais archivée, et un delta inventé vaut moins
// que pas de delta.
export function LabelsCouverture({ c }: { c: Couverture }) {
  const partHorsTheme =
    c.depenseTotale > 0 ? (c.depenseSansTheme / c.depenseTotale) * 100 : 0;
  const partCouverte = Math.max(0, Math.min(100, 100 - partHorsTheme));

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

      {/* Rang 6 — UNE forme, et ses deux bornes écrites. La barre montre la
          part RATTACHÉE : c'est elle qu'on veut voir grandir. Elle ne s'affiche
          pas quand il n'y a pas de dépense — une barre à 0 % sur un
          dénominateur nul est du décor. */}
      {c.mesurable && (
        <div className="mt-4">
          <div className="h-2.5 rounded-full bg-black/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${partCouverte.toFixed(1)}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between gap-3 mt-1.5">
            <span className="text-[11px] font-semibold text-brand">
              {Math.round(partCouverte)} % rattaché à un thème
            </span>
            <span className="text-[11px] text-faint font-mono">
              sur {fmtCHF(c.depenseTotale)} CHF
            </span>
          </div>
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
