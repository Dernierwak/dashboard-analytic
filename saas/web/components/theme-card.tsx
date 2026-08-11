import Link from "next/link";
import { fmtCHF, type ThemeFocus, type TrackedAction } from "@/lib/report";
import { LineChart, garderEtiquettes } from "@/components/line-chart";
import { Triangle, sensPente } from "@/components/pente";
import { Pastille, dateCourte, etat, marqueursCourbe } from "@/components/etat-action";

// UNE CARTE PAR THÈME PRIORITAIRE.
//
// La section 2 rendait trois courbes empilées dans une seule carte, et rien
// d'autre. Elle ne faisait rien faire : on y lisait une pente, puis on passait.
// Trois manques précis, tous corrigés ici sans une donnée nouvelle :
//
//  1. AUCUN CHIFFRE DE TÊTE. La valeur courante était en 24 px, coincée entre
//     un surtitre et un graphe. Elle passe en 34 px et porte enfin ce qu'elle
//     mesure — « moyenne par publication », « total de la semaine ». Un même
//     8 990 ne veut pas dire la même chose selon la réponse.
//
//  2. AUCUN POIDS AFFICHÉ. Chaque frise calcule son propre maximum : trois
//     courbes montent pareil alors que l'une pèse 4 500 CHF et l'autre 90.
//     Une échelle commune a été essayée puis abandonnée — elle écrasait le
//     petit thème en une ligne plate au ras de l'axe, et une carte de thème
//     est d'abord là pour montrer LA tendance de CE thème. On dit donc le
//     poids au lieu de le faire subir : le chiffre de tête en 34 px, et le
//     haut de l'échelle écrit sur le graphe.
//
//  3. AUCUN LIEN VERS L'ACTION. Le module montrait l'effet sans jamais montrer
//     la cause. Il porte maintenant une ligne — combien d'actions tournent sur
//     ce thème, ou depuis combien de temps on n'y a rien touché — et le repli
//     de ce qu'on y a déjà fait.
//
// CE QUE CETTE CARTE NE FAIT PAS, ET NE FERA PAS : porter les actions à faire.
// Elles vivent dans « Ce que tu dois faire », le seul bloc teinté de la page,
// avec des cibles de 44 px (docs/03-grammaire-des-modules.md, « Trois fusions à
// ne PAS faire »). Les rendre une seconde fois ici en « encore à valider »
// créerait deux endroits où cocher la même case, et un état d'interface qui
// n'existe pas en base disparaît au rechargement. On donne un lien, pas une
// colonne. Le repli « ce que tu as fait » est en LECTURE SEULE : c'est la table
// des matières des repères ┄ du graphe juste au-dessus, pas un second historique.

type Cadre = { unite: string; fmt: (v: number) => string; portee: string; neutre: boolean };

const CADRES: Record<string, Cadre> = {
  "Portée moyenne": {
    unite: "",
    fmt: (v) => Math.round(v).toLocaleString("fr-CH"),
    portee: "moyenne par publication, dernière semaine",
    neutre: false,
  },
  "Engagement moyen (%)": {
    unite: " %",
    fmt: (v) => v.toFixed(1),
    portee: "moyenne par publication, dernière semaine",
    neutre: false,
  },
  // La dépense n'a pas de bon sens : dépenser plus n'est ni une victoire ni un
  // échec tant qu'on ne sait pas ce que ça rapporte. Sa pente reste donc grise.
  "Dépense (CHF)": {
    unite: " CHF",
    fmt: (v) => fmtCHF(v),
    portee: "total de la dernière semaine",
    neutre: true,
  },
};

const PAR_DEFAUT: Cadre = {
  unite: "",
  fmt: (v) => Math.round(v).toLocaleString("fr-CH"),
  portee: "dernière semaine",
  neutre: false,
};

/**
 * Vrai quand la pente de cet indicateur ne se juge pas. Dépenser moins n'est ni
 * une victoire ni un échec tant qu'on ne sait pas ce que ça rapporte : classer
 * les thèmes sur une dépense qui baisse désignerait « celui qui décroche » à
 * celui qui a simplement coupé une campagne — un verdict non mérité.
 */
export function penteNeutre(metricLabel: string): boolean {
  return (CADRES[metricLabel] ?? PAR_DEFAUT).neutre;
}

/** L'ancre de la carte d'un thème, pour y renvoyer depuis les conseils. */
export function ancreTheme(label: string): string {
  return (
    "theme-" +
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

/** Moyenne des 4 dernières semaines contre les 4 précédentes — une semaine
 *  seule se laisse trop facilement emporter par un accident. */
export function ecartTheme(vals: number[]): number | null {
  const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const recent = moy(vals.slice(-4));
  const avant = moy(vals.slice(-8, -4));
  return avant > 0 ? ((recent - avant) / avant) * 100 : null;
}

export function ThemeCard({
  theme,
  actions,
  archived,
  fenetre,
  decroche = false,
}: {
  theme: ThemeFocus;
  actions: TrackedAction[];
  archived: TrackedAction[];
  /** « depuis le 1 jan » — la fenêtre du bilan, qui n'est PAS celle de la courbe. */
  fenetre: string | null;
  decroche?: boolean;
}) {
  const s = theme.series;
  if (!s || s.points.length < 2) return null;

  const vals = s.points.map((p) => p.value);
  const derniere = vals[vals.length - 1];
  const cadre = CADRES[s.metric_label] ?? PAR_DEFAUT;
  const ecart = ecartTheme(vals);
  const p = sensPente(ecart, false, 8);
  // Pente neutre : on affiche le mouvement, on ne le juge pas.
  const filet = cadre.neutre || p.plat ? "rgba(14,15,18,0.10)" : p.bon ? "#1a7a4a" : "#c0392b";

  const som = theme.summary;
  const hasRoas = som.roas !== null && som.roas !== undefined;
  const exclure = s.metric_label.startsWith("Engagement") ? "Engagement" : null;
  const cases: { cle: string; valeur: string; unite?: string }[] = [];
  if (som.spend != null && som.spend > 0) {
    cases.push({ cle: "Dépensé", valeur: fmtCHF(som.spend), unite: "CHF" });
    if (hasRoas) {
      cases.push({ cle: "Revenu", valeur: fmtCHF(som.revenue ?? 0), unite: "CHF" });
      cases.push({ cle: "ROAS", valeur: som.roas!.toFixed(1) });
    } else if (som.ctr != null) {
      cases.push({ cle: "CTR", valeur: som.ctr.toFixed(1), unite: "%" });
    }
  }
  if (som.posts != null && som.posts > 0) {
    cases.push({ cle: "Publications", valeur: String(som.posts) });
    if (som.eng_avg != null && exclure !== "Engagement")
      cases.push({ cle: "Engagement", valeur: som.eng_avg.toFixed(1), unite: "%" });
  }

  // Les actions de CE thème, réparties en DEUX ENSEMBLES DISJOINTS — c'est ce
  // qui permet de les poser de part et d'autre sous la courbe sans que la même
  // action se lise deux fois : à gauche ce qui court encore, à droite ce qui
  // est clos. Une action « faite » n'est pas close : son verdict n'est pas
  // tombé, elle reste à gauche, en observation.
  const miennes = [...actions, ...archived].filter((a) => a.theme === theme.label);
  const aFaire = miennes.filter((a) => a.status === "running");
  const enObservation = miennes.filter((a) => a.status === "done");
  const passees = miennes
    .filter((a) => a.status === "archived" || a.status === "dropped")
    .sort((a, b) => (a.decided_at < b.decided_at ? 1 : -1));
  const derniereDecision = miennes.map((a) => a.decided_at).sort().pop();
  const semainesDepuis = derniereDecision
    ? Math.floor(
        (Date.now() - new Date(derniereDecision + "T00:00:00").getTime()) / (7 * 864e5)
      )
    : null;

  // Les repères d'action, NOMMÉS quand le rapport porte leur date et leur titre.
  // Une date exacte est écrite comme une date (« 24 jun ») ; à défaut, seul
  // l'index de semaine est connu et on écrit « sem. du 24 jun » — un seau
  // hebdomadaire présenté comme un jour serait un chiffre présenté pour autre
  // chose que ce qu'il mesure.
  const marqueurs = marqueursCourbe(
    s.marqueurs,
    s.markers,
    s.points.length,
    (i) => s.points[i].label
  );
  const etiquettes = garderEtiquettes(marqueurs);

  return (
    <section
      id={ancreTheme(theme.label)}
      className="bg-white border border-line rounded-xl shadow-card overflow-hidden scroll-mt-4"
    >
      <div className="border-l-[3px]" style={{ borderColor: filet }}>
        {/* En-tête — le même habillage que la carte du thème dans les conseils :
            c'est ce qui dit « c'est le même thème » à travers 800 px de page. */}
        <div className="px-5 py-4 border-b border-line bg-black/[0.015]">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h3 className="font-serif text-[17px] text-ink">
              {theme.is_priority && <span className="text-warn">★ </span>}
              {theme.label}
            </h3>
            {decroche && (
              <span className="text-[10.5px] font-bold text-neg bg-neg/[0.08] border border-neg/20 rounded-full px-2 py-0.5">
                celui qui décroche
              </span>
            )}
            {som.spend_week > 0 && (
              <span className="text-[11.5px] text-faint">
                {fmtCHF(som.spend_week)} CHF cette semaine
              </span>
            )}
            <Link
              href={`/?vue=${encodeURIComponent(theme.label)}#conseils`}
              className="ml-auto text-[11.5px] font-semibold text-brand hover:underline shrink-0"
            >
              ses conseils ↓
            </Link>
          </div>

          {/* Le rang 3 — le chiffre, et c'est celui de la COURBE, jamais un
              autre : sinon l'en-tête et le graphe parlent de deux sujets. */}
          <div className="flex items-baseline gap-2.5 flex-wrap mt-2.5">
            <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
              {cadre.fmt(derniere)}
              <span className="text-[15px] text-faint">{cadre.unite}</span>
            </span>
            {ecart !== null && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  cadre.neutre ? "text-muted" : p.cls
                }`}
                style={{ background: cadre.neutre ? "rgba(0,0,0,0.05)" : p.fond }}
                title="Moyenne des 4 dernières semaines comparée aux 4 précédentes"
              >
                {p.plat ? (
                  "≈ stable"
                ) : (
                  <>
                    <Triangle sens={p.monte ? "haut" : "bas"} /> {ecart > 0 ? "+" : ""}
                    {Math.round(ecart)} %
                  </>
                )}
              </span>
            )}
          </div>
          <p className="text-[10.5px] text-faint mt-1">
            {s.metric_label.replace(/ \(.*\)$/, "").toLowerCase()} · {cadre.portee}
          </p>

          {/* Le bilan. Il porte SA fenêtre : « 103 CHF cette semaine » et
              « 4 520 dépensé » se lisaient comme une même période alors que le
              second couvre tout l'historique. */}
          {cases.length > 0 && (
            <>
              <div className="mt-3 flex gap-x-7 gap-y-3 flex-wrap">
                {cases.map((c) => (
                  <div key={c.cle}>
                    <div className="font-mono text-[19px] leading-none font-medium text-ink">
                      {c.valeur}
                      {c.unite && <span className="text-[11.5px] text-faint"> {c.unite}</span>}
                    </div>
                    <div className="text-[9.5px] uppercase tracking-wide text-faint font-semibold mt-1">
                      {c.cle}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9.5px] uppercase tracking-wide text-faint font-semibold mt-2">
                {fenetre ? `Ce bilan couvre tout ${fenetre}` : "Ce bilan couvre tout l'historique"}
              </p>
              {/* La note de la série dit déjà pourquoi le ROAS manque, en bas de
                  carte : deux fois la même explication à 200 px d'écart, c'est
                  une de trop. */}
              {!hasRoas && !s.note && som.spend != null && som.spend > 0 && (
                <p className="text-[11px] text-faint mt-1.5 max-w-[62ch] leading-relaxed">
                  Revenu inconnu tant que Google Analytics ne remonte pas la valeur de tes
                  conversions — donc pas de ROAS ici, plutôt qu&apos;un ROAS faux.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-3 pt-3 pb-2">
          <LineChart
            labels={s.points.map((pt) => pt.label)}
            series={[{ name: s.metric_label, color: "#1a56ff", values: vals }]}
            height={180}
            fmt={cadre.fmt}
            unit={cadre.unite}
            ariaLabel={`${s.metric_label} du thème ${theme.label} sur ${s.points.length} semaines`}
            marqueurs={marqueurs}
          />
          {marqueurs.length > etiquettes.length && (
            <p className="text-[10px] text-faint px-1 pt-1">
              <span className="text-ink font-bold">┄</span> {marqueurs.length} semaines où tu as
              lancé une action sur ce thème.
            </p>
          )}
        </div>

        <div className="px-5 pb-4 pt-1 space-y-2">
          {s.note && (
            <p className="text-[11px] text-warn leading-relaxed bg-warn/[0.06] border border-warn/20 rounded-lg px-2.5 py-1.5">
              {s.note}
            </p>
          )}

          {/* Sous la courbe, deux colonnes qui se répondent : à GAUCHE ce qui
              t'attend, à DROITE ce que tu as déjà fait, replié. C'est la lecture
              naturelle du graphe — la cause à venir d'un côté, les causes
              passées de l'autre, et entre les deux la courbe qui les relie.
              Sur téléphone elles s'empilent, l'à-faire d'abord. */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-6">
            <div className="min-w-0">
          {/* Le lien vers l'action — 30 px au lieu d'une colonne de 200.
              « En cours » et « en observation » ne sont pas la même chose : la
              première attend un geste de toi, la seconde attend une date. Les
              confondre envoyait vers « Ce que tu dois faire » pour y lire
              « rien à faire ». */}
          {aFaire.length > 0 ? (
            <a
              href="#a-faire"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand hover:underline"
            >
              ▸ {aFaire.length} action{aFaire.length > 1 ? "s" : ""} à faire sur ce thème —
              voir ↑
            </a>
          ) : enObservation.length > 0 ? (
            <a
              href="#a-faire"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted hover:underline"
            >
              ▸ {enObservation.length} action{enObservation.length > 1 ? "s" : ""} en
              observation — verdict le{" "}
              {dateCourte(
                [...enObservation].map((a) => a.check_at).sort()[0] ?? ""
              )}
            </a>
          ) : miennes.length === 0 ? (
            <p className="text-[11.5px] text-warn font-semibold">
              Aucune action lancée sur ce thème
              {theme.is_priority && <> — alors qu&apos;il est dans tes priorités</>}.{" "}
              <Link
                href={`/?vue=${encodeURIComponent(theme.label)}#conseils`}
                className="text-brand hover:underline"
              >
                ses conseils ↓
              </Link>
            </p>
          ) : semainesDepuis !== null && semainesDepuis >= 6 ? (
            <p className="text-[11.5px] text-warn font-semibold">
              Rien de lancé depuis {semainesDepuis} semaines sur ce thème.{" "}
              <Link
                href={`/?vue=${encodeURIComponent(theme.label)}#conseils`}
                className="text-brand hover:underline"
              >
                ses conseils ↓
              </Link>
            </p>
          ) : null}
            </div>

          {/* Lecture seule : la légende datée des repères du graphe. */}
          {passees.length > 0 && (
            <details className="group min-w-0 sm:max-w-[46%] sm:text-right">
              <summary className="cursor-pointer select-none list-none text-[11.5px] font-semibold text-muted">
                <span className="group-open:hidden">
                  ▸ Ce que tu as fait sur ce thème ({passees.length})
                </span>
                <span className="hidden group-open:inline">
                  ▾ Ce que tu as fait sur ce thème ({passees.length})
                </span>
              </summary>
              {/* Le contenu revient à gauche : un titre d'action ferré à droite
                  se lit mal dès qu'il passe sur deux lignes. */}
              <div className="mt-2 max-h-[220px] overflow-y-auto pr-1 text-left">
                {passees.map((a) => {
                  const e = etat(a);
                  return (
                    <div key={a.id} className="flex items-start gap-2 py-1.5">
                      <span className="mt-[5px] shrink-0">
                        <Pastille e={e} />
                      </span>
                      <span className="text-[12px] text-muted leading-snug">
                        <span className="font-mono text-faint">{dateCourte(a.decided_at)}</span>{" "}
                        {a.title} <span className={`font-semibold ${e.cls}`}>· {e.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
