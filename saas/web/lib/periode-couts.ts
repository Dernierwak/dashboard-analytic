export const MOIS_ABR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

export function dParse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function dIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dAjout(s: string, n: number): string {
  const d = dParse(s);
  d.setDate(d.getDate() + n);
  return dIso(d);
}

export function dJours(from: string, to: string): number {
  return Math.round((dParse(to).getTime() - dParse(from).getTime()) / 86_400_000) + 1;
}

export function dCourt(s: string): string {
  const d = dParse(s);
  return `${String(d.getDate()).padStart(2, "0")} ${MOIS_ABR[d.getMonth()]}`;
}

export type FiltrePeriodeCouts = {
  jours?: number;
  p?: string;
  from?: string;
  to?: string;
};

export type ReperesPeriodeCouts = {
  ancre: string;
  premier: string | null;
  yearStart: string;
  monthStart: string;
};

export type PeriodeCouts = {
  from: string;
  to: string;
  max: string;
  jours: number;
  preset: string;
  presetJours: number;
  titre: string;
  bornes: string;
  pas: "jour" | "semaine";
};

/** Résout une demande de période sans jamais produire une fenêtre inversée. */
export function resoudrePeriode(
  f: FiltrePeriodeCouts,
  r: ReperesPeriodeCouts
): PeriodeCouts {
  const valide = (s?: string) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));
  let from: string;
  let to = r.ancre;
  let preset: string;
  let presetJours = -1;
  let titre: string;

  if (valide(f.from) && valide(f.to) && f.from! <= f.to!) {
    from = f.from!;
    to = f.to! > r.ancre ? r.ancre : f.to!;
    preset = "custom";
    titre = "";
  } else if (f.jours !== undefined || (f.p !== "mois" && f.p !== "an")) {
    presetJours = f.jours ?? (f.p === "30" ? 30 : f.p === "90" ? 90 : 7);
    preset = String(presetJours);
    if (presetJours === 0) {
      from = r.premier ?? r.yearStart;
      titre = "depuis le début";
    } else {
      from = dAjout(r.ancre, -(presetJours - 1));
      titre = `${presetJours} derniers jours`;
    }
  } else if (f.p === "mois") {
    from = r.monthStart;
    preset = "mois";
    titre = "ce mois-ci";
  } else {
    from = r.yearStart;
    preset = "an";
    titre = "depuis janvier";
  }

  // Une demande entièrement après l'ancre ne doit jamais devenir `from > to`.
  // On la rabat sur le dernier jour plein, seule date honnête à afficher.
  if (from > to) {
    from = to;
    titre = "";
  }
  if (preset === "custom") titre = `du ${dCourt(from)} au ${dCourt(to)}`;

  const jours = dJours(from, to);
  const bornes = `du ${dCourt(from)} au ${dCourt(to)} · ${jours} jour${jours > 1 ? "s" : ""}`;
  return {
    from,
    to,
    max: r.ancre,
    jours,
    preset,
    presetJours,
    titre: titre || bornes.split(" · ")[0],
    bornes,
    pas: jours > 70 ? "semaine" : "jour",
  };
}
