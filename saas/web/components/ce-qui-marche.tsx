import { getVision, constatsDeLaPage, type ConstatAffiche } from "@/lib/constats";
import { ConstatVerdict } from "@/components/constat-verdict";

// ── CE QUI MARCHE POUR TOI — LE RANG 4 DU GABARIT DE PLATEFORME ──────────────
//
// Le bloc qui CONCLUT une page : après les chiffres (rang 1), la courbe (2) et
// le thème (3), ce qu'on en retient. Il conclut sur le THÈME et pas sur
// l'annonce — Google Ads et Meta livrent déjà gratuitement leurs
// recommandations au niveau de l'annonce, dans l'écran où le clic s'applique ;
// ce qu'aucune régie ne peut dire, c'est quel thème marche mieux où
// (`.scratch/refonte/issues/07-gabarit-de-plateforme.md`, `02`).
//
// IL NE CALCULE RIEN. Les constats viennent de `saas/recos_ia/insights.py`, qui
// croise TOUT l'historique une fois par semaine. Jusqu'au ticket 09, cette même
// question se calculait aussi ici en TypeScript, sur la fenêtre affichée, avec
// d'autres seuils : `/instagram` pouvait donc désigner un format gagnant que le
// rapport ne désignait pas. Un seul moteur, une seule réponse.
//
// CE BLOC RÉPARE AUSSI UNE PROMESSE ÉCRITE. `/labels` dit au client « étoile les
// thèmes sur lesquels tu veux qu'on travaille — les constats… se concentrent
// dessus » alors que `vision.constats` n'était rendu par AUCUN composant :
// publié chaque semaine, lu nulle part. Troisième tuyau mort du produit, après
// `themes_tips` et `preuve` — ce dernier n'a pas été rebranché mais SUPPRIMÉ
// (ticket 12 de la construction) : il remesurait sur le compte entier ce que le
// rail mesure sur le thème, donc le brancher aurait mis deux verdicts à l'écran.
//
// POURQUOI UN COMPOSANT QUI LIT SES PROPRES DONNÉES : quatre pages l'affichent,
// et `getVision` est mémoïsée par requête (`cache`). Leur faire porter la
// lecture obligerait chacune à connaître la forme du payload — et c'est
// exactement ce qui a produit trois moteurs.

const SURFACE: Record<string, string> = {
  instagram: "Instagram",
  meta: "Meta",
  google: "Google",
  pub: "Publicité",
};

// L'angle mort de couverture ferme toujours la liste : il ne dit pas ce qui
// marche, il dit ce que l'analyse ne voit pas encore.
function ordre(a: ConstatAffiche, b: ConstatAffiche): number {
  const rang = (c: ConstatAffiche) => (c.kind === "angle_mort" ? 1 : 0);
  return rang(a) - rang(b);
}

function Constat({ c }: { c: ConstatAffiche }) {
  const rejete = c.verdict === "reject";
  return (
    <div className={`px-5 py-4 min-w-0 ${rejete ? "opacity-55" : ""}`}>
      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <p className="text-[13px] font-semibold text-ink leading-snug min-w-0">{c.title}</p>
        <span className="text-[10px] uppercase tracking-widest text-faint font-bold shrink-0">
          {c.platform ? SURFACE[c.platform] ?? c.platform : "Thème"}
        </span>
      </div>
      <p className="text-[12px] text-muted leading-relaxed">{c.detail}</p>
      {c.angle_mort && (
        // Ce que le chiffre NE compte pas se lit sous le chiffre, jamais
        // ailleurs : séparés, ils se lisent comme deux affirmations, et la
        // première passe pour complète (`CLAUDE.md` §7).
        <p className="text-[11px] text-faint leading-relaxed mt-1.5">{c.angle_mort}</p>
      )}
      <ConstatVerdict constatKey={c.key} verdict={c.verdict} />
    </div>
  );
}

export async function CeQuiMarche({
  page,
}: {
  page: "meta" | "google" | "instagram" | "themes";
}) {
  const { constats, periodLabel, rapportPublie } = await getVision();
  const miens = constatsDeLaPage(constats, page).slice().sort(ordre);

  // Aucun rapport publié : il n'y a rien à dire de vrai. Sur les pages de
  // plateforme on se tait — le rapport hebdomadaire est déjà l'endroit qui
  // explique qu'il n'a pas encore tourné. Sur la page Thèmes, c'est là que la
  // promesse est écrite : elle doit dire ce qu'elle attend.
  if (!rapportPublie && page !== "themes") return null;

  return (
    <div className="mb-8">
      {/* CE BLOC NE SUIT PAS LES COMMANDES DE LA PAGE, ET IL LE DIT. La période
          et le thème du bandeau filtrent les chiffres de la page ; les constats,
          eux, sont calculés une fois par semaine sur tout l'historique. Un bloc
          qui ne bouge pas quand on change la période se lit comme un filtre
          cassé tant qu'on n'a pas écrit qu'il n'en dépend pas. */}
      <h2 className="text-[14px] font-semibold text-ink mb-1.5">
        Ce qui marche pour toi{" "}
        <span className="text-faint font-normal">
          {periodLabel ? `· ${periodLabel}` : "· sur tout ton historique"}
        </span>
      </h2>
      <p className="text-[11px] text-faint mb-3 leading-relaxed">
        Calculé une fois par semaine sur tout ton historique — ce bloc ne suit ni la
        période ni le thème choisis en haut de page. Un constat qui porte sur une
        fenêtre plus courte le dit dans son texte.
      </p>
      {miens.length === 0 ? (
        <div className="bg-white border border-line rounded-xl shadow-card px-5 py-4">
          <p className="text-[12.5px] text-muted leading-relaxed">
            {!rapportPublie
              ? "Rien à conclure tant qu'aucun rapport n'a été publié — les constats sont calculés en même temps que lui."
              : "Pas encore de constat ici : il faut assez de recul pour qu'un écart veuille dire quelque chose (5 publications sur un format, 50 CHF sur une campagne). Pulse préfère se taire plutôt que conclure sur trois lignes."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-xl shadow-card divide-y divide-line">
          {miens.map((c) => (
            <Constat key={c.key} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
