"use client";

import { useState } from "react";
import { LineChart } from "@/components/line-chart";
import { marqueursCourbe, SOURCE } from "@/components/etat-action";
import { Pente, Triangle, sensPente } from "@/components/pente";
import type { KpiFocus, KpiOption } from "@/lib/report";

// « Ta boussole » — le module de l'indicateur qui compte.
//
// Un chiffre seul ne décide rien. Ce module donne les trois choses qui le
// rendent actionnable en trois secondes :
//   1. sa VALEUR, en grand, avec ce qu'elle mesure et d'où elle vient
//   2. sa ZONE — « tu perds / fragile / sain / scalable », ET SON SEUIL :
//      « excellent » ne veut rien dire tant qu'on ne sait pas où ça commence
//   3. sa TRAJECTOIRE sur 10 semaines — un niveau ne vaut rien sans sa pente
//
// LA JAUGE A DISPARU, et c'est la vraie nouvelle. Le module portait DEUX formes
// graphiques — une jauge de zones, puis une courbe — là où la grammaire n'en
// autorise qu'une (docs/03-grammaire-des-modules.md, rang 6). Les zones passent
// donc EN FOND DE COURBE : la jauge disait « où tu es maintenant », le fond dit
// « où tu es ET depuis quand ». On voit le trait passer de moyen à bon entre
// deux semaines, ce qu'aucune jauge ne pouvait montrer. Rien n'est perdu : les
// noms de zones sont à droite du tracé, et le seuil courant est remonté dans la
// pastille.
//
// Six indicateurs sur neuf n'ont AUCUNE zone (cpc, reach, spend, trafic, vues,
// clics) et on ne leur en invente pas pour faire joli : un coût par clic de
// 0,42 CHF est excellent dans un métier et ruineux dans un autre. Pour eux la
// courbe se rend nue, et la pastille de verdict n'apparaît pas — un verdict non
// calculé tombe sous la même règle qu'un chiffre non mesuré.
//
// Et il est PILOTABLE : l'indicateur ouvert par défaut est celui de ton
// objectif, mais tu bascules sur n'importe quel autre d'un doigt — on ne sait
// jamais mieux que toi ce que tu as envie de regarder ce jour-là.

// LE REGROUPEMENT EST PAR RÉGIE, et il a mis trois passes à le devenir.
//
// D'abord par TERRAIN (« Ta pub » / « Ton Instagram » / « Ton site »), au motif
// que quatre indicateurs additionnaient Meta ET Google : coller une pastille
// « Google Ads » sur un CTR mélangé aurait fait couper Google à qui croyait
// lire Google. L'argument était juste, et la conclusion était fausse — la bonne
// réponse n'était pas de renoncer à séparer, c'était de ne plus additionner.
//
// Un CTR global de 9,8 % peut être 2 % chez l'un et 15 % chez l'autre. La
// moyenne cache précisément ce qu'on vient chercher : LAQUELLE des deux régies
// il faut aller regarder. Le worker calcule donc quatre indicateurs par régie
// (`ctr:meta`, `cpc:google`…), et ce module les range sous leur plateforme.
//
// Le ROAS fait exception, et c'est écrit à l'écran plutôt que caché : son revenu
// vient de Google Analytics, qui ne dit pas quelle régie l'a produit.
//
// LA CLÉ PORTE SA RÉGIE : `ctr:meta`, `cpc:google`. Une clé nue reste possible
// et le restera — c'est la forme de tous les rapports publiés avant le 12 août
// 2026, et un rapport ancien doit continuer de s'afficher entièrement.
//
// Mais s'afficher ne suffit pas : IL DOIT DIRE CE QU'IL EST. Une clé nue
// retombait dans « Tes deux régies » sous la phrase du ROAS — « le revenu vient
// de Google Analytics, qui ne dit pas quelle régie l'a produit » — qui n'est
// vraie que du ROAS, et qui laisse croire que la séparation n'existe pas.
// Un ancien rapport ne ment plus sur sa provenance : il se date, et il nomme
// le bouton qui le remplace.
//
// ET C'EST UN GROUPE À PART, pas un drapeau posé sur « Tes deux régies ».
// La première correction basculait l'en-tête du groupe entier dès qu'UNE de ses
// cellules portait une clé nue : sur un vieux rapport qui contient aussi le
// ROAS, le ROAS se retrouvait sous « Meta et Google confondus · ↻ Recharger mes
// conseils les sépare » — une promesse fausse, puisque aucun rechargement ne
// séparera jamais un revenu que Google Analytics donne pour tout le compte.
// Deux populations qui n'ont pas la même cause ne partagent pas un en-tête :
// le ROAS est confondu PAR NATURE, une clé nue l'est PAR ANCIENNETÉ. Elles se
// rangent donc dans deux groupes, et chacun n'écrit que sa propre raison.
const BASE: Record<string, { court: string; famille: "pub" | "instagram" | "site" }> = {
  roas: { court: "ROAS", famille: "pub" },
  ctr: { court: "CTR", famille: "pub" },
  cpc: { court: "Coût / clic", famille: "pub" },
  spend: { court: "Dépense", famille: "pub" },
  clics: { court: "Clics", famille: "pub" },
  eng: { court: "Engagement", famille: "instagram" },
  reach: { court: "Portée / post", famille: "instagram" },
  vues: { court: "Vues", famille: "instagram" },
  trafic: { court: "Sessions", famille: "site" },
};

/** `ctr:meta` → `["ctr", "meta"]` ; `roas` → `["roas", null]`. */
function decoupe(cle: string): [string, string | null] {
  const i = cle.indexOf(":");
  return i < 0 ? [cle, null] : [cle.slice(0, i), cle.slice(i + 1)];
}

const G_META = "Meta Ads";
const G_GOOGLE = "Google Ads";
const G_DEUX = "Tes deux régies";
// Le groupe des clés nues. Ces chiffres-là ne sont pas « les deux régies faute
// de mieux », ils en sont la SOMME — un CTR de 9,8 % qui vaut 2 % chez l'un et
// 15 % chez l'autre ne décrit ni l'un ni l'autre. D'où un nom qui dit
// l'addition, là où « Tes deux régies » dit l'indivisibilité.
const G_DEUX_ANCIEN = "Meta et Google confondus";
const G_INSTA = "Ton Instagram";
const G_SITE = "Ton site";
// L'ordre descend du plus séparé au moins séparé : les deux régies nommées,
// puis ce qui ne se sépare pas (le ROAS), puis ce qui n'est PAS ENCORE séparé
// et porte donc un geste à faire, puis les terrains qui n'ont jamais eu deux
// régies. Le lecteur voit ainsi la séparation se dégrader ligne à ligne, et
// l'invite à recharger tombe juste après la seule limite qui, elle, est
// définitive.
const ORDRE_GROUPES = [G_META, G_GOOGLE, G_DEUX, G_DEUX_ANCIEN, G_INSTA, G_SITE];

// LES QUATRE INDICATEURS QUE LE WORKER PUBLIE MAINTENANT PAR RÉGIE
// (`_PAR_REGIE`, `saas/worker/build_report.py`). Trouvés en clé NUE, ils ne
// disent pas « inséparables » : ils disent « ce rapport date d'avant le 12 août
// 2026 ». Deux situations que rien ne distinguait, alors qu'elles appellent
// deux phrases opposées — l'une explique une limite définitive, l'autre indique
// un geste à faire.
const SEPARABLES = new Set(["ctr", "cpc", "spend", "clics"]);

/** Vrai quand la clé aurait dû porter sa régie et ne la porte pas. */
function avantSeparation(cle: string): boolean {
  const [base, regie] = decoupe(cle);
  return regie === null && SEPARABLES.has(base);
}

/** Le groupe d'un indicateur, et les sources qui l'alimentent.
 *
 *  C'est ICI que se fait la séparation des deux « confondus », et nulle part
 *  ailleurs : un indicateur appartient à un groupe, il ne porte pas un drapeau
 *  que le groupe hériterait de son voisin le plus ancien. */
function terrain(cle: string): { groupe: string; court: string; sources: string[] } | null {
  const [base, regie] = decoupe(cle);
  const b = BASE[base];
  if (!b) return null;
  if (regie === "meta") return { groupe: G_META, court: b.court, sources: ["meta"] };
  if (regie === "google") return { groupe: G_GOOGLE, court: b.court, sources: ["google"] };
  if (b.famille === "instagram")
    return { groupe: G_INSTA, court: b.court, sources: ["instagram"] };
  if (b.famille === "site") return { groupe: G_SITE, court: b.court, sources: ["site"] };
  if (avantSeparation(cle))
    return { groupe: G_DEUX_ANCIEN, court: b.court, sources: ["meta", "google"] };
  return { groupe: G_DEUX, court: b.court, sources: ["meta", "google"] };
}

// CE QU'UN RAPPORT ANCIEN DOIT DIRE DE LUI-MÊME.
//
// La phrase du ROAS n'est vraie que du ROAS. Collée au-dessus d'un CTR, d'un
// coût par clic, d'une dépense et de clics, elle explique un fait qui n'est pas
// le leur — et surtout elle tait le seul fait utile : la séparation existe,
// c'est ce rapport-ci qui est antérieur. David a conclu de cet écran « c'est
// toujours pas séparé par plateforme », alors que le code l'était.
//
// Et la réciproque est vraie, ce qui est le tort de la première correction :
// collée au-dessus du ROAS, cette phrase-ci promet une séparation qui n'aura
// jamais lieu.
//
// Le bouton est nommé EXACTEMENT comme il l'est en haut du rapport
// (`components/reload-recos-button.tsx`) : une invite qui paraphrase un bouton
// oblige à le chercher.
const AVANT_SEPARATION_COURT =
  "Meta et Google additionnés — « ↻ Recharger mes conseils » les sépare";
const AVANT_SEPARATION_LONG =
  "Rapport publié avant la séparation par régie : ces chiffres additionnent " +
  "Meta et Google. « ↻ Recharger mes conseils », en haut, les sépare.";

// Pourquoi un groupe « les deux régies » subsiste alors qu'on sépare tout le
// reste : le ROAS ne se sépare PAS. Son revenu vient de Google Analytics, qui
// le donne pour tout le compte sans dire quelle régie l'a produit. Un « ROAS
// Meta » diviserait le revenu de TOUT le compte par la seule dépense Meta —
// un chiffre faux, et flatteur. On préfère l'écrire.
//
// Chaque groupe a sa phrase, et une seule : c'est ce qui permet à la ligne sous
// le GRAND chiffre et à l'en-tête du sélecteur de dire la même chose sans que
// personne n'ait à tester une exception au moment de l'affichage.
const PROVENANCE: Record<string, string> = {
  [G_META]: "Meta seul",
  [G_GOOGLE]: "Google seul",
  [G_DEUX]: "le revenu vient de Google Analytics, qui ne dit pas quelle régie l'a produit",
  [G_DEUX_ANCIEN]: AVANT_SEPARATION_COURT,
  [G_INSTA]: "Instagram",
  [G_SITE]: "Google Analytics",
};

/** La phrase de provenance d'un indicateur : celle de son groupe, toujours. */
function provenance(cle: string): string {
  const g = terrain(cle)?.groupe;
  return (g && PROVENANCE[g]) || "";
}

/** Les sources d'un groupe — l'union de celles de ses indicateurs, sans doublon. */
function sourcesGroupe(cles: string[]): string[] {
  const out: string[] = [];
  for (const c of cles)
    for (const s of terrain(c)?.sources ?? [])
      if (!out.includes(s)) out.push(s);
  return out;
}

/** Les glyphes de provenance, dans leur couleur. Le seul endroit qui les pose. */
function Glyphes({ sources, actif = false }: { sources: string[]; actif?: boolean }) {
  if (sources.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-[3px] leading-none shrink-0">
      {sources.map((s) => {
        const src = SOURCE[s];
        if (!src) return null;
        return (
          <span
            key={s}
            className="text-[10px] leading-none"
            style={{ color: actif ? src.surSombre : src.couleur }}
            title={src.nom}
          >
            {src.glyphe}
          </span>
        );
      })}
    </span>
  );
}
// Ce que le chiffre mesure vraiment. « 8 990 » n'est pas la même chose selon
// qu'il s'agit d'un total de semaine ou d'une moyenne par publication.
const PORTEE: Record<string, string> = {
  reach: "moyenne par publication",
  eng: "moyenne par publication",
  roas: "sur la semaine",
  ctr: "sur la semaine",
  cpc: "sur la semaine",
  spend: "total de la semaine",
  clics: "total de la semaine",
  vues: "total de la semaine",
  trafic: "total de la semaine",
};

// Le formatage suit la clé de BASE : `spend:meta` est une dépense, et se lit
// comme une dépense. Tester `o.key` en entier rendait « 1 667 » en « 1667.0 »
// dès que la clé portait sa régie.
function fmtVal(o: KpiOption, v: number): string {
  const base = decoupe(o.key)[0];
  if (base === "reach" || base === "clics" || base === "spend" || base === "vues" || base === "trafic")
    return Math.round(v).toLocaleString("fr-CH");
  return v.toFixed(base === "cpc" ? 2 : 1);
}

function ecartPct(o: KpiOption): number | null {
  return o.precedent !== null && o.precedent !== 0
    ? ((o.valeur - o.precedent) / Math.abs(o.precedent)) * 100
    : null;
}

// Une cellule du sélecteur : le nom, ses SOURCES, la valeur, la pente.
//
// La maquette d'origine proposait une pastille de couleur par cellule, refusée
// alors parce qu'elle aurait répété neuf fois ce que l'en-tête de groupe disait
// trois fois. Le glyphe n'est pas cette pastille : il ne redit pas le groupe, il
// dit CE QU'ON CASSE en coupant une régie — et cinq cellules sur neuf en portent
// deux, ce qu'aucun en-tête de groupe ne pouvait exprimer. Il coûte 14 px, pas
// les 20 px d'une pastille, et il se pose contre le nom.
function Cellule({
  o,
  actif,
  onClick,
}: {
  o: KpiOption;
  actif: boolean;
  onClick: () => void;
}) {
  const d = ecartPct(o);
  const s = sensPente(d, o.direction === "down", 0.5);
  const t = terrain(o.key);
  const court = t?.court ?? o.titre;
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-2.5 py-2 transition-colors ${
        actif
          ? "bg-ink text-white border-ink"
          : "bg-white border-line hover:bg-black/[0.03]"
      }`}
      title={t ? `${o.titre} — ${provenance(o.key)}`.trim().replace(/ —\s*$/, "") : o.titre}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`block text-[9.5px] uppercase tracking-wide font-bold truncate ${
            actif ? "text-white/60" : "text-faint"
          }`}
        >
          {court}
        </span>
        <span className="ml-auto">
          <Glyphes sources={t?.sources ?? []} actif={actif} />
        </span>
      </span>
      <span className="flex items-baseline gap-1.5 mt-0.5">
        <span className={`font-mono text-[15px] leading-none font-medium ${actif ? "" : "text-ink"}`}>
          {fmtVal(o, o.valeur)}
          <span className={`text-[9.5px] ${actif ? "text-white/60" : "text-faint"}`}>{o.unite}</span>
        </span>
        {d !== null && (
          <span
            className={`text-[10px] font-bold leading-none ${
              actif ? "text-white/70" : s.plat ? "text-faint" : s.cls
            }`}
          >
            {s.plat ? (
              "≈"
            ) : (
              <>
                <Triangle sens={s.monte ? "haut" : "bas"} /> {d > 0 ? "+" : ""}
                {d.toFixed(0)} %
              </>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

export function KpiFocusCard({ k }: { k: KpiFocus }) {
  const [cle, setCle] = useState(k.defaut);
  const o = k.options.find((x) => x.key === cle) ?? k.options[0];
  if (!o) return null;

  const bandes = o.bandes ?? [];
  // La zone où l'on se trouve, ET sa borne basse : « excellent » ne dit rien
  // tant qu'on ne sait pas où l'excellent commence.
  const iz = bandes.findIndex((b) => b.max === null || o.valeur < b.max);
  const zone = iz >= 0 ? bandes[iz] : bandes[bandes.length - 1];
  const bornage =
    bandes.length === 0
      ? null
      : iz <= 0
        ? bandes[0]?.max != null
          ? `sous ${bandes[0].max.toLocaleString("fr-CH")}${o.unite}`
          : null
        : `au-dessus de ${(bandes[iz - 1].max ?? 0).toLocaleString("fr-CH")}${o.unite}`;
  const couleur =
    zone?.tone === "pos" ? "#1a7a4a" : zone?.tone === "neg" ? "#c0392b" : "#b86b00";

  const delta = ecartPct(o);
  const groupe = terrain(o.key)?.groupe;

  // Les repères d'action, NOMMÉS quand le rapport porte leur date et leur titre.
  // Une date exacte est écrite comme une date (« 24 jun ») ; à défaut, seul
  // l'index de semaine est connu et on écrit « sem. du 24 jun » — un seau
  // hebdomadaire présenté comme un jour serait un chiffre présenté pour autre
  // chose que ce qu'il mesure.
  const marqueurs = marqueursCourbe(
    k.marqueurs,
    k.markers,
    k.labels.length,
    (i) => k.labels[i]
  );

  // Les groupes réellement présents, dans l'ordre. Un rapport ancien qui porte
  // un ROAS en fait apparaître DEUX côte à côte — « Tes deux régies » pour le
  // seul ROAS, « Meta et Google confondus » pour ses quatre clés nues — et
  // c'est exactement ce qu'on veut voir : deux vides de nature différente ne se
  // rangent pas sous le même en-tête.
  const groupes = ORDRE_GROUPES.map((g) => ({
    nom: g,
    options: k.options.filter((op) => terrain(op.key)?.groupe === g),
  })).filter((g) => g.options.length > 0);
  const orphelines = k.options.filter((op) => !terrain(op.key));

  return (
    <div className="bg-white border border-line rounded-2xl shadow-card overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-3">
          Ta boussole <span className="text-ink">· {o.titre}</span>
        </div>

        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-mono text-[38px] sm:text-[46px] leading-none font-medium text-ink">
            {fmtVal(o, o.valeur)}
            <span className="text-[20px] text-faint">{o.unite}</span>
          </span>
          {zone && (
            <span
              className="text-[12px] font-bold px-2.5 py-1 rounded-full"
              style={{ color: couleur, background: `${couleur}14` }}
            >
              {zone.label}
              {bornage && <span className="font-semibold opacity-80"> · {bornage}</span>}
            </span>
          )}
        </div>
        {/* Ce que le chiffre mesure, et d'où il vient. Sans cette ligne, rien ne
            dit que le CTR mélange deux régies — et on coupe Google en croyant
            lire Google. C'est ici que la phrase du ROAS mentait le plus fort :
            elle se lit comme la ligne honnête du module. */}
        <p className="text-[10.5px] text-faint mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span>{PORTEE[decoupe(o.key)[0]] ?? "sur la semaine"}</span>
          {groupe && (
            <>
              <span>·</span>
              <Glyphes sources={terrain(o.key)?.sources ?? []} />
              <span>{provenance(o.key)}</span>
            </>
          )}
        </p>
        <Pente
          delta={delta}
          baisseEstBonne={o.direction === "down"}
          className="text-[12.5px] mt-1"
          base={
            <>
              vs la semaine dernière ({fmtVal(o, o.precedent ?? 0)}
              {o.unite})
            </>
          }
        />
      </div>

      {/* La trajectoire, avec ses zones en fond : la SEULE forme du module */}
      <div className="border-t border-line bg-black/[0.012] px-3 pt-3 pb-1.5">
        <LineChart
          labels={k.labels}
          series={[{ name: o.titre, color: "#1a56ff", values: o.points }]}
          height={210}
          fmt={(v) => fmtVal(o, v)}
          unit={o.unite}
          ariaLabel={`${o.titre} sur 10 semaines`}
          marqueurs={marqueurs}
          bandes={bandes.length > 0 ? bandes : undefined}
        />
        {/* Le comptage « N semaines où tu as appliqué une action » a disparu :
            il renvoyait à une section supprimée depuis, et chaque repère porte
            désormais son nom au survol de son point. */}
      </div>

      {/* Comment lire cet indicateur. Ce texte existait déjà, mais dans un
          `title=` de survol : sur un téléphone, une infobulle n'existe pas. */}
      {o.repere && (
        <details className="group border-t border-line">
          <summary className="cursor-pointer select-none list-none px-4 py-2.5 text-[11.5px] font-semibold text-brand">
            <span className="group-open:hidden">▸ Comment lire cet indicateur</span>
            <span className="hidden group-open:inline">▾ Comment lire cet indicateur</span>
          </summary>
          <p className="px-4 pb-3 -mt-0.5 text-[12px] text-muted leading-relaxed max-w-[62ch]">
            {o.repere}
          </p>
        </details>
      )}

      {/* Changer d'indicateur — chaque cellule porte sa valeur, sa pente et ses
          sources : le choix se fait en lisant, pas en cliquant neuf fois.

          LES GROUPES SONT DES BLOCS, plus trois titres posés dans une grille
          continue. En `contents`, la seule chose qui séparait « Ta pub » de
          « Ton Instagram » était six pixels de marge sous un mot gris : les
          neuf cellules se lisaient comme une seule liste, et le groupement —
          qui est justement ce que David a décidé de garder — ne se voyait pas.
          Chaque groupe a maintenant son cadre, son en-tête, et sa PROVENANCE
          écrite en toutes lettres à côté de ses glyphes.

          ET LA LISTE DÉFILE. Séparer les régies fait passer la grille de trois
          groupes à cinq : sur un portable, les deux derniers tombaient sous la
          ligne de flottaison et le module ne montrait plus qu'un tiers de ce
          qu'on peut suivre. La boîte est bornée et porte `.defile` — les ombres
          s'éteignent seules quand tout tient, donc rien ne change pour un compte
          qui n'a qu'une régie. */}
      <div className="border-t border-line bg-black/[0.012] px-3 py-3 space-y-2 defile max-h-[340px] sm:max-h-[420px] [--fond-defile:#fbfbfc]">
        {groupes.map((g) => {
          const sources = sourcesGroupe(g.options.map((op) => op.key));
          const ancien = g.nom === G_DEUX_ANCIEN;
          return (
            <div key={g.nom} className="rounded-xl border border-line bg-white/60 p-2">
              <div className="flex items-baseline gap-2 px-0.5 pb-1.5">
                <span className="text-[9.5px] uppercase tracking-widest text-ink font-bold">
                  {g.nom}
                </span>
                <Glyphes sources={sources} />
                {/* La provenance est courte et se tronque sans dommage ; la
                    phrase du rapport ancien porte un GESTE, elle passe donc à
                    la ligne au lieu de finir en « … » — d'où sa version longue
                    juste dessous, et rien ici. */}
                {!ancien && (
                  <span className="text-[10px] text-faint truncate">
                    {PROVENANCE[g.nom]}
                  </span>
                )}
              </div>
              {ancien && (
                <p className="text-[10px] text-muted leading-snug px-0.5 pb-1.5 max-w-[62ch]">
                  {AVANT_SEPARATION_LONG}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                {g.options.map((op) => (
                  <Cellule
                    key={op.key}
                    o={op}
                    actif={op.key === cle}
                    onClick={() => setCle(op.key)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {orphelines.length > 0 && (
          <div className="rounded-xl border border-line bg-white/60 p-2">
            <div className="text-[9.5px] uppercase tracking-widest text-ink font-bold px-0.5 pb-1.5">
              Autres
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
              {orphelines.map((op) => (
                <Cellule
                  key={op.key}
                  o={op}
                  actif={op.key === cle}
                  onClick={() => setCle(op.key)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
