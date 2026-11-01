import type { ReportPayload } from "@/lib/report";
import {
  dateFr,
  dateNue,
  enFrancais,
  horodatage,
  prochainPassage,
} from "@/lib/jour-de-travail";

// ── LE TITRE DE L'HEBDO : LA SEMAINE MESURÉE ─────────────────────────────────
//
// Il absorbe les trois dates qui ouvraient l'ancien rapport : la semaine en
// titre, puis en ligne discrète quand ce texte a été publié et quand il
// changera. Aucune de ces dates ne juge le rapport — un rapport de six jours
// est vieux, pas faux, et rien ne mesure à partir de quand il tromperait
// (`CLAUDE.md` §7) : pas de couleur d'alerte, pas de « il y a N jours ».
//
// LA SEMAINE SE LIT DANS LE PAYLOAD (`semaine`), elle ne se recalcule pas ici :
// c'est le worker qui l'a mesurée, et c'est elle que les chiffres couvrent.
// Un payload publié avant le ticket 01 n'a pas `semaine` : on retombe sur
// `since`/`until` — sa fenêtre réelle, ancrée sur la dernière donnée. Une date
// absente ne s'écrit pas, jamais une date approchée.

/** « du 21 au 27 octobre », ou « du 28 septembre au 4 octobre ». */
function plage(debut: Date, fin: Date): string {
  const memeMois =
    debut.getUTCMonth() === fin.getUTCMonth() && debut.getUTCFullYear() === fin.getUTCFullYear();
  return `du ${memeMois ? debut.getUTCDate() : dateFr(debut)} au ${dateFr(fin)}`;
}

const JOUR_MS = 864e5;

export function TitreSemaine({
  report,
  publieLe,
  jourDeTravail,
  maintenant,
}: {
  report: ReportPayload;
  /** `weekly_reports.updated_at`. */
  publieLe: string | null;
  /** Le Jour de travail du compte, en anglais comme en base. */
  jourDeTravail: string;
  /** L'heure du rendu, lue une fois par la page. */
  maintenant: Date;
}) {
  const debut = dateNue(report.semaine?.debut ?? report.since);
  const fin = dateNue(report.semaine?.fin ?? report.until);
  const pub = horodatage(publieLe);
  const { date: prochain } = prochainPassage(jourDeTravail, maintenant);

  return (
    <header className="mb-6">
      <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.15] text-ink text-balance">
        {debut && fin ? `Semaine ${plage(debut, fin)}` : "La semaine"}
      </h1>
      <p className="text-[12.5px] text-muted mt-1.5">Le jour en cours n&apos;est jamais compté.</p>
      <p className="text-[11px] text-faint mt-1 leading-relaxed">
        {pub && <>Publié le {dateFr(pub)} · </>}
        prochain passage le {enFrancais(prochain)}
      </p>
    </header>
  );
}

// ── LE COMPTE NEUF : UNE SEULE CARTE ─────────────────────────────────────────
//
// Aucun rapport n'existe encore. Les dates sortent du Jour de travail, avec la
// même règle que `weekly_report/blocs/semaine.py` : le premier rapport part au
// prochain passage, et il mesure les 7 jours pleins qui le précèdent.
export function CompteNeuf({
  jourDeTravail,
  maintenant,
}: {
  jourDeTravail: string;
  maintenant: Date;
}) {
  const { date: premier } = prochainPassage(jourDeTravail, maintenant);
  const jour = Date.UTC(premier.getUTCFullYear(), premier.getUTCMonth(), premier.getUTCDate());
  const debut = new Date(jour - 7 * JOUR_MS);
  const fin = new Date(jour - JOUR_MS);

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
      <p className="text-[14px] text-ink font-medium">
        Ton premier rapport arrive le {enFrancais(premier)}.
      </p>
      <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
        Il portera sur la semaine {plage(debut, fin)}.
      </p>
    </div>
  );
}
