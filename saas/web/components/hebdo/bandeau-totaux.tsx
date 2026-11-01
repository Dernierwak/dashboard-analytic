import type { ReportPayload } from "@/lib/report";
import { chf, entier } from "@/lib/hebdo/format";
import type { SourcesHebdo } from "@/lib/hebdo/sources";
import { SOURCE } from "@/lib/plateformes";

// ── LE BANDEAU DES TOTAUX : DÉPENSE ET IMPRESSIONS DE LA SEMAINE ─────────────
//
// Les deux seules mesures qui s'additionnent entre plateformes (spec hebdo,
// « chaque plateforme se lit avec ses propres chiffres ») ; une portée ou un
// CTR additionnés mélangeraient des définitions propres à chaque régie. Ni
// barre, ni anneau, ni colonne portée (carte 16) : deux colonnes, un filet.
//
// LE GRAND CHIFFRE ET LA NOTE SE CALCULENT ICI, le payload ne porte que la
// valeur de chaque source (`blocs/sources.py`). Une source à `null` — jeton
// mort ou panne — n'entre pas dans la somme et s'écrit « — », jamais 0
// (`CLAUDE.md` §7) ; la note la nomme, pour qu'un total partiel ne passe pas
// pour complet. Une source pas branchée n'a pas d'entrée : elle n'apparaît pas.
//
// Un payload publié avant le ticket 04 n'a ni `sources` ni `totaux` : rien.

type Valeurs = Partial<Record<string, number | null>>;
type Colonne = { titre: string; valeurs: Valeurs; format: (n: number) => string };

const ORDRE = ["meta", "google"] as const;

function listeNoms(noms: string[]): string {
  return noms.length < 2 ? noms.join("") : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

function CelluleTotal({ colonne, canaux }: { colonne: Colonne; canaux: string[] }) {
  const presentes = canaux
    .map((c) => colonne.valeurs[c])
    .filter((v): v is number => typeof v === "number");
  const total = presentes.length ? presentes.reduce((a, b) => a + b, 0) : null;

  return (
    <div className="min-w-0 px-4 sm:px-6 first:pl-0 last:pr-0">
      <p className="text-[11px] uppercase tracking-[0.08em] text-faint">{colonne.titre}</p>
      <p className="font-serif text-[24px] sm:text-[30px] leading-tight text-ink tabular-nums mt-1 truncate">
        {total === null ? "—" : colonne.format(total)}
      </p>
      <ul className="mt-2 space-y-0.5">
        {canaux.map((c) => {
          const v = colonne.valeurs[c];
          const s = SOURCE[c];
          return (
            <li key={c} className="flex items-baseline gap-1.5 text-[12px] text-muted min-w-0">
              <span aria-hidden style={{ color: s?.couleur }}>{s?.glyphe}</span>
              <span className="truncate">{s?.nom ?? c}</span>
              <span className="ml-auto tabular-nums text-ink">
                {typeof v === "number" ? colonne.format(v) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BandeauTotaux({ report }: { report: ReportPayload }) {
  const sources: SourcesHebdo | null | undefined = report.sources;
  const totaux = report.totaux;
  if (!sources || !totaux) return null;

  const canaux = ORDRE.filter((c) => c in sources);
  if (!canaux.length) return null;

  // Même ensemble pour les deux colonnes : une source se tait sur les deux à
  // la fois (`etat ≠ recolte`), on la nomme donc une seule fois.
  const absentes = canaux.filter((c) => typeof totaux.depense?.[c] !== "number");

  const colonnes: Colonne[] = [
    { titre: "Dépense", valeurs: totaux.depense ?? {}, format: chf },
    { titre: "Impressions", valeurs: totaux.impressions ?? {}, format: entier },
  ];

  return (
    <section className="bg-white border border-line rounded-xl shadow-card p-4 sm:p-5 mb-6">
      <div className="grid grid-cols-2 divide-x divide-line">
        {colonnes.map((col) => (
          <CelluleTotal key={col.titre} colonne={col} canaux={canaux} />
        ))}
      </div>
      {absentes.length > 0 && (
        <p className="text-[11.5px] text-muted mt-3 pt-3 border-t border-line leading-relaxed">
          {absentes.length === canaux.length
            ? `${listeNoms(absentes.map((c) => SOURCE[c]?.nom ?? c))} n'${absentes.length > 1 ? "ont" : "a"} pas répondu cette semaine : aucun total.`
            : `Total sans ${listeNoms(absentes.map((c) => SOURCE[c]?.nom ?? c))}, qui n'a pas répondu cette semaine.`}
        </p>
      )}
    </section>
  );
}
