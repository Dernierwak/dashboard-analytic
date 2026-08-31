import type { ChangementPlateforme, RepereAction, TrackedAction } from "@/lib/report";
import type { Marqueur } from "@/components/line-chart";
import { Triangle, sensPente } from "@/components/pente";

// L'état d'une action, en un seul endroit.
//
// Ce vocabulaire vivait dans « Ton historique d'actions ». La carte de thème
// montre maintenant les mêmes actions, vues par le petit bout — si les deux
// écrivent chacune leur version de « ça a marché », la même action porte deux
// noms à 800 px d'écart. Un lexique se tient à un seul endroit ou il n'en est
// pas un.
//
// La pastille porte l'ÉTAT, jamais toute seule : le mot reste écrit à côté.
// Une forme qui doit être apprise pour être lue n'est pas une information.

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

export function dateCourte(iso: string): string {
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt.getTime())) return iso;
  return `${dt.getDate()} ${MOIS[dt.getMonth()]}`;
}

// Ce qu'on écrit sur un repère de courbe.
//
// Une étiquette de graphe ne peut pas porter « Passer le budget quotidien de
// 2 000 à 2 500 CHF sur la campagne Trafic » : la pastille ferait la moitié du
// module. On coupe au dernier mot avant 30 signes.
function court(s: string, max = 30): string {
  if (s.length <= max) return s;
  const bout = s.slice(0, max);
  const esp = bout.lastIndexOf(" ");
  return (esp > max * 0.55 ? bout.slice(0, esp) : bout).trimEnd() + "…";
}

/**
 * Compose les étiquettes des repères d'action d'une courbe.
 *
 * Deux formes de payload cohabitent : `marqueurs` (daté et nommé, depuis août
 * 2026) et `markers` (l'index de semaine seul, dans tout ce qui a été publié
 * avant). Un rapport ancien garde donc ses pointillés, sans nom — il ne perd
 * rien, il ne gagne simplement pas le nom.
 *
 * Une semaine qui porte plusieurs actions n'écrit pas plusieurs étiquettes au
 * même endroit : elle dit combien elles sont.
 *
 * `libelleSemaine(i)` renvoie désormais le DERNIER jour de la semaine du point
 * (TASK-039 — les étiquettes des courbes portent la fin de leur semaine, pas
 * son début, pour rester alignées sur `last_full_day`). « sem. du X » ferait
 * croire que X est le premier jour ; on écrit donc « semaine finissant le X ».
 */
export function marqueursCourbe(
  marqueurs: RepereAction[] | undefined,
  markers: number[] | undefined,
  n: number,
  libelleSemaine: (i: number) => string
): Marqueur[] {
  if (marqueurs?.length) {
    return marqueurs
      .filter((m) => m.i >= 0 && m.i < n)
      .map((m) => ({
        i: m.i,
        label:
          m.n > 1
            ? `${m.n} actions · semaine finissant le ${libelleSemaine(m.i)}`
            : m.titre
              ? `${court(m.titre)} · ${dateCourte(m.date)}`
              : `action · semaine finissant le ${libelleSemaine(m.i)}`,
      }));
  }
  return (markers ?? [])
    .filter((i) => i >= 0 && i < n)
    .map((i) => ({ i, label: `action · semaine finissant le ${libelleSemaine(i)}` }));
}

type Forme = "pleine" | "creuse" | "barree" | "note";
export type Etat = { forme: Forme; couleur: string; cls: string; label: string };

const VERDICT: Record<string, Etat> = {
  better: { forme: "pleine", couleur: "#1a7a4a", cls: "text-pos", label: "ça a marché" },
  worse: { forme: "pleine", couleur: "#c0392b", cls: "text-neg", label: "pas d'effet" },
  stable: { forme: "pleine", couleur: "#b86b00", cls: "text-warn", label: "stable" },
};

// VRAIE DÉCISION CLIENT, PEU IMPORTE LE `status` ACTUEL — même règle que
// `estDecisionClient` (`lib/report.ts`), redéfinie ici plutôt que réimportée :
// ce fichier est chargé par des composants CLIENT (`action-vivante.tsx`), et
// `lib/report.ts` entraîne `next/headers` avec lui dans leur bundle dès qu'on
// y importe autre chose qu'un type (piège CLAUDE.md §8 — vu à l'inverse ici :
// pas une constante qui fuit du client vers le serveur, mais un module serveur
// qui fuit dans le client).
function estDecisionClient(a: TrackedAction): boolean {
  return a.origin !== "auto" || Boolean(a.done_at);
}

export function etat(a: TrackedAction): Etat {
  // Une note n'a ni indicateur ni échéance : rien à juger, donc pas de verdict.
  // Elle prend un glyphe, pas une pastille — même règle que les changements de
  // plateforme : le rond est réservé à ce qu'on a décidé et qui sera mesuré.
  if (a.kind === "note")
    return { forme: "note", couleur: "#8b8e98", cls: "text-faint", label: "ta note" };
  // « ✓ Vu — je range » et « × j'abandonne » sont accessibles directement
  // depuis l'état `"auto"` (voir `action-vivante.tsx`) : dès l'un des deux
  // cliqué, `status` devient `"archived"`/`"dropped"` SANS que le client ait
  // jamais rien décidé lui-même (rejet du checker, 3e passe). La pastille
  // PLEINE et les mots « rangée »/« abandonnée » sont réservés aux vraies
  // décisions — `estDecisionClient` (lit `origin`, durable) tranche, pas
  // `status` (qui a justement changé).
  if (a.status === "dropped")
    return estDecisionClient(a)
      ? { forme: "barree", couleur: "#8b8e98", cls: "text-faint", label: "abandonnée" }
      : { forme: "creuse", couleur: "#8b8e98", cls: "text-faint", label: "hypothèse écartée" };
  if (a.status === "archived")
    return a.verdict
      ? VERDICT[a.verdict] ?? VERDICT.stable
      : estDecisionClient(a)
        ? { forme: "pleine", couleur: "#5a5d66", cls: "text-muted", label: "rangée" }
        : { forme: "creuse", couleur: "#5a5d66", cls: "text-muted", label: "hypothèse rangée" };
  if (a.status === "done")
    return a.due
      ? { forme: "creuse", couleur: "#b86b00", cls: "text-warn", label: "à juger" }
      : { forme: "creuse", couleur: "#1a7a4a", cls: "text-pos", label: "en observation" };
  // `"auto"` : l'hypothèse d'un thème, posée par le worker sans clic (voir
  // `build_report.py`). Le label ne doit JAMAIS laisser croire que le client
  // l'a prise ou faite — d'où un mot différent des deux autres états, à
  // chaque palier.
  if (a.status === "auto")
    return a.due
      ? { forme: "creuse", couleur: "#b86b00", cls: "text-warn", label: "hypothèse à juger" }
      : { forme: "creuse", couleur: "#1a7a4a", cls: "text-pos", label: "suivie automatiquement" };
  return { forme: "creuse", couleur: "#1a56ff", cls: "text-brand", label: "à faire" };
}

export function Pastille({ e }: { e: Etat }) {
  if (e.forme === "note")
    return (
      <span className="block text-[10px] leading-none text-faint -ml-[1.5px]" aria-hidden>
        ✎
      </span>
    );
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

// CE QU'UNE ACTION A DONNÉ, en une ligne.
//
// L'historique disait « date · titre · état » : le classement d'une action,
// pas son résultat. Ce qui manquait est en base depuis le premier jour du
// suivi — l'indicateur surveillé, sa valeur à la décision, sa valeur au
// verdict. « CTR 3,1 → 5,8 ▲ +87 % » répond à la seule question qu'on se pose
// en relisant ce qu'on a fait.
export function Effet({ a }: { a: TrackedAction }) {
  if (!a.metric_label) return null;
  if (a.then === undefined || a.now === undefined) {
    return <span className="text-faint"> · on suit {a.metric_label}</span>;
  }
  // Le VERDICT décide du sens, pas le delta brut. Un verdict « stable » à côté
  // d'un « ▲ +1 % » se contredit à l'œil : le worker a son seuil, l'affichage
  // n'en invente pas un second.
  const s = sensPente(a.verdict === "stable" ? 0 : a.delta, false, 0.5);
  return (
    <span className="text-faint">
      {" "}
      · {a.metric_label} <b className="text-muted">{a.then}</b> →{" "}
      <b className="text-ink">{a.now}</b>
      {a.delta != null && !s.plat && (
        <span className={`font-semibold ${s.cls}`}>
          {" "}
          <Triangle sens={s.monte ? "haut" : "bas"} /> {a.delta > 0 ? "+" : ""}
          {a.delta.toFixed(0)} %
        </span>
      )}
    </span>
  );
}

// D'OÙ VIENT UN CHIFFRE, EN UN SIGNE.
//
// Convention maison, déjà en place dans la frise, la nav et l'anneau : ▣ Meta
// en bleu, ◆ Google en vert, ◎ Instagram en violet. Elle était recopiée dans
// quatre fichiers ; elle se tient ici, avec le reste du lexique.
//
// Deux entrées de plus que les canaux publicitaires, parce que la provenance
// d'un chiffre ne se limite pas à eux : `instagram` (l'organique) et `site`
// (Google Analytics). Ce dernier prend un losange CREUX et non le losange plein
// de Google Ads — même famille, régie différente, et confondre les deux ferait
// couper Google Ads à qui croit lire son trafic.
//
// `surSombre` n'est pas un raffinement : ces teintes sont choisies pour du
// texte sur blanc, et #1a56ff sur un fond encre est illisible. Une cellule
// sélectionnée s'inverse — il lui faut la version claire.
export const SOURCE: Record<
  string,
  { glyphe: string; couleur: string; surSombre: string; nom: string }
> = {
  meta: { glyphe: "▣", couleur: "#1a56ff", surSombre: "#8fadff", nom: "Meta" },
  google: { glyphe: "◆", couleur: "#1a7a4a", surSombre: "#5fd09a", nom: "Google" },
  instagram: { glyphe: "◎", couleur: "#7b4fff", surSombre: "#bda6ff", nom: "Instagram" },
  site: { glyphe: "◇", couleur: "#5b6472", surSombre: "#c2c8d2", nom: "Google Analytics" },
};

/** Les deux régies publicitaires seules — ce qui peut porter un CHANGEMENT. */
export const CANAL: Record<string, { glyphe: string; couleur: string; nom: string }> = {
  meta: SOURCE.meta,
  google: SOURCE.google,
};

// CE QU'ON ÉCRIT D'UN CHANGEMENT DE PLATEFORME.
//
// Il n'a ni indicateur ni verdict : ce n'est pas une décision qu'on peut
// juger, c'est un FAIT daté. D'où la règle de forme qui l'accompagne — une
// pastille ronde pour ce qu'on a décidé et qui sera jugé, un glyphe pour ce
// qui s'est simplement produit.
export function phraseChangement(c: ChangementPlateforme): string {
  switch (c.type) {
    case "lancee":
      return "lancée";
    case "arretee":
      return "s'est arrêtée";
    case "reprise":
      return "a repris";
    case "planifiee":
      return "est programmée — elle n'a pas encore commencé";
    // Une campagne dont la date de départ est PASSÉE et qui n'a jamais rien
    // dépensé n'est pas « programmée » : elle n'a pas démarré. La nuance n'est
    // pas de langue, c'est la différence entre une annonce et un problème.
    case "jamais_lancee":
      return "devait démarrer, et n'a rien dépensé";
    case "depense":
      return "sa dépense quotidienne a changé";
    default:
      return "a changé";
  }
}

// LE POINT D'ÉTAPE À SEPT JOURS — à mi-parcours, pas un verdict.
//
// Attendre quatorze jours pour découvrir qu'on part dans le mur, c'est deux
// semaines de budget perdues. Mais un signal précoce qui contredit le verdict
// final ruine le verdict : celui-ci ne s'affiche que si le mouvement dépasse
// 10 %, et il ne dit JAMAIS « ça a marché » — seulement vers où ça penche.
// C'est le worker qui tranche, quatorze jours plus tard, et lui seul.
export function Etape({ a }: { a: TrackedAction }) {
  const e = a.etape;
  if (!e || !a.metric_label) return null;
  const bon = e.sens === "bon";
  return (
    <div className={`text-[11.5px] mt-1 ${bon ? "text-pos" : "text-warn"}`}>
      <span className="font-semibold">
        À {e.jours} jours, ça penche {bon ? "dans le bon sens" : "dans le mauvais sens"}
      </span>
      <span className="text-faint font-normal">
        {" "}— {a.metric_label} {e.delta > 0 ? "+" : ""}
        {e.delta.toFixed(0)} %. Rien n&apos;est joué : le verdict tombe le{" "}
        {dateCourte(a.check_at)}.
      </span>
    </div>
  );
}
