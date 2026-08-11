"use client";

import { useState, useTransition } from "react";
import { resolveAction, saveParier } from "@/app/actions";
import type { TrackedAction } from "@/lib/report";
import { Triangle } from "@/components/pente";

// « Ce que tu dois faire » — le bloc tout en haut du rapport.
// C'est le SEUL bloc teinté de la page : sur un empilement de cartes blanches
// toutes identiques, la couleur de fond suffit à dire « ici, on agit » sans
// avoir à lire un titre. Un conseil que tu décides de tester atterrit ici et
// n'en bouge plus tant que tu ne l'as pas coché. Une fois fait, il passe en
// observation 14 jours, puis revient te demander un verdict. Chaque étape est
// écrite dans Supabase (running → done → archived) : c'est ça, le suivi.

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function jour(iso: string): string {
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt.getTime())) return iso;
  return `${dt.getDate()} ${MOIS[dt.getMonth()]}`;
}

function depuis(iso: string): string {
  const t = new Date(iso + "T00:00:00").getTime();
  if (isNaN(t)) return "";
  const days = Math.max(0, Math.round((Date.now() - t) / 86_400_000));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 14) return `il y a ${days} jours`;
  return `il y a ${Math.round(days / 7)} semaines`;
}

// « Pas d'effet » portait un ▲ ROUGE, pointe en haut, sur une mauvaise
// nouvelle : le troisième sens du triangle, et le plus trompeur des trois.
// Le verdict emprunte maintenant la flèche du delta RÉEL — un chiffre qui a
// baissé montre une flèche vers le bas, quoi qu'on pense du résultat.
const V: Record<string, { cls: string; border: string; icon: string | null; label: string }> = {
  better: { cls: "text-pos", border: "#1a7a4a", icon: "✓", label: "ça a marché" },
  worse: { cls: "text-neg", border: "#c0392b", icon: null, label: "pas d'effet — à revoir" },
  stable: { cls: "text-warn", border: "#b86b00", icon: "≈", label: "stable" },
};

function Marque({ icon, delta }: { icon: string | null; delta?: number | null }) {
  if (icon) return <>{icon}</>;
  if (delta === null || delta === undefined || Math.abs(delta) < 0.5) return <>✕</>;
  return <Triangle sens={delta > 0 ? "haut" : "bas"} />;
}

// Un échec doit se voir et se comprendre : un clic sans réponse est la chose
// qui fait le plus douter d'un produit.
function Erreur({ texte, onFermer }: { texte: string; onFermer: () => void }) {
  return (
    <div className="mt-2 text-[11.5px] leading-snug text-neg bg-neg/[0.06] border border-neg/25 rounded-lg px-3 py-2">
      {texte}
      <button onClick={onFermer} className="block mt-1 text-[10.5px] font-semibold text-faint">
        fermer
      </button>
    </div>
  );
}

const SENS = [
  { cle: "hausse" as const, mot: "monter" },
  { cle: "stable" as const, mot: "ne rien changer" },
  { cle: "baisse" as const, mot: "baisser" },
];

// LE PARI. Ce que tu penses qu'il va se passer, dit AVANT de savoir.
//
// C'est la seule récompense de cette section qui ne se triche pas : la réponse
// tombe du worker quatorze jours plus tard, pas du clic. Un compteur d'actions
// appliquées récompense le geste — et comme cocher « fait » écrit une baseline
// dans `suivi_actions`, cocher pour faire monter un compteur fabrique un
// verdict faux qui repondère ensuite les conseils. Ici, on ne gagne qu'en ayant
// vu juste, et c'est le produit qui tranche.
function Pari({ a }: { a: TrackedAction }) {
  const [pending, startTransition] = useTransition();
  const [choisi, setChoisi] = useState<string | null>(a.detail?.pari ?? null);
  if (!a.metric_label) return null;

  if (choisi) {
    const mot = SENS.find((x) => x.cle === choisi)?.mot ?? choisi;
    return (
      <div className="text-[11.5px] text-muted mt-1.5">
        Tu paries que <span className="font-semibold text-ink">{a.metric_label}</span> va{" "}
        <span className="font-semibold text-ink">{mot}</span> — réponse le {jour(a.check_at)}.
      </div>
    );
  }
  return (
    <div className="mt-1.5">
      <div className="text-[11.5px] text-muted mb-1">
        À ton avis, <span className="font-semibold text-ink">{a.metric_label}</span> va…
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {SENS.map((x) => (
          <button
            key={x.cle}
            disabled={pending}
            onClick={() => {
              setChoisi(x.cle);
              startTransition(async () => {
                const r = await saveParier(a.id, x.cle);
                if (!r.ok) setChoisi(null);
              });
            }}
            className="text-[11.5px] font-semibold text-brand border border-brand/25 rounded-full px-2.5 py-1 hover:bg-brand/[0.06] disabled:opacity-50"
          >
            {x.mot}
          </button>
        ))}
      </div>
    </div>
  );
}

// À FAIRE — une ligne de liste à cocher. La pastille EST le geste « fait » :
// 44 px de cible, un sens universel, et rien à lire pour comprendre.
function TodoRow({ a }: { a: TrackedAction }) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [coche, setCoche] = useState(false);

  const marquerFait = () => {
    setErreur(null);
    setCoche(true); // retour optimiste : la coche part avant la réponse serveur
    startTransition(async () => {
      const r = await resolveAction(a.id, "done", a.reco_key);
      if (!r.ok) {
        setCoche(false);
        setErreur(r.message ?? "Enregistrement impossible — réessaie.");
      }
    });
  };

  return (
    <div className="py-3">
      <div className="flex items-start gap-1">
        <button
          onClick={marquerFait}
          disabled={pending || coche}
          role="checkbox"
          aria-checked={coche}
          aria-label={`Marquer « ${a.title} » comme fait`}
          className="shrink-0 h-11 w-11 -ml-2.5 flex items-center justify-center group"
        >
          <span
            className={`h-[22px] w-[22px] rounded-full border-2 flex items-center justify-center text-[13px] font-bold transition-colors ${
              coche
                ? "bg-pos border-pos text-white"
                : "border-brand/40 text-transparent group-hover:border-brand group-hover:bg-brand/10"
            }`}
          >
            ✓
          </span>
        </button>
        <div className="min-w-0 flex-1 pt-2">
          <div className="text-[14.5px] font-semibold text-ink leading-snug">{a.title}</div>
          <div className="text-[11.5px] text-faint mt-0.5">
            {a.theme && <span className="text-warn font-semibold">★ {a.theme} · </span>}
            décidé {depuis(a.decided_at)}
            {a.detail?.effort ? ` · ⏱ ${a.detail.effort}` : ""}
            {a.metric_label ? ` · on suivra : ${a.metric_label}` : ""}
          </div>

          {/* Le conseil aura disparu du rapport dans deux jours : sans son
              détail sous la main, l'action redevient un titre énigmatique. */}
          {(a.detail?.observation || a.detail?.pourquoi || a.detail?.verifier) && (
            <details className="group mt-1.5">
              <summary className="text-[11.5px] font-semibold text-brand cursor-pointer select-none list-none">
                <span className="group-open:hidden">▸ Voir pourquoi</span>
                <span className="hidden group-open:inline">▾ Replier</span>
              </summary>
              <div className="mt-1.5 space-y-1.5">
                {a.detail?.observation && (
                  <p className="text-[12px] text-muted leading-relaxed">{a.detail.observation}</p>
                )}
                {a.detail?.pourquoi && (
                  <p className="text-[12px] text-muted leading-relaxed">
                    <span className="font-semibold text-ink">Pourquoi — </span>
                    {a.detail.pourquoi}
                  </p>
                )}
                {a.detail?.verifier && (
                  <p className="text-[12px] text-muted leading-relaxed">
                    <span className="font-semibold text-ink">Comment faire — </span>
                    {a.detail.verifier}
                  </p>
                )}
              </div>
            </details>
          )}
          <Pari a={a} />
        </div>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setErreur(null);
              const r = await resolveAction(a.id, "drop");
              if (!r.ok) setErreur(r.message ?? "Impossible de retirer cette action — réessaie.");
            })
          }
          aria-label="Retirer de ma liste"
          title="Retirer de ma liste"
          className="shrink-0 h-11 w-11 -mr-2 flex items-center justify-center text-[15px] text-faint hover:text-muted"
        >
          ×
        </button>
      </div>
      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
    </div>
  );
}

// La réponse au pari. Elle vaut plus que le verdict seul : « ça a marché » dit
// ce que les chiffres ont fait, « tu avais vu juste » dit ce que TU as compris.
// C'est la seule chose de cette page qui mesure un apprentissage.
function VuJuste({ a }: { a: TrackedAction }) {
  const pari = a.detail?.pari;
  if (!pari || a.delta === null || a.delta === undefined) return null;
  const reel = Math.abs(a.delta) < 0.5 ? "stable" : a.delta > 0 ? "hausse" : "baisse";
  const juste = reel === pari;
  const mot = SENS.find((x) => x.cle === pari)?.mot ?? pari;
  return (
    <div
      className={`text-[11.5px] font-semibold mt-1.5 ${juste ? "text-pos" : "text-muted"}`}
    >
      {juste ? (
        <>
          ✓ Tu avais vu juste
          <span className="text-faint font-normal"> — c&apos;est bien ce qui s&apos;est passé.</span>
        </>
      ) : (
        <>
          Tu pariais « {mot} »
          <span className="text-faint font-normal">
            {" "}— ce n&apos;est pas ce qui s&apos;est passé. C&apos;est là qu&apos;on apprend
            quelque chose.
          </span>
        </>
      )}
    </div>
  );
}

// À JUGER — l'action est faite depuis 2 semaines : voilà ce que ça a donné.
function JudgeCard({ a }: { a: TrackedAction }) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const v = a.verdict ? V[a.verdict] ?? V.stable : null;
  return (
    <div
      className="bg-white border border-line rounded-xl px-4 py-3.5"
      style={{ borderLeft: `3px solid ${v ? v.border : "#b86b00"}` }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {v ? (
          <span className={`text-[11px] font-bold ${v.cls}`}>
            <Marque icon={v.icon} delta={a.delta} /> {v.label}
          </span>
        ) : (
          <span className="text-[11px] font-bold text-warn">◷ à juger maintenant</span>
        )}
        <span className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          fait {depuis(a.done_at ?? a.decided_at)}
        </span>
      </div>
      <div className="text-[14px] font-semibold text-ink leading-snug mt-1">{a.title}</div>
      <VuJuste a={a} />
      {v && a.metric_label && a.then !== undefined ? (
        <div className="text-[12.5px] text-muted mt-1">
          {a.metric_label} <b className="text-ink">{a.then}</b> → <b className="text-ink">{a.now}</b>
          {a.delta != null && (
            <span className={v.cls}> ({a.delta > 0 ? "+" : ""}{a.delta.toFixed(0)} %)</span>
          )}
        </div>
      ) : (
        <div className="text-[12.5px] text-muted mt-1">
          Deux semaines ont passé — est-ce que ça a bougé pour toi ?
        </div>
      )}
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setErreur(null);
            const r = await resolveAction(a.id, "seen");
            if (!r.ok) setErreur(r.message ?? "Impossible de ranger cette action — réessaie.");
          })
        }
        className="mt-3 text-[13px] font-semibold text-white bg-ink rounded-full px-4 py-2.5 disabled:opacity-60"
      >
        {pending ? "…" : "✓ Vu — je range"}
      </button>
      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
    </div>
  );
}

export function ActionTop({
  actions,
  archived = [],
  num,
}: {
  actions: TrackedAction[];
  /** Les actions déjà jugées — elles ne s'affichent pas ici, elles se comptent. */
  archived?: TrackedAction[];
  num?: number;
}) {
  const todo = actions.filter((a) => a.status !== "done");
  const judge = actions.filter((a) => a.status === "done" && a.due);
  const watch = actions.filter((a) => a.status === "done" && !a.due);

  // Ce qui a MARCHÉ, pas ce qui a été coché.
  const jugees = archived.filter((a) => a.status === "archived" && a.verdict).length;
  const gagnantes = archived.filter((a) => a.verdict === "better").length;
  // Le prochain rendez-vous : la plus proche échéance encore à venir.
  const prochain = [...watch]
    .map((a) => a.check_at)
    .filter(Boolean)
    .sort()[0];

  const compte = [
    todo.length > 0 ? `${todo.length} à faire` : null,
    judge.length > 0 ? `${judge.length} à juger` : null,
    watch.length > 0 ? `${watch.length} en observation` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // RIEN À FAIRE, RIEN À JUGER : la section n'a pas lieu d'être.
  //
  // Elle s'affichait quand même — titre de niveau 1, numéro de section, bloc
  // teinté — pour dire qu'il n'y avait rien à faire. Et elle écrivait la même
  // échéance trois fois : « 1 en observation », puis « Prochain verdict le 16
  // aoû », puis une ligne « ✓ fait … verdict le 16 aoû ». Trois fois la même
  // date pour une seule action.
  //
  // Ne reste que ce qui est vrai et neuf : le rendez-vous. Le titre des actions
  // en observation vit dans « Ton historique d'actions », qui est son sujet.
  if (todo.length === 0 && judge.length === 0) {
    return (
      <section id="a-faire" className="mb-8 scroll-mt-4">
        <p className="text-[12.5px] text-muted leading-relaxed rounded-xl border border-line bg-black/[0.015] px-4 py-3">
          <span className="font-semibold text-ink">Rien à faire dans l&apos;immédiat.</span>{" "}
          {watch.length} action{watch.length > 1 ? "s" : ""} en observation
          {prochain && (
            <>
              {" "}— prochain verdict le{" "}
              <span className="font-semibold text-ink">{jour(prochain)}</span>
            </>
          )}
          .{" "}
          <a href="#conseils" className="text-brand font-semibold hover:underline">
            Prends-en une de plus ↓
          </a>
        </p>
      </section>
    );
  }

  // Liste vide : pas de boîte vide, mais le mécanisme expliqué en une ligne.
  // C'est le moment où l'utilisateur apprend comment l'outil fonctionne.
  if (actions.length === 0) {
    return (
      <section id="a-faire" className="mb-8 scroll-mt-4">
        <div className="rounded-xl border border-dashed border-line bg-black/[0.015] px-4 py-3">
          <span className="text-[12.5px] text-muted leading-relaxed">
            <span className="font-semibold text-ink">Ta liste est vide.</span> Descends
            aux conseils et prends-en un —{" "}
            <a href="#conseils" className="text-brand font-semibold hover:underline">
              il atterrira ici ↓
            </a>{" "}
            et y restera jusqu&apos;à ce que tu le coches.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      id="a-faire"
      className="mb-8 scroll-mt-4 rounded-2xl border border-brand/[0.18] bg-brand/[0.035] px-4 py-3.5 sm:px-5 sm:py-4"
    >
      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink flex items-center gap-2.5">
          <span className="h-4 w-[3px] rounded-full bg-brand shrink-0" />
          {num !== undefined && (
            <span className="text-faint font-mono text-[15px]">{num}</span>
          )}{" "}
          Ce que tu dois faire
        </h2>
        {compte && <span className="text-[11.5px] text-muted font-medium">{compte}</span>}
      </div>

      {/* Le rang 3, qui manquait. La section n'avait AUCUN chiffre : elle
          ouvrait sur un titre puis une liste de tâches. Or elle a le meilleur
          chiffre du produit sous la main, et il dormait en section 18 — la part
          des actions jugées qui ont réellement bougé la métrique. Il ne se
          triche pas : c'est le worker qui le calcule, pas le clic. */}
      {jugees > 0 && (
        <div className="mb-2.5">
          <span className="font-mono text-[26px] leading-none font-medium text-ink">
            {gagnantes}
            <span className="text-faint">/{jugees}</span>
          </span>
          <span className="text-[12.5px] text-muted ml-2.5">
            de tes actions jugées ont fait bouger la métrique
          </span>
        </div>
      )}
      {prochain && (
        <p className="text-[11.5px] text-muted mb-2.5">
          Prochain verdict le <span className="font-semibold text-ink">{jour(prochain)}</span> —
          c&apos;est le rendez-vous qui vaut le retour.
        </p>
      )}

      {todo.length > 0 && (
        <div className="divide-y divide-brand/[0.12]">
          {todo.map((a) => (
            <TodoRow key={a.id} a={a} />
          ))}
        </div>
      )}

      {judge.length > 0 && (
        <div className="grid gap-2.5 lg:grid-cols-2 mt-3">
          {judge.map((a) => (
            <JudgeCard key={a.id} a={a} />
          ))}
        </div>
      )}

      {/* Les actions en observation ne sont plus listées ici : le comptage du
          titre les annonce, la ligne de rendez-vous donne leur échéance, et
          leur titre se lit dans « Ton historique d'actions ». Une ligne qui
          répète une date déjà écrite deux fois plus haut n'apporte rien. */}
    </section>
  );
}
