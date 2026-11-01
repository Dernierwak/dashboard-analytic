import Link from "next/link";
import { chf, entier } from "@/lib/hebdo/format";
import type { CanalHebdo, EtatSource, SemaineHebdo, SourcesHebdo } from "@/lib/hebdo/payload";
import { PAGE_CANAL, RATIOS, SEMAINES_MINIMUM, jugement, type Jugement } from "@/lib/hebdo/canaux";
import { SOURCE } from "@/lib/plateformes";
import { Moustache } from "@/components/hebdo/moustache";
import { ChangementsCanal } from "@/components/hebdo/changements-canal";

// ── LA CARTE D'UN CANAL : SES VOLUMES, ET SES RATIOS FACE À SES HABITUDES ────
//
// Chaque plateforme se lit avec ses propres chiffres (`docs/adr/0010`) : une
// carte par canal, rien d'additionné. À gauche les volumes de la semaine puis
// CTR, CPC et CPM sur leur moustache ; à droite les changements (ticket 06).
//
// LES ÉTATS (spec hebdo, tableau des états) : un jeton mort ou une panne
// rendent « — » partout, jamais 0 (`CLAUDE.md` §7), sans moustache — le
// premier avec le lien qui répare, la seconde sans bouton, parce que la
// relance est à nous. Sous 6 semaines d'historique, la valeur reste sans
// couleur : on ne juge pas sur trop peu.

const PHRASE_PANNE = (nom: string) =>
  `Une erreur est survenue pendant la récolte de ${nom}. Nous la relançons dès que possible.`;

const MOT: Record<Jugement, { texte: string; classe: string }> = {
  mieux: { texte: "mieux que tes habitudes", classe: "text-pos" },
  moins: { texte: "moins bien que tes habitudes", classe: "text-neg" },
  dans: { texte: "dans tes habitudes", classe: "text-muted" },
};

function Volumes({ volumes }: { volumes: CanalHebdo["volumes"] | null }) {
  const cases: [string, number | null | undefined, (n: number) => string][] = [
    ["Dépense", volumes?.depense, chf],
    ["Impressions", volumes?.impressions, entier],
    ["Clics", volumes?.clics, entier],
  ];
  return (
    <div className="grid grid-cols-3 gap-4 mb-3">
      {cases.map(([nom, v, format]) => (
        <div key={nom} className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-faint">{nom}</p>
          <p className="font-serif text-[20px] sm:text-[24px] leading-tight text-ink tabular-nums truncate">
            {typeof v === "number" ? format(v) : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

function LigneRatio({ def, donnees, lu }: { def: (typeof RATIOS)[number]; donnees: CanalHebdo; lu: boolean }) {
  const ratio = donnees.ratios?.[def.cle];
  const valeur = lu ? ratio?.valeur ?? null : null;
  const juge = lu && ratio ? jugement(ratio, def.mieux) : null;
  const avecHistorique = lu && ratio && ratio.mediane !== null;

  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)] gap-4 items-center py-2.5 border-t border-line">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.08em] text-faint">{def.nom}</p>
        <p className="text-[18px] font-medium text-ink tabular-nums leading-tight">
          {valeur === null ? "—" : def.format(valeur)}
        </p>
        {juge && valeur !== null && (
          <p className={`text-[11px] leading-snug ${MOT[juge].classe}`}>{MOT[juge].texte}</p>
        )}
        {/* Le nombre de semaines se dit aussi sous le seuil : « encore 2 » se
            lit mieux à côté de « sur 4 semaines ». */}
        {lu && ratio && ratio.n > 0 && (
          <p className="text-[10.5px] text-faint">
            sur {ratio.n} semaine{ratio.n > 1 ? "s" : ""}
          </p>
        )}
      </div>
      <div className="min-w-0">
        {!lu ? null : avecHistorique ? (
          <>
            <Moustache ratio={ratio} def={def} juge={juge} />
            {/* Sans valeur cette semaine (dénominateur nul), la moustache n'a
                pas de gros point : on le dit, au lieu d'un dessin muet. */}
            {valeur === null && <p className="text-[11px] text-muted">— cette semaine</p>}
          </>
        ) : (
          <p className="text-[12px] text-muted">
            Semaine type dès {SEMAINES_MINIMUM} semaines d&apos;historique — encore{" "}
            {SEMAINES_MINIMUM - (ratio?.n ?? 0)}
          </p>
        )}
      </div>
    </div>
  );
}

export function CarteCanal({
  canal,
  donnees,
  etat,
  journal,
  semaine,
}: {
  canal: string;
  donnees: CanalHebdo;
  etat: EtatSource | undefined;
  journal: SourcesHebdo[string]["journal"] | undefined;
  semaine: SemaineHebdo | null | undefined;
}) {
  const source = SOURCE[canal];
  const nom = source?.nom ?? canal;
  // Sans état connu, on ne présente pas des chiffres comme récoltés.
  const lu = etat === "recolte";

  return (
    <article
      className="bg-white border border-line rounded-xl shadow-card px-4 py-4 sm:px-6 sm:py-5 border-t-[3px]"
      style={{ borderTopColor: source?.couleur }}
    >
      <Link
        href={PAGE_CANAL[canal] ?? "/"}
        className="inline-flex items-baseline gap-1.5 mb-3 text-ink hover:underline"
      >
        <span aria-hidden style={{ color: source?.couleur }}>{source?.glyphe}</span>
        <span className="font-serif text-[18px]">{nom}</span>
        <span className="text-muted" aria-hidden>→</span>
      </Link>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <div className="min-w-0 lg:flex-[1.9]">
          {etat === "jeton_mort" && (
            <p className="text-[12.5px] text-warn bg-warn/5 border border-warn/20 rounded-lg px-3 py-2 mb-3 leading-relaxed">
              La connexion à {nom} a expiré : ses chiffres de la semaine n&apos;ont pas pu être lus.{" "}
              <Link href="/comptes" className="underline font-medium">Reconnecter {nom} dans Connexions →</Link>
            </p>
          )}
          {etat === "panne" && (
            <p className="text-[12.5px] text-muted bg-canvas border border-line rounded-lg px-3 py-2 mb-3 leading-relaxed">
              {PHRASE_PANNE(nom)}
            </p>
          )}
          <Volumes volumes={lu ? donnees.volumes : null} />
          {RATIOS.map((def) => (
            <LigneRatio key={def.cle} def={def} donnees={donnees} lu={lu} />
          ))}
          {lu && (
            <p className="text-[11px] text-faint mt-2 leading-relaxed max-w-[70ch]">
              « Tes habitudes » : la moitié centrale de tes semaines récentes ; « semaine type » :
              leur médiane. Le mieux est toujours à droite.
            </p>
          )}
        </div>
        <div className="min-w-0 lg:flex-1 empty:hidden">
          <ChangementsCanal canal={canal} donnees={donnees} journal={journal} semaine={semaine} />
        </div>
      </div>
    </article>
  );
}
