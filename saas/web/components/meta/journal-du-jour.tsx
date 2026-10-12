import { PanneauLateral } from "@/components/meta/panneau";
import { enFrancais } from "@/lib/jour-de-travail";
import type { Carte, NoeudAnnonce, NoeudCampagne, NoeudGroupe, Panneau } from "@/lib/meta/changements";
import { actuel, type Lecture, type Rubrique } from "@/lib/meta/rubriques";

// ── LES CHANGEMENTS, DANS LE PANNEAU LATÉRAL ─────────────────────────────────
//
// Écran validé au ticket 10 de `.scratch/journal-meta/` (point 5), construit au
// ticket 13 : campagne › groupe d'annonces › annonce, chacun dépliable et tout
// ouvert, le trait de la couleur de la campagne terminé par « – ». Sous chaque
// nom, LE STATUT D'ABORD (une chaîne par élément et par jour), puis chaque
// modification. Chaque changement est une petite carte : un titre net (sa
// nature, l'heure à droite, un filet), puis le contenu plus discret — David,
// version 10 : « on a l'impression que c'est un peu tous au même niveau ».
//
// Ce que la carte écrit vient de `extra_data`, lu à l'affichage
// (`lib/meta/rubriques.ts`) : « Actuel » ne montre que ce qui a changé, avec
// sa nouvelle valeur ; le petit « avant / après » montre tout, les lignes
// changées sur un fond léger. Rien n'est traduit. Une forme inconnue écrit la
// phrase de la récolte. Le calcul (quoi montrer, où, combien d'écartés) est
// dans `lib/meta/changements.ts`, testé.
//
// CE QUE LE JOURNAL NE COUVRE PAS NE SE DIT PAS ICI : c'est l'info-bulle de la
// légende de la Tendance, et nulle part ailleurs. Un panneau vide dit
// seulement que Meta n'a rien déclaré.
//
// Sans directive : rendu côté serveur, glissé dans le panneau client. Les
// dépliants sont des `<details>` : ils s'ouvrent sans JavaScript.

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export function JournalChangements({
  panneau,
  titre,
  sousTitre,
  vide,
  parJour,
  fermeture,
}: {
  panneau: Panneau;
  titre: string;
  sousTitre: React.ReactNode;
  /** Ce que dit un panneau sans changement. */
  vide: string;
  /** Plusieurs jours (l'onglet « Changements ») : chaque bloc porte sa date. */
  parJour: boolean;
  fermeture: string;
}) {
  const { total, jours, nonRattaches } = panneau;
  return (
    <PanneauLateral titre={titre} sousTitre={sousTitre} fermeture={fermeture}>
      {total === 0 && <p className="mt-2 text-[14px] text-muted">{vide}</p>}

      <div className="mt-1 space-y-8">
        {jours.map((j) => (
          <section key={j.jour} className="min-w-0 space-y-5" aria-label={parJour ? enFrancais(new Date(`${j.jour}T00:00:00Z`)) : undefined}>
            {parJour && (
              <h3 className="border-b border-line pb-1.5 text-[13px] font-semibold text-ink first-letter:uppercase">
                {enFrancais(new Date(`${j.jour}T00:00:00Z`))}
              </h3>
            )}
            {j.campagnes.map((c) => (
              <BlocCampagne key={c.id ?? "inconnue"} c={c} />
            ))}
          </section>
        ))}
      </div>

      {nonRattaches > 0 && (
        <p className="mt-6 rounded-xl bg-canvas px-4 py-3 text-[13px] text-muted">
          {nonRattaches > 1 ? `${nonRattaches} autres changements` : "Un autre changement"} sur{" "}
          {nonRattaches > 1 ? "des éléments" : "un élément"} dont Pulse n&apos;a pas retrouvé la campagne ou le groupe
          d&apos;annonces : {nonRattaches > 1 ? "ils ne se montrent" : "il ne se montre"} que sans filtre.
        </p>
      )}
    </PanneauLateral>
  );
}

// ── Les dépliants ────────────────────────────────────────────────────────────

/** Les dépliants s'imbriquent : chacun nomme son groupe, sinon la flèche d'un
 *  dépliant fermé tournerait avec celle de son parent ouvert. Classes écrites
 *  en entier pour que Tailwind les trouve. */
const DEPLIANT = {
  campagne: { racine: "group/campagne", fleche: "group-open/campagne:rotate-90" },
  groupe: { racine: "group/groupe", fleche: "group-open/groupe:rotate-90" },
  annonce: { racine: "group/annonce", fleche: "group-open/annonce:rotate-90" },
};
type Depliant = keyof typeof DEPLIANT;

/** Une flèche grande et simple (ticket 10, version 4 : « seulement une flèche
 *  de dépliant plus grande »), qui tourne à l'ouverture. */
function Fleche({ de }: { de: Depliant }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-ink transition-transform duration-150 motion-reduce:transition-none ${DEPLIANT[de].fleche}`} aria-hidden>
      <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Tete({ de, children, compte }: { de: Depliant; children: React.ReactNode; compte: string }) {
  return (
    <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
      <Fleche de={de} />
      {children}
      <span className="ml-auto shrink-0 pl-2 font-mono text-[12px] text-faint">{compte}</span>
    </summary>
  );
}

function Niveau({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-md border border-ink/15 px-1.5 text-[10.5px] font-medium uppercase tracking-wide text-faint">{children}</span>
  );
}

/** Le corps d'un groupe ou d'une annonce : le trait de la couleur de la
 *  campagne, plus pâle pour l'annonce, terminé par un « – » — on voit que
 *  l'annonce est sous son groupe, le groupe sous sa campagne (version 5). */
function Corps({ couleur, pale = false, children }: { couleur: string; pale?: boolean; children: React.ReactNode }) {
  const trait = pale ? `color-mix(in srgb, ${couleur} 45%, transparent)` : couleur;
  return (
    <div className="relative ml-2.5 mt-3.5 min-w-0 space-y-4 border-l-2 pb-2 pl-4" style={{ borderColor: trait }}>
      {children}
      <span className="absolute -left-[2px] bottom-0 h-[2px] w-3.5" style={{ background: trait }} aria-hidden />
    </div>
  );
}

function BlocCampagne({ c }: { c: NoeudCampagne }) {
  return (
    <details open className={`${DEPLIANT.campagne.racine} min-w-0`}>
      <Tete de="campagne" compte={String(c.total)}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.couleur }} aria-hidden />
        <span className="min-w-0 truncate text-[12.5px] font-semibold uppercase tracking-wide text-muted">
          {c.nom ?? "Campagne non retrouvée"}
        </span>
      </Tete>
      <div className="mt-3.5 min-w-0 space-y-4">
        {c.cartes.map((x) => (
          <CarteChangement key={x.id} x={x} />
        ))}
        {c.groupes.map((g, i) => (
          <div key={g.id ?? "inconnu"} className={i > 0 ? "border-t border-line pt-4" : ""}>
            <BlocGroupe g={g} couleur={c.couleur} />
          </div>
        ))}
      </div>
    </details>
  );
}

function BlocGroupe({ g, couleur }: { g: NoeudGroupe; couleur: string }) {
  return (
    <details open className={`${DEPLIANT.groupe.racine} min-w-0`}>
      <Tete de="groupe" compte={pluriel(g.total, "changement")}>
        <Niveau>Groupe</Niveau>
        <span className="min-w-0 truncate text-[15.5px] font-semibold text-ink">{g.nom ?? "Groupe d'annonces non retrouvé"}</span>
      </Tete>
      <Corps couleur={couleur}>
        {g.cartes.map((x) => (
          <CarteChangement key={x.id} x={x} />
        ))}
        {g.annonces.map((a) => (
          <BlocAnnonce key={a.id} a={a} couleur={couleur} />
        ))}
      </Corps>
    </details>
  );
}

function BlocAnnonce({ a, couleur }: { a: NoeudAnnonce; couleur: string }) {
  return (
    <details open className={`${DEPLIANT.annonce.racine} min-w-0`}>
      <Tete de="annonce" compte={String(a.cartes.length)}>
        <Niveau>Annonce</Niveau>
        <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{a.nom}</span>
      </Tete>
      <Corps couleur={couleur} pale>
        {a.cartes.map((x) => (
          <CarteChangement key={x.id} x={x} />
        ))}
      </Corps>
    </details>
  );
}

// ── La carte d'un changement ─────────────────────────────────────────────────

function CarteChangement({ x }: { x: Carte }) {
  return (
    <article className="min-w-0 rounded-xl border border-line bg-canvas px-3.5 py-3">
      <header className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line pb-2">
        <h4 className="min-w-0 text-[14.5px] font-semibold text-ink">{x.nature}</h4>
        {/* L'heure est celle du compte. « UTC » ne s'écrit que pour une ligne
            dont le fuseau n'a pas été récolté : sans le mot, elle se lirait
            comme une heure locale. */}
        <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-faint">
          {x.heure}
          {x.fuseau === null && " UTC"}
        </span>
      </header>
      <div className="mt-2 min-w-0 text-[14px] text-ink [overflow-wrap:anywhere]">
        {x.sorte === "statut" ? <Etapes x={x} /> : <Contenu lecture={x.lecture} phrase={x.phrase} />}
      </div>
    </article>
  );
}

/** « Actif → En attente de traitement 16:10 → En attente d'examen 16:25 →
 *  Actif 16:27 » (ticket 05) : les libellés de Meta, chacun à son heure. */
function Etapes({ x }: { x: Extract<Carte, { sorte: "statut" }> }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[13.5px]">
      {x.etapes.map((e, i) => (
        <span key={i} className="inline-flex min-w-0 items-baseline gap-1.5">
          {i > 0 && <span className="text-faint" aria-label="puis">→</span>}
          <span>{e.libelle}</span>
          {e.heure && <span className="font-mono text-[11px] text-faint">{e.heure}</span>}
        </span>
      ))}
    </p>
  );
}

function Contenu({ lecture, phrase }: { lecture: Lecture; phrase: string }) {
  if (lecture.forme === "rubriques") return <Rubriques rubriques={lecture.rubriques} />;
  return (
    <>
      <p className="text-muted first-letter:uppercase">{phrase}</p>
      {lecture.forme === "creation" && lecture.detail && <p className="mt-1">{lecture.detail}</p>}
    </>
  );
}

/** « Actuel : » — seulement les rubriques qui ont changé, nouvelle valeur ;
 *  puis le petit « avant / après », toutes les rubriques, même celles qui
 *  n'ont pas bougé (ticket 10, version 2). */
function Rubriques({ rubriques }: { rubriques: Rubrique[] }) {
  const changees = actuel(rubriques);
  return (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5">
        <span className="mt-0.5 rounded-md bg-[#eef2ff] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-brand">Actuel</span>
        <div className="min-w-0 space-y-1">
          {changees.length === 0 ? (
            <p className="text-muted">Aucune valeur ne diffère entre avant et après, selon Meta.</p>
          ) : (
            changees.map((r) => (
              <p key={r.nom} className="min-w-0">
                <span className="text-muted">{r.nom} :</span> <b className="font-semibold">{r.apres ?? "retiré"}</b>
              </p>
            ))
          )}
        </div>
      </div>
      <details className="mt-1.5">
        <summary className="inline-block cursor-pointer list-none text-[11.5px] font-medium text-faint underline decoration-dotted underline-offset-[3px] hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
          avant / après
        </summary>
        <table className="mt-1.5 w-full table-fixed border-collapse text-[12px] text-muted">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-faint">
              <th className="w-[26%] px-1.5 py-1 font-semibold">Rubrique</th>
              <th className="px-1.5 py-1 font-semibold">Avant</th>
              <th className="px-1.5 py-1 font-semibold">Après</th>
            </tr>
          </thead>
          <tbody>
            {rubriques.map((r) => (
              <tr key={r.nom} className={`border-t border-line align-top ${r.change ? "bg-[#eef2ff] text-ink" : ""}`}>
                <td className={`px-1.5 py-1.5 ${r.change ? "font-semibold" : ""}`}>{r.nom}</td>
                <td className="px-1.5 py-1.5">{r.avant ?? "—"}</td>
                <td className="px-1.5 py-1.5">{r.apres ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
