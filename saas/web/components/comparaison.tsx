import { fmtCHF } from "@/lib/report";
import { Triangle, sensPente } from "@/components/pente";
import { DateRange } from "@/components/date-range";
import { LineChart } from "@/components/line-chart";
import {
  pct,
  type Comparaison,
  type DashParams,
  type ModeCompare,
  type PointFrise,
} from "@/lib/channels";

// ── COMPARER LA PÉRIODE AFFICHÉE À UNE AUTRE ─────────────────────────────────
//
// Un seul module pour Meta, Google et Instagram. Ce qui change d'un canal à
// l'autre, ce sont les MÉTRIQUES ; la règle de lecture, elle, est identique —
// sinon « +12 % » ne voudrait pas la même chose selon l'onglet ouvert.
//
// LA FORME EST UNE FRISE : LES DEUX PÉRIODES SUR LE MÊME AXE.
// C'est la demande, et ce n'est pas un ornement du pourcentage : « +18 % » ne
// dit pas si la hausse vient d'un pic de deux jours ou d'un niveau tenu quinze
// jours, et ce sont deux nouvelles opposées. Le chiffre dit COMBIEN, la frise
// dit COMMENT — dans cet ordre, jamais l'inverse (rang 3 avant rang 6).
//
// L'ALIGNEMENT SE FAIT PAR LA FIN, PAS PAR LES DATES.
// Les deux fenêtres sont à des dates différentes par construction : les poser
// sur un axe de dates réelles donnerait deux tracés côte à côte qui ne se
// comparent pas, ou un axe qui ment sur l'un des deux. Le dernier jour de
// chaque fenêtre est donc mis en face de l'autre, et l'axe porte le RANG du
// jour — « −13 j », puis « fin ». Quand les longueurs diffèrent, la plus
// courte commence plus loin sur l'axe et son trait démarre là : rien n'est
// étiré, rien n'est interpolé.
// LA FORME ÉCARTÉE : deux barres appariées par métrique (l'une sur l'autre,
// « avant / après »). Elle se lit vite, mais elle ne dit que ce que le
// pourcentage dit déjà, en plus gros — elle répond COMBIEN une deuxième fois au
// lieu de répondre COMMENT. Ce que les deux périodes ont fait JOUR PAR JOUR
// n'existe nulle part ailleurs sur la page.
//
// LES QUATRE ARBITRAGES QUI RENDENT CE MODULE HONNÊTE. Ils sont posés dans
// `lib/channels.ts` (`batirComparaison`) pour les fenêtres, ici pour la lecture.
//
// 1 · LE JOUR EN COURS EST DEHORS, des deux côtés. Les fenêtres viennent de
//     `makeWindow` / `customWindow`, qui s'arrêtent au dernier jour plein.
//
// 2 · DEUX LONGUEURS DIFFÉRENTES NE SE COMPARENT PAS EN VALEUR ABSOLUE, et on
//     ne refuse pas pour autant : **tout ce qui s'additionne est ramené au
//     jour**, tout ce qui est déjà un taux ne bouge pas. Sept jours contre
//     trente, comparés en total, donneraient « −74 % » à un compte qui n'a rien
//     changé — l'écart mesurerait la durée des fenêtres, pas la performance.
//     Refuser était l'autre option : elle a été écartée parce que le client vient
//     précisément de choisir ces deux plages, et qu'un module qui répond « non »
//     à la seule question qu'on lui pose ne sert à rien. Le prix est écrit en
//     toutes lettres au rang 9, et les libellés portent « / jour ». La frise, en
//     revanche, n'a jamais eu à être normalisée : elle est journalière par
//     nature — c'est d'ailleurs ce qui rend le choix du jour cohérent.
//
// 3 · UNE PÉRIODE SANS DONNÉE N'EST PAS UNE PÉRIODE À ZÉRO. C'est là que ce
//     genre de module ment le plus facilement, dans les deux sens : « +∞ % »
//     quand la référence vaut zéro, « −100 % » quand c'est la récolte qui
//     manque. `pct()` rend `null` sur un dénominateur nul — on écrit alors le
//     mot, jamais un pourcentage. Et une référence qui déborde de la couverture
//     des données est REFUSÉE en amont, avec sa raison.
//
// 4 · CE QU'ON NE PEUT PAS COMPARER, ON NE LE COMPARE PAS. Trois limites
//     connues, écrites dans le module plutôt que contournées par une
//     approximation — voir le `<details>` du rang 7.

type Nature = "somme" | "taux";

const LIB: Record<
  string,
  {
    titre: string;
    unite?: string;
    nature: Nature;
    fmt: (v: number) => string;
    /** La valeur d'UN JOUR de frise. `null` = indéfini ce jour-là. */
    jour: (p: PointFrise) => number | null;
    baisseEstBonne?: boolean;
    neutre?: boolean;
  }
> = {
  // Publicité — la DÉPENSE est marquée `neutre` : dépenser moins n'est ni une
  // victoire ni un échec tant qu'on ne sait pas ce que ça rapporte
  // (docs/03-grammaire-des-modules.md, les interdits).
  spend: { titre: "Dépense", unite: "CHF", nature: "somme", fmt: fmtCHF, jour: (p) => p.spend, neutre: true },
  clicks: { titre: "Clics", nature: "somme", fmt: fmtCHF, jour: (p) => p.clicks },
  impressions: { titre: "Impressions", nature: "somme", fmt: fmtCHF, jour: (p) => p.impressions },
  ctr: {
    titre: "CTR", unite: "%", nature: "taux", fmt: (v) => v.toFixed(2),
    jour: (p) => (p.impressions > 0 ? (p.clicks / p.impressions) * 100 : null),
  },
  cpc: {
    titre: "CPC", unite: "CHF", nature: "taux", fmt: (v) => v.toFixed(2),
    jour: (p) => (p.clicks > 0 ? p.spend / p.clicks : null),
    baisseEstBonne: true,
  },
  // Instagram — publier plus ou moins n'est pas non plus un verdict en soi.
  posts: { titre: "Publications", nature: "somme", fmt: (v) => (v >= 10 ? fmtCHF(v) : v.toFixed(1)), jour: (p) => p.posts, neutre: true },
  reach: { titre: "Portée", nature: "somme", fmt: fmtCHF, jour: (p) => p.reach },
  views: { titre: "Vues", nature: "somme", fmt: fmtCHF, jour: (p) => p.views },
  likes: { titre: "J'aime", nature: "somme", fmt: fmtCHF, jour: (p) => p.likes },
  comments: { titre: "Commentaires", nature: "somme", fmt: (v) => (v >= 10 ? fmtCHF(v) : v.toFixed(1)), jour: (p) => p.comments },
  saved: { titre: "Enregistrements", nature: "somme", fmt: (v) => (v >= 10 ? fmtCHF(v) : v.toFixed(1)), jour: (p) => p.saved },
  eng: {
    titre: "Engagement", unite: "%", nature: "taux", fmt: (v) => v.toFixed(1),
    jour: (p) => (p.reach > 0 ? ((p.likes + p.comments + p.saved) / p.reach) * 100 : null),
  },
};

const MODES: { v: ModeCompare; label: string }[] = [
  { v: "prev", label: "Période précédente" },
  { v: "yoy", label: "L'an dernier" },
];

const GRIS_REF = "#8b8b95";

/** Un sigle ne se met pas en minuscules — « de ctr sur la période » se lit
 *  comme une coquille. Le test est la casse du titre, pas une liste à tenir. */
function enPhrase(titre: string): string {
  return titre === titre.toUpperCase() ? titre : titre.toLowerCase();
}

/** « de engagement » — l'élision manquait. Un module qui explique un chiffre
 *  dans une phrase fautive fait douter du chiffre. */
function deQuoi(titre: string): string {
  const t = enPhrase(titre);
  return /^[aeiouyéèêàâîôûh]/i.test(t) ? `d'${t}` : `de ${t}`;
}

/**
 * Un lien qui garde TOUS les réglages en cours et n'en change qu'un.
 * Générique exprès : les pages pub et la page Instagram n'ont pas la même
 * grammaire d'URL, et trois constructeurs de liens finiraient par diverger sur
 * le paramètre que l'un des trois aurait oublié de recopier.
 */
function lien(path: string, sp: DashParams, patch: Partial<DashParams>): string {
  const q = new URLSearchParams();
  const base: DashParams = { ...sp, ...patch };
  for (const [k, v] of Object.entries(base)) if (v) q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * Les deux frises, alignées PAR LA FIN et complétées de `null` en tête pour la
 * plus courte. `null` n'est pas zéro : `LineChart` n'y pose pas de point et
 * n'y trace pas de trait — la période courte commence simplement plus loin sur
 * l'axe, au lieu de faire croire à un effondrement avant son premier jour.
 */
function aligner(
  courant: PointFrise[],
  reference: PointFrise[],
  jour: (p: PointFrise) => number | null
): { n: number; c: (number | null)[]; r: (number | null)[]; labels: string[] } {
  const n = Math.max(courant.length, reference.length);
  const cale = (pts: PointFrise[]) => {
    const out: (number | null)[] = new Array(n).fill(null);
    for (let i = 0; i < pts.length; i++) out[n - pts.length + i] = jour(pts[i]);
    return out;
  };
  // L'axe compte les jours AVANT la fin de chaque fenêtre, et la dernière
  // graduation s'appelle « fin » : « dernier jour » ne tient pas sur une
  // graduation, et sur trente jours `LineChart` n'affiche qu'une étiquette sur
  // quatre — le repère qui porte tout l'alignement n'était jamais écrit.
  const labels = Array.from({ length: n }, (_, i) =>
    i === n - 1 ? "fin" : `−${n - 1 - i} j`
  );
  return { n, c: cale(courant), r: cale(reference), labels };
}

function Pastille({ actif, href, children }: { actif: boolean; href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={`shrink-0 text-[10.5px] font-semibold rounded-full px-2.5 py-1 border ${
        actif ? "bg-ink text-white border-ink" : "border-line text-muted hover:bg-black/[0.03] bg-white"
      }`}
    >
      {children}
    </a>
  );
}

export function Comparer({
  c,
  sp,
  path,
  tete,
  couleur = "#1a56ff",
}: {
  c: Comparaison;
  /** Les paramètres d'URL en cours — le module ne connaît pas leur grammaire. */
  sp: DashParams;
  path: string;
  /** La métrique qui porte le rang 3 et la frise. Elle suit le sélecteur de la
   *  page : filtrer sur les vues puis voir une frise de portée, c'est répondre à
   *  côté de la question. */
  tete: string;
  couleur?: string;
}) {
  // Rang 8 — le pilotage change ce que le module montre, il vit donc en bas.
  const pilotage = (
    <div className="flex items-center gap-1.5 flex-wrap pt-3 mt-1 border-t border-line">
      {MODES.map((m) => (
        <Pastille
          key={m.v}
          actif={c.mode === m.v}
          href={lien(path, sp, { cmp: m.v, cfrom: undefined, cto: undefined })}
        >
          {m.label}
        </Pastille>
      ))}
      <DateRange
        from={sp.cfrom}
        to={sp.cto}
        champs={["cfrom", "cto"]}
        efface={[]}
        pose={{ cmp: "custom" }}
        etiquette="ou du"
      />
    </div>
  );

  // Rang 7 — ce que ce module ne compare pas. Replié, parce que ce n'est pas ce
  // qu'on vient chercher ; présent, parce qu'un module de comparaison qui tait
  // ses angles morts laisse croire qu'il n'en a pas.
  const limites = (
    <details className="mt-3">
      <summary className="text-[10.5px] font-semibold text-muted cursor-pointer select-none hover:text-ink">
        Ce que cette comparaison ne couvre pas — voir
      </summary>
      <ul className="text-[10.5px] text-faint leading-relaxed mt-1.5 space-y-1 list-disc pl-4">
        <li>
          <strong className="text-muted">Pas de comparaison campagne par campagne.</strong> La
          ventilation par campagne dont on dispose côté revenu (`by_campaign`) n&apos;est pas
          datée : la découper par période produirait un chiffre inventé. La table « Par campagne »
          suit la période affichée, mais ne se compare à aucune autre.
        </li>
        <li>
          <strong className="text-muted">Pas de revenu ni de ROAS.</strong> Google Analytics rend le
          revenu au niveau du COMPTE, pas du canal — un « revenu Meta » n&apos;existe pas, donc sa
          variation non plus.
        </li>
        {c.friseTronquee && (
          <li>
            <strong className="text-muted">La frise s&apos;arrête à 120 jours par fenêtre.</strong>{" "}
            Au-delà ses colonnes font moins de six pixels. Les chiffres ci-dessus, eux, portent sur
            les fenêtres entières.
          </li>
        )}
      </ul>
    </details>
  );

  const enTete = (
    <h2 className="text-[14px] font-semibold text-ink mb-3">
      Comparer{" "}
      <span className="text-faint font-normal">
        · {c.courant.label}
        {c.reference && !c.refus ? ` contre ${c.reference.label}` : ""}
      </span>
    </h2>
  );

  const cadre = (contenu: React.ReactNode) => (
    <div className="mb-8">
      {enTete}
      <div className="bg-white border border-line rounded-xl shadow-card p-5">{contenu}</div>
    </div>
  );

  // ── Ce qui empêche de comparer : on le dit, on ne l'approxime pas ─────────
  if (c.refus || !c.reference)
    return cadre(
      <>
        <p className="text-[12.5px] text-muted leading-relaxed">{c.refus}</p>
        {pilotage}
      </>
    );

  if (c.mesuresReference === 0)
    return cadre(
      <>
        <p className="text-[12.5px] text-muted leading-relaxed">
          Rien n&apos;a été relevé sur {c.reference.label} : la fenêtre est bien couverte par tes
          données, mais elle ne porte aucune ligne. Ce n&apos;est pas une période à zéro comparable —
          c&apos;est une période sans point de comparaison, et en faire un dénominateur donnerait des
          variations infinies.
        </p>
        {pilotage}
      </>
    );

  // ── Les valeurs, ramenées au jour si les fenêtres sont inégales ───────────
  const jc = c.courant.jours;
  const jr = c.reference.jours;
  const parJour = c.inegales;
  const val = (brut: number, cle: string, jours: number) =>
    parJour && LIB[cle]?.nature === "somme" ? brut / jours : brut;

  const lignes = c.metriques
    .filter((m) => LIB[m.cle])
    .map((m) => {
      const l = LIB[m.cle];
      const cur = val(m.courant, m.cle, jc);
      const ref = val(m.reference, m.cle, jr);
      return { cle: m.cle, l, cur, ref, delta: pct(cur, ref) };
    });

  const t = lignes.find((x) => x.cle === tete) ?? lignes[0];
  const sT = sensPente(t.l.neutre ? null : t.delta, t.l.baisseEstBonne, 1);

  const frise = aligner(c.friseCourant, c.friseReference, t.l.jour);
  const fmtF = (v: number) => (t.l.nature === "taux" ? t.l.fmt(v) : v >= 100 ? fmtCHF(v) : v.toFixed(1));

  return cadre(
    <>
      {/* Rang 3 — le chiffre, avant toute forme. */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {t.l.fmt(t.cur)}
          {t.l.unite && <span className="text-[15px] text-faint"> {t.l.unite}</span>}
        </span>
        <span className="text-[11px] text-faint">
          {deQuoi(t.l.titre)}
          {parJour && t.l.nature === "somme" ? " par jour" : ""} sur la période affichée
          {" · "}
          {t.l.fmt(t.ref)}
          {t.l.unite ? ` ${t.l.unite}` : ""} sur la référence
        </span>

        {/* Rang 4 — le verdict, en mots. Gris sur un indicateur qui ne se juge
            pas : la dépense n'a ni bon ni mauvais sens toute seule. */}
        {t.delta === null ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-muted bg-black/[0.05]">
            référence à zéro — pas de variation calculable
          </span>
        ) : t.l.neutre ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-muted bg-black/[0.05]">
            {t.delta > 0 ? "+" : ""}
            {Math.round(t.delta)} % vs la référence
          </span>
        ) : (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sT.cls}`}
            style={{ background: sT.fond }}
          >
            {sT.plat ? (
              "≈ stable"
            ) : (
              <>
                <Triangle sens={sT.monte ? "haut" : "bas"} /> {t.delta > 0 ? "+" : ""}
                {Math.round(t.delta)} % vs la référence
              </>
            )}
          </span>
        )}
      </div>

      {/* Le bilan — les autres métriques, au moins 1,7 fois plus petites que la
          tête (34 → 19 px) et sur UN SEUL fond. Aucune forme ici : la seule du
          module est la frise, et deux formes se disputeraient le regard. */}
      {lignes.length > 1 && (
        <div className="mt-4 rounded-lg bg-black/[0.02] border border-line/70">
          <div className="defile-x flex items-start gap-6 px-4 py-3 rounded-lg">
            {lignes.map((x) =>
              x.cle === t.cle ? null : (
                <div key={x.cle} className="shrink-0">
                  <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
                    {x.l.titre}
                    {parJour && x.l.nature === "somme" && (
                      <span className="normal-case tracking-normal font-normal"> / jour</span>
                    )}
                  </div>
                  <div className="font-mono text-[19px] leading-tight text-ink mt-0.5">
                    {x.l.fmt(x.cur)}
                    {x.l.unite && <span className="text-[11px] text-faint"> {x.l.unite}</span>}
                  </div>
                  {(() => {
                    const s = sensPente(x.l.neutre ? null : x.delta, x.l.baisseEstBonne, 1);
                    return (
                      <div
                        className={`text-[10px] mt-0.5 font-semibold ${
                          x.delta === null || x.l.neutre ? "text-faint" : s.cls
                        }`}
                      >
                        {x.delta === null ? (
                          "réf. à zéro"
                        ) : (
                          <>
                            {!x.l.neutre && !s.plat && <Triangle sens={s.monte ? "haut" : "bas"} />}{" "}
                            {x.delta > 0 ? "+" : ""}
                            {Math.round(x.delta)} %{" "}
                            <span className="text-faint font-normal">réf. {x.l.fmt(x.ref)}</span>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Rang 6 — LA forme, une seule : la frise des deux périodes. */}
      {frise.n >= 2 ? (
        <div className="mt-5">
          <div className="flex items-center gap-4 flex-wrap mb-2">
            <span className="text-[10px] uppercase tracking-wide text-faint font-semibold">
              {t.l.titre} par jour
              {c.friseTronquee && (
                <span className="normal-case tracking-normal font-normal">
                  {" "}· 120 derniers jours de chaque fenêtre
                </span>
              )}
            </span>
            {[
              { c: couleur, nom: c.courant.label },
              { c: GRIS_REF, nom: c.reference.label },
            ].map((s) => (
              <span key={s.nom} className="flex items-center gap-1.5 text-[10.5px] text-muted">
                <span className="inline-block w-4 h-[2.5px] rounded-full" style={{ background: s.c }} />
                {s.nom}
              </span>
            ))}
          </div>
          <LineChart
            labels={frise.labels}
            // La référence passe EN PREMIER : `LineChart` empile dans l'ordre du
            // tableau, et c'est la période affichée qu'on veut au-dessus.
            series={[
              { name: "Référence", color: GRIS_REF, values: frise.r },
              { name: "Période affichée", color: couleur, values: frise.c },
            ]}
            fmt={fmtF}
            unit={t.l.unite ? ` ${t.l.unite}` : ""}
            ariaLabel={`${t.l.titre} par jour — période affichée et période de référence, alignées sur leur dernier jour`}
          />
        </div>
      ) : (
        <p className="text-[11.5px] text-muted mt-4">
          Une frise demande au moins deux jours par fenêtre — celle-ci n&apos;en a qu&apos;un.
        </p>
      )}

      {limites}
      {pilotage}

      {/* Rang 9 — un seul pied. Il ne résume pas, il dit ce qui rend la
          comparaison honnête. */}
      <p className="text-[10.5px] text-faint leading-relaxed mt-3">
        {frise.n >= 2 &&
          "Les deux tracés sont alignés sur leur DERNIER jour, pas sur les dates : deux périodes décalées posées sur un axe de dates ne se comparent pas. "}
        Les deux fenêtres s&apos;arrêtent au dernier jour plein — la journée du relevé est
        incomplète, la compter ferait plonger toutes les variations d&apos;un coup.
        {c.mode === "yoy" &&
          " « L'an dernier » recule de 52 semaines pile, pas de 365 jours : un lundi retombe sur un lundi, sinon l'écart mesurerait surtout le décalage des jours de la semaine."}
        {parJour &&
          ` Les deux plages n'ont pas la même longueur (${jc} jours contre ${jr}) : tout ce qui s'additionne est ramené au jour, tout ce qui est déjà un taux est laissé tel quel. Comparés en total, ${jc} jours et ${jr} jours mesureraient la durée des fenêtres, pas la performance.`}
      </p>
    </>
  );
}
