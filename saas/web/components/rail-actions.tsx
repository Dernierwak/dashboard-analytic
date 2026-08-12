import type { ChangementPlateforme, TrackedAction } from "@/lib/report";
import {
  CANAL,
  Effet,
  Pastille,
  dateCourte,
  etat,
  phraseChangement,
} from "@/components/etat-action";
import { ActionVivante } from "@/components/action-vivante";
import { NoteLigne } from "@/components/note-ligne";

// LE FIL D'ACTIONS — un rail vertical, une pastille par action, du plus urgent
// au plus ancien. La forme suit ce que l'objet EST : une chronologie.
//
// UN SEUL RAIL, DEUX RÉGIMES. Pas deux traits côte à côte : la grammaire
// n'autorise qu'une forme par module, et deux rails dans une colonne de 300 px
// se liraient comme deux listes sans rapport. Ce qui change entre les deux
// régimes, c'est la PASTILLE (creuse = ça court, pleine = c'est jugé, barrée =
// abandonné — le lexique existe déjà) et la PRÉSENCE DE BOUTONS. Une entrée
// close ne porte aucun bouton, et c'est la différence la plus lisible qui soit.
//
// Les entrées closes sont rendues côté serveur : seules les vivantes ont besoin
// de JavaScript. C'est ce qui justifie que ce composant-ci reste serveur.
//
// LE FIL VOIT AUSSI CE QU'ON N'A PAS FAIT DEPUIS PULSE. Une campagne lancée un
// mardi soir dans le gestionnaire Meta, une autre coupée, une dépense qui
// double : sans elles, le fil raconte un tiers de l'histoire, et quand la
// courbe bouge rien n'explique pourquoi.
//
// Elles ne portent NI pastille NI verdict, et c'est une règle, pas un oubli :
// une pastille ronde désigne ce qu'on a décidé et qui sera jugé, un glyphe de
// canal désigne ce qui s'est simplement produit. On ne juge pas un fait.

const ORDRE: Record<string, number> = { juger: 0, running: 1, observation: 2 };

function rang(a: TrackedAction): number {
  if (a.status === "done" && a.due) return ORDRE.juger;
  if (a.status === "running") return ORDRE.running;
  return ORDRE.observation;
}

export function RailActions({
  actions,
  changements = [],
  themeCourant = null,
  maxH = "max-h-[420px] lg:max-h-[46vh]",
}: {
  actions: TrackedAction[];
  /** Ce qui a bougé sur les plateformes, sans passer par Pulse. */
  changements?: ChangementPlateforme[];
  /** Quand le thème d'une action est celui de la carte, on ne le réécrit pas :
   *  il est déjà en titre 400 px plus haut. Dans le bloc « hors thème », il
   *  varie d'une ligne à l'autre — c'est là qu'il est utile. */
  themeCourant?: string | null;
  maxH?: string;
}) {
  const vivantes = actions
    .filter((a) => a.status === "running" || a.status === "done")
    // L'urgence en haut : « à juger » est la seule chose du rail qui réclame un
    // geste, un tri purement chronologique l'enterrerait sous cinq entrées.
    .sort((a, b) => rang(a) - rang(b) || (a.decided_at < b.decided_at ? 1 : -1));
  // Les actions closes et les changements de plateforme se mêlent, triés par
  // date : ce sont deux sortes de faits révolus, et les séparer obligerait à
  // lire deux chronologies pour reconstituer une semaine.
  type Ligne =
    | { cle: string; date: string; action: TrackedAction }
    | { cle: string; date: string; chg: ChangementPlateforme };
  const closes: Ligne[] = [
    ...actions
      .filter((a) => a.status === "archived" || a.status === "dropped")
      .map((a) => ({ cle: `a-${a.id}`, date: a.decided_at, action: a })),
    ...changements.map((c, i) => ({
      cle: `c-${c.canal}-${c.campagne}-${c.type}-${i}`,
      date: c.date,
      chg: c,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (vivantes.length + closes.length === 0) return null;

  const Entree = ({ a, vivante }: { a: TrackedAction; vivante: boolean }) => {
    const e = etat(a);
    return (
      <div className="relative pl-6 py-2.5">
        <span className="absolute left-0 top-[15px]">
          <Pastille e={e} />
        </span>
        <div className="text-[10px] uppercase tracking-widest text-faint font-semibold">
          {dateCourte(a.decided_at)}
          {a.theme && a.theme !== themeCourant && (
            <span className="text-muted normal-case tracking-normal"> · {a.theme}</span>
          )}
        </div>
        <div className="text-[13.5px] text-ink leading-snug mt-0.5">{a.title}</div>
        {vivante ? (
          // La `key` dépend de l'état : sans elle, l'état local du composant
          // client survit à `revalidatePath` et les deux vues du même objet
          // divergent jusqu'au rechargement.
          <ActionVivante key={`${a.id}:${a.status}`} a={a} />
        ) : (
          <div className="text-[11.5px] mt-0.5 flex items-baseline gap-2 flex-wrap">
            <span className={`font-semibold ${e.cls}`}>{e.label}</span>
            <Effet a={a} />
            {a.kind === "note" && <NoteLigne id={a.id} />}
          </div>
        )}
      </div>
    );
  };

  // UN FAIT, PAS UNE DÉCISION. Le glyphe du canal à la place de la pastille :
  // on voit d'un coup d'œil que ça vient de Meta ou de Google et pas de toi.
  const Fait = ({ c }: { c: ChangementPlateforme }) => {
    const ca = CANAL[c.canal] ?? CANAL.meta;
    return (
      <div className="relative pl-6 py-2.5">
        <span
          className="absolute left-[-2px] top-[11px] text-[11px] leading-none"
          style={{ color: ca.couleur }}
          aria-hidden
        >
          {ca.glyphe}
        </span>
        <div className="text-[10px] uppercase tracking-widest text-faint font-semibold">
          {dateCourte(c.date)}
          <span className="text-muted normal-case tracking-normal">
            {" "}· sur {ca.nom}
            {c.theme && c.theme !== themeCourant && <> · {c.theme}</>}
          </span>
        </div>
        <div className="text-[13px] text-muted leading-snug mt-0.5">
          <b className="text-ink font-semibold">{c.campagne}</b> {phraseChangement(c)}
          {c.detail && <span className="text-faint"> — {c.detail}</span>}
        </div>
      </div>
    );
  };

  const Titre = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] uppercase tracking-widest text-faint/80 font-bold pl-6 pt-2 pb-0.5">
      {children}
    </div>
  );

  return (
    <div className={`${maxH} defile -mx-1 px-1`}>
      <div className="relative">
        {/* Le rail s'arrête à la dernière pastille plutôt que de courir jusqu'au
            bord : un trait qui déborde promet une suite. */}
        <div className="absolute left-[3px] top-[22px] bottom-[22px] w-px bg-ink/[0.14]" />
        {vivantes.length > 0 && closes.length > 0 && <Titre>En cours</Titre>}
        {vivantes.map((a) => (
          <Entree key={a.id} a={a} vivante />
        ))}
        {closes.length > 0 && vivantes.length > 0 && <Titre>Ce qui s&apos;est passé</Titre>}
        {closes.map((l) =>
          "action" in l ? (
            <Entree key={l.cle} a={l.action} vivante={false} />
          ) : (
            <Fait key={l.cle} c={l.chg} />
          )
        )}
      </div>
    </div>
  );
}
