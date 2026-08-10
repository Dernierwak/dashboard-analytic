import type { RepereAction, TrackedAction } from "@/lib/report";
import type { Marqueur } from "@/components/line-chart";

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
            ? `${m.n} actions · sem. du ${libelleSemaine(m.i)}`
            : m.titre
              ? `${court(m.titre)} · ${dateCourte(m.date)}`
              : `action · sem. du ${libelleSemaine(m.i)}`,
      }));
  }
  return (markers ?? [])
    .filter((i) => i >= 0 && i < n)
    .map((i) => ({ i, label: `action · sem. du ${libelleSemaine(i)}` }));
}

type Forme = "pleine" | "creuse" | "barree";
export type Etat = { forme: Forme; couleur: string; cls: string; label: string };

const VERDICT: Record<string, Etat> = {
  better: { forme: "pleine", couleur: "#1a7a4a", cls: "text-pos", label: "ça a marché" },
  worse: { forme: "pleine", couleur: "#c0392b", cls: "text-neg", label: "pas d'effet" },
  stable: { forme: "pleine", couleur: "#b86b00", cls: "text-warn", label: "stable" },
};

export function etat(a: TrackedAction): Etat {
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

export function Pastille({ e }: { e: Etat }) {
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
