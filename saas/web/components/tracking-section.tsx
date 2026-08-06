import type { TrackedAction } from "@/lib/report";
import { ScrollList } from "@/components/scroll-list";
import { Triangle } from "@/components/pente";

// LE FIL D'ACTIONS — tout ce que tu as décidé, fait, et ce que ça a donné.
//
// C'était une liste de lignes toutes identiques ; c'est maintenant une frise
// verticale : un rail continu, une pastille par événement, du plus récent au
// plus ancien. La forme suit ce que l'objet EST — une chronologie — et le rail
// dit d'un coup d'œil que ces entrées se suivent dans le temps, ce qu'une pile
// de lignes ne disait pas.
//
// Ce fil ne prend PAS « Ce que tu dois faire » (docs/03-grammaire-des-modules.md,
// « Trois fusions à ne PAS faire »). Un rail est passif par construction : son
// unité est l'événement daté. Une action à faire n'est pas un événement, c'est
// un engagement en attente — sa forme, c'est une case à cocher de 44 px. Les
// deux ne se confondent pas : là-haut, un bloc teinté et des cercles cliquables
// de 22 px ; ici, des pastilles de 7 px sur un trait, qu'on ne clique pas.

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
function d(iso: string): string {
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt.getTime())) return iso;
  return `${dt.getDate()} ${MOIS[dt.getMonth()]}`;
}

// La pastille porte l'ÉTAT, jamais toute seule : le mot reste écrit à côté.
// Une forme qui doit être apprise pour être lue n'est pas une information.
type Forme = "pleine" | "creuse" | "barree";
type Etat = { forme: Forme; couleur: string; cls: string; label: string };

const VERDICT: Record<string, Etat> = {
  better: { forme: "pleine", couleur: "#1a7a4a", cls: "text-pos", label: "ça a marché" },
  worse: { forme: "pleine", couleur: "#c0392b", cls: "text-neg", label: "pas d'effet" },
  stable: { forme: "pleine", couleur: "#b86b00", cls: "text-warn", label: "stable" },
};

function etat(a: TrackedAction): Etat {
  if (a.status === "dropped")
    return { forme: "barree", couleur: "#8b8e98", cls: "text-faint", label: "abandonnée" };
  if (a.status === "archived")
    return a.verdict
      ? VERDICT[a.verdict] ?? VERDICT.stable
      : { forme: "pleine", couleur: "#5a5d66", cls: "text-muted", label: "rangée" };
  if (a.status === "done")
    return a.due
      ? { forme: "creuse", couleur: "#b86b00", cls: "text-warn", label: "à juger" }
      : { forme: "creuse", couleur: "#1a7a4a", cls: "text-pos", label: "en observation" };
  return { forme: "creuse", couleur: "#1a56ff", cls: "text-brand", label: "à faire" };
}

function Pastille({ e }: { e: Etat }) {
  if (e.forme === "barree")
    return (
      <span className="relative block h-[7px] w-[7px] rounded-full bg-white border border-faint">
        <span className="absolute inset-x-[-2px] top-1/2 h-px bg-faint rotate-45" />
      </span>
    );
  return (
    <span
      className="block h-[7px] w-[7px] rounded-full"
      style={
        e.forme === "pleine"
          ? { background: e.couleur }
          : { background: "#fff", boxShadow: `inset 0 0 0 2px ${e.couleur}` }
      }
    />
  );
}

// Tes réactions aux conseils. Elles portaient un rang de compteurs de même
// poids que celui des actions, juste au-dessus : deux comptages voisins de la
// même activité, qui semblaient se contredire. Un seul rang de chiffres en tête
// de section, celui-ci replié en pied — rien n'est perdu, l'ordre est rétabli.
function Retours({ feedback }: { feedback: Record<string, string> }) {
  const vals = Object.values(feedback);
  const bits: { icon: string; n: number; mot: string; cls: string }[] = [
    { icon: "✓", n: vals.filter((v) => v === "done").length, mot: "appliqué", cls: "text-pos" },
    { icon: "●", n: vals.filter((v) => v === "useful").length, mot: "utile", cls: "text-brand" },
    { icon: "✕", n: vals.filter((v) => v === "not_for_me").length, mot: "écarté", cls: "text-faint" },
    { icon: "◇", n: vals.filter((v) => v === "too_hard").length, mot: "trop compliqué", cls: "text-warn" },
  ].filter((b) => b.n > 0);
  if (bits.length === 0) return null;
  return (
    <details className="group mt-2.5">
      <summary className="text-[11px] uppercase tracking-wide text-faint font-semibold cursor-pointer select-none list-none">
        Tes retours sur les conseils{" "}
        <span className="text-brand normal-case tracking-normal group-open:hidden">voir ▾</span>
        <span className="text-brand normal-case tracking-normal hidden group-open:inline">replier ▴</span>
      </summary>
      <div className="flex items-center gap-3 flex-wrap text-[12px] mt-1.5">
        {bits.map((b) => (
          <span key={b.icon} className={`${b.cls} font-semibold`}>
            {b.icon} {b.n} {b.mot}
            {b.n > 1 ? "s" : ""}
          </span>
        ))}
      </div>
    </details>
  );
}

export function TrackingSection({
  actions,
  archived,
  num,
  feedback,
}: {
  actions: TrackedAction[];
  archived: TrackedAction[];
  num?: number;
  feedback?: Record<string, string>;
}) {
  const rows = [...actions, ...archived].sort((a, b) =>
    a.decided_at < b.decided_at ? 1 : a.decided_at > b.decided_at ? -1 : 0
  );
  if (rows.length === 0) return null;

  const jugees = rows.filter((a) => a.status === "archived");
  const gagnantes = jugees.filter((a) => a.verdict === "better").length;

  return (
    <section className="mb-9">
      <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink mb-2 flex items-center gap-2.5">
        <span className="h-4 w-[3px] rounded-full bg-brand shrink-0" />
        {num !== undefined && <span className="text-faint font-mono text-[15px]">{num}</span>}{" "}
        Ton historique d&apos;actions
      </h2>

      {/* Le rang 3 — le chiffre. La section ouvrait sur une phrase de comptages
          en 12 px, puis un second rang de comptages, puis la liste : trois
          niveaux et aucun n'était mis en avant. Un seul chiffre répond à la
          seule question qu'on se pose ici — est-ce que ça sert à quelque chose ? */}
      {jugees.length > 0 ? (
        <div className="mb-3">
          <span className="font-mono text-[26px] leading-none font-medium text-ink">
            {gagnantes}
            <span className="text-faint">/{jugees.length}</span>
          </span>
          <span className="text-[12.5px] text-muted ml-2.5">
            de tes actions jugées ont fait bouger la métrique
          </span>
          <div className="text-[11px] text-faint mt-1">
            {rows.length} lancée{rows.length > 1 ? "s" : ""} au total
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <span className="font-mono text-[26px] leading-none font-medium text-ink">
            {rows.length}
          </span>
          <span className="text-[12.5px] text-muted ml-2.5">
            action{rows.length > 1 ? "s" : ""} lancée{rows.length > 1 ? "s" : ""}
          </span>
          <div className="text-[11px] text-faint mt-1">
            Aucune n&apos;a encore son verdict — il tombe deux semaines après coup.
          </div>
        </div>
      )}

      <ScrollList
        title="Tout ce que tu as décidé"
        count={rows.length}
        maxH="max-h-[46vh]"
        divise={false}
      >
        <div className="relative px-4 py-3">
          {/* Le rail. Il s'arrête à la dernière pastille plutôt que de courir
              jusqu'au bord : un trait qui déborde promet une suite. */}
          <div className="absolute left-[20px] top-[22px] bottom-[22px] w-px bg-ink/[0.14]" />
          {rows.map((a) => {
            const e = etat(a);
            return (
              <div key={a.id} className="relative pl-6 py-2.5">
                <span className="absolute left-[1px] top-[15px]">
                  <Pastille e={e} />
                </span>
                <div className="text-[10px] uppercase tracking-widest text-faint font-semibold">
                  {d(a.decided_at)}
                  {a.theme && <span className="text-muted normal-case tracking-normal"> · {a.theme}</span>}
                </div>
                <div className="text-[13.5px] text-ink leading-snug mt-0.5">{a.title}</div>
                <div className="text-[11.5px] mt-0.5">
                  <span className={`font-semibold ${e.cls}`}>{e.label}</span>
                  {a.verdict && a.metric_label && a.then !== undefined ? (
                    <span className="text-faint">
                      {" "}· {a.metric_label} {a.then} → <b className="text-ink">{a.now}</b>
                      {a.delta != null && Math.abs(a.delta) >= 0.5 && (
                        <span className={`font-semibold ${e.cls}`}>
                          {" "}
                          <Triangle sens={a.delta > 0 ? "haut" : "bas"} />{" "}
                          {a.delta > 0 ? "+" : ""}
                          {a.delta.toFixed(0)} %
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-faint">
                      {a.done_at && ` · fait le ${d(a.done_at)}`}
                      {a.status === "done" && !a.due && ` · verdict le ${d(a.check_at)}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollList>

      {feedback && <Retours feedback={feedback} />}

      <p className="text-[11px] text-faint/80 mt-2.5 leading-relaxed">
        Avant/après honnête, pas une preuve absolue — la saisonnalité et le contenu jouent
        aussi. Sur la durée, c&apos;est le meilleur repère de ce qui marche chez toi.
      </p>
    </section>
  );
}
