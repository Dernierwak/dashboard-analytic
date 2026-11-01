import type { SourcesHebdo } from "@/lib/hebdo/sources";
import { SOURCE } from "@/lib/plateformes";
import { dateFr, dateNue } from "@/lib/jour-de-travail";
import {
  campagnesVides,
  chf,
  lanceeDans,
  nomStatut,
  sansFin,
  termineeDans,
  type Bornes,
  type CampagneFrise,
} from "@/lib/hebdo/frise";

const court = (iso: string | null) => {
  const d = dateNue(iso);
  return d ? dateFr(d) : "—";
};

/** « 12 mars → 30 juin », « 12 mars → sans fin ». */
function dates(c: CampagneFrise): string {
  if (sansFin(c)) return `${court(c.debut)} → sans fin`;
  if (c.fin === null || c.fin === c.debut) return court(c.debut);
  return `${court(c.debut)} → ${court(c.fin)}`;
}

// Les statuts qui se disent sur la carte. « en cours » et « terminée » se lisent
// déjà dans les dates ; « problème signalé par Meta » se dit toujours (spec,
// point 43).
const DITS = new Set(["probleme", "supprimee", "en_pause", "prevue"]);

// L'onglet Campagnes : une carte par campagne qui a tourné pendant la semaine
// choisie, Meta d'abord, puis par dépense de la semaine.
export function PanneauCampagnes({
  campagnes,
  choisie,
  sources,
  mesuree,
}: {
  campagnes: CampagneFrise[];
  choisie: Bornes;
  sources: SourcesHebdo | null;
  /** La semaine choisie est la semaine mesurée par le rapport. */
  mesuree: boolean;
}) {
  if (campagnes.length === 0) {
    return <p className="text-[12.5px] text-muted">{campagnesVides(sources, choisie, mesuree)}</p>;
  }
  const depense = (c: CampagneFrise) => c.depense_par_semaine[choisie.fin] ?? 0;
  const triees = [...campagnes].sort(
    (a, b) =>
      Number(a.plateforme !== "meta") - Number(b.plateforme !== "meta") || depense(b) - depense(a)
  );

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {triees.map((c) => (
        <Carte key={c.id} c={c} choisie={choisie} />
      ))}
    </div>
  );
}

function Carte({ c, choisie }: { c: CampagneFrise; choisie: Bornes }) {
  const src = SOURCE[c.plateforme];
  const montant = c.depense_par_semaine[choisie.fin];
  // Une semaine absente de `depense_par_semaine` n'a enregistré aucune
  // dépense — ce qu'on écrit, sans en faire un « 0 CHF » mesuré.
  const depense =
    montant !== undefined ? `${chf(montant)} cette semaine` : "aucune dépense enregistrée cette semaine";
  const marque = lanceeDans(c, choisie) ? "lancée cette semaine" : termineeDans(c, choisie) ? "terminée cette semaine" : null;

  return (
    <div
      className="group relative min-w-0 overflow-hidden rounded-[10px] border border-line"
      title={`${c.nom} · ${depense}`}
    >
      <div
        className="aspect-square flex items-center justify-center text-[11.5px]"
        style={{ background: `${src.couleur}14`, color: src.couleur }}
      >
        {c.visuels[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.visuels[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          "pas de visuel"
        )}
      </div>
      <div className="px-2 py-1.5 min-w-0">
        <div className="text-[12.5px] font-semibold text-ink truncate">
          <span style={{ color: src.couleur }} aria-label={src.nom}>
            {src.glyphe}
          </span>{" "}
          {c.nom}
        </div>
        <div className="text-[11px] text-faint">{dates(c)}</div>
        {(marque || (c.statut && DITS.has(c.statut)) || !c.statut) && (
          <div className="mt-0.5 flex flex-wrap gap-1 text-[10.5px]">
            {marque && <span className="rounded-full bg-canvas px-1.5 text-muted">{marque}</span>}
            {(!c.statut || DITS.has(c.statut)) && (
              <span className={`rounded-full px-1.5 ${c.statut === "probleme" ? "bg-warn/10 text-warn" : "bg-canvas text-faint"}`}>
                {nomStatut(c)}
              </span>
            )}
          </div>
        )}
      </div>
      <span className="absolute right-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {depense}
      </span>
    </div>
  );
}
