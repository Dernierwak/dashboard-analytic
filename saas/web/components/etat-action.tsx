import type { TrackedAction } from "@/lib/report";

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
