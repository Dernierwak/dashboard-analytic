// ── LE JOURNAL GOOGLE À L'ÉCRAN ──────────────────────────────────────────────
//
// Spec Google, § « Panneau latéral » ; user stories 29 à 32. Ce que Google Ads
// DÉCLARE avoir changé (`change_event`, récolté dans `platform_changes`)
// devient un point par jour sur la courbe principale de la Tendance, et se lit
// dans le Panneau latéral, rangé par campagne. Patron : `lib/meta/changements.ts`,
// en plus simple — une ligne Google ne dit ni le niveau (groupe, annonce) ni
// l'élément touché, seulement la campagne et une phrase qui le nomme.
//
// LE FILTRE PASSE PAR L'ID DE CAMPAGNE. Google pose la campagne sur chaque
// `change_event`, groupe d'annonces, mot-clé et annonce compris : filtrer par
// elle garde donc tout ce qui est dessous. Une ligne sans campagne (un élément
// posé au niveau du compte) ne se montre que SANS filtre, et le panneau filtré
// la COMPTE : la taire ferait croire que la journée est complète.
//
// LE JOUR EST CELUI ÉCRIT PAR GOOGLE, SANS CONVERSION. `change_date_time` est
// l'heure du compte sans décalage ; le `timestamptz` la garde telle quelle
// comme si c'était de l'UTC (`lib/changements-api.ts`, `jourDuCompte`). Les
// dix premiers caractères sont donc le jour du compte — celui des insights, où
// l'effet apparaît —, et appliquer un fuseau le fausserait.
//
// Sans directive : lu par le serveur, le navigateur (le panneau se calcule
// sans relire la page) et le harnais Node (`CLAUDE.md` §8).

import type { Campagne, Periode } from "./lecture";

/** Une ligne de `platform_changes` (channel = 'google'), telle que PostgREST
 *  la rend. Les colonnes `fuseau`, `niveau`, `object_id`… restent NULL chez
 *  Google : elles ne sont pas lues. */
export type LigneChangementGoogle = {
  change_id: string | null;
  occurred_at: string | null;
  categorie: string | null;
  campaign_id: string | number | null;
  campaign_name: string | null;
  resume: string | null;
};

export type ChangementGoogle = {
  id: string;
  /** YYYY-MM-DD, jour du compte. */
  jour: string;
  /** « 14:02 », heure du compte. */
  heure: string;
  /** L'ordre du panneau. */
  instant: number;
  nature: string;
  /** `null` = la récolte n'a pas retrouvé la campagne. */
  campagneId: string | null;
  campagneNom: string | null;
  /** Rédigée à la récolte (`_traduire_google`) ; elle nomme l'élément touché. */
  phrase: string;
};

/**
 * Ce que Pulse garde du journal Google, par catégorie. COPIE MOT POUR MOT de
 * `CE_QUE_PULSE_GARDE` dans
 * `saas/data/fetch_data/sources/google/ads/fetchers/changes.py`, qui est la
 * source : la récolte n'écrit que ce qu'elle sait nommer. Le harnais 06 lit
 * le fichier Python et compare — une catégorie ajoutée d'un côté le fait échouer.
 */
export const CE_QUE_PULSE_GARDE: Record<string, string> = {
  budget: "les budgets quotidiens",
  enchere: "les enchères au clic, les stratégies d'enchères, les coûts par acquisition et retours publicitaires visés",
  motcle: "les mots-clés ajoutés, supprimés, mis en pause ou réactivés",
  statut: "les mises en pause, réactivations et suppressions de campagnes et de groupes d'annonces",
  creatif: "les annonces ajoutées ou retirées, et les éléments (titres, descriptions, images, vidéos, siteliens, accroches…) créés, modifiés, ajoutés ou retirés",
  autre: "les campagnes créées",
};

/** Le titre d'une carte, par catégorie. `autre` ne couvre aujourd'hui que la
 *  création de campagne, mais la catégorie ne le garantit pas : le titre reste
 *  générique, la phrase dit le geste. */
const NATURES: Record<string, string> = {
  budget: "Budget",
  enchere: "Enchère",
  motcle: "Mot-clé",
  statut: "Statut",
  creatif: "Annonce ou élément",
};
const NATURE_INCONNUE = "Autre réglage";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 12 août 2026 » — l'année toujours : la date du début du journal peut
 *  remonter à une autre année que celle qu'on regarde. */
function dateLongue(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  return `${j} ${MOIS[m - 1]} ${a}`;
}

/**
 * Le texte de la « ⓘ » de la légende : depuis quand le journal existe, et ce
 * qu'il garde. Dit ICI et nulle part ailleurs, comme sur Meta.
 *
 * `debut` = `sans_trou_depuis` de `couverture_recolte` (google, journal) : à la
 * première récolte, 30 jours avant elle, puisque `change_event` ne remonte pas
 * plus loin ; après une panne plus longue que 30 jours, le début du dernier
 * passage — avant, le journal a un trou. `null` = pas lisible (aucune récolte
 * encore, ou un Membre invité : la table n'est lisible que par son
 * propriétaire) ; on dit qu'on ne sait pas plutôt que d'inventer une date.
 */
export function aideJournal(debut: string | null): string {
  const depuis = debut
    ? `Pulse le tient sans trou depuis le ${dateLongue(debut)}`
    : "La date où le journal de Pulse commence n'a pas pu être lue";
  return (
    "Les points viennent du journal que Google Ads tient de ton compte. Google n'en rend que les 30 derniers jours : " +
    `${depuis}, et rien n'existe avant. Pulse n'en garde que ${Object.values(CE_QUE_PULSE_GARDE).join(" ; ")}. ` +
    "Tout autre geste n'a pas de point, comme un ciblage par âge, audience ou emplacement, le contenu d'une annonce modifié, ou un réglage du compte. " +
    "Un jour sans point n'est donc pas un jour où rien n'a changé."
  );
}

/** L'ID d'une campagne : PostgREST le rend en texte ou en nombre, et une
 *  chaîne vide veut dire « pas retrouvée ». */
const idCampagne = (x: string | number | null): string | null => (x === null || x === "" ? null : String(x));

/** Une ligne de base → un changement, ou `null` sans date lisible ni phrase. */
export function changementDe(r: LigneChangementGoogle): ChangementGoogle | null {
  const phrase = r.resume?.trim();
  if (!phrase || !r.occurred_at) return null;
  const instant = new Date(r.occurred_at).getTime();
  if (isNaN(instant)) return null;
  const brut = r.occurred_at.replace(" ", "T");
  return {
    id: String(r.change_id ?? `${r.occurred_at}|${phrase}`),
    jour: brut.slice(0, 10),
    heure: brut.slice(11, 16),
    instant,
    nature: NATURES[String(r.categorie ?? "")] ?? NATURE_INCONNUE,
    campagneId: idCampagne(r.campaign_id),
    campagneNom: r.campaign_name?.trim() || null,
    phrase,
  };
}

/** Sous le filtre du Bandeau (`campagne`, par ID), ou tout sans filtre. */
const visible = (c: ChangementGoogle, campagne: string | null) => campagne === null || c.campagneId === campagne;

export type MarqueJour = {
  /** La place du jour dans `dates`. */
  index: number;
  nombre: number;
};

/** Un point par JOUR qui a au moins un changement visible, pas un par
 *  changement : trois gestes à la même heure se chevaucheraient. */
export function joursMarques(changements: ChangementGoogle[], campagne: string | null, dates: string[]): MarqueJour[] {
  const parJour = new Map<string, number>();
  for (const c of changements) if (visible(c, campagne)) parJour.set(c.jour, (parJour.get(c.jour) ?? 0) + 1);
  return dates.flatMap((d, index) => (parJour.has(d) ? [{ index, nombre: parJour.get(d)! }] : []));
}

/** Le jour demandé par l'URL, s'il est dans la période. Un jour hors de la
 *  période ne s'ouvre pas : on lirait des changements sans les chiffres qui
 *  vont avec. La période exclut déjà le jour en cours. */
export function jourOuvertDe(x: string | undefined, periode: Periode): string | null {
  if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return null;
  const d = new Date(`${x}T00:00:00Z`);
  // `Date` accepte le 30 février et le reporte au 2 mars : on refuse.
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== x) return null;
  return x >= periode.debut && x <= periode.fin ? x : null;
}

export type CarteChangement = { id: string; heure: string; nature: string; phrase: string };

export type NoeudCampagne = {
  /** `null` = des changements dont la récolte n'a pas retrouvé la campagne. */
  id: string | null;
  nom: string | null;
  couleur: string;
  /** Dans l'ordre des heures. */
  cartes: CarteChangement[];
};

export type PanneauJour = {
  total: number;
  campagnes: NoeudCampagne[];
  /** Ceux que le filtre écarte faute de campagne : ils ne se montrent pas,
   *  mais se comptent. */
  nonRattaches: number;
};

/** Même gris que la pastille d'une campagne inconnue (`PASTILLE_NEUTRE`). */
const GRIS_INCONNU = "#c3c2bb";

/**
 * Le Panneau du jour : les changements visibles de `jour`, un bloc par
 * campagne dans l'ordre de son premier changement, la campagne inconnue en
 * dernier. Le nom est celui des insights (le plus récent, comme le Bandeau),
 * sinon celui écrit avec le changement.
 */
export function panneauDe(changements: ChangementGoogle[], jour: string, campagne: string | null, campagnes: Campagne[]): PanneauJour {
  const duJour = changements.filter((c) => c.jour === jour).sort((a, b) => a.instant - b.instant);
  const montres = duJour.filter((c) => visible(c, campagne));
  const blocs = new Map<string | null, ChangementGoogle[]>();
  for (const c of montres) blocs.set(c.campagneId, [...(blocs.get(c.campagneId) ?? []), c]);
  const noeuds = [...blocs.entries()]
    .sort(([a], [b]) => Number(a === null) - Number(b === null))
    .map(([id, lignes]): NoeudCampagne => {
      const connue = id === null ? undefined : campagnes.find((c) => c.cle === id);
      return {
        id,
        nom: id === null ? null : connue?.nom ?? lignes.find((l) => l.campagneNom)?.campagneNom ?? id,
        couleur: connue?.couleur ?? GRIS_INCONNU,
        cartes: lignes.map((l) => ({ id: l.id, heure: l.heure, nature: l.nature, phrase: l.phrase })),
      };
    });
  return {
    total: montres.length,
    campagnes: noeuds,
    nonRattaches: campagne === null ? 0 : duJour.filter((c) => c.campagneId === null).length,
  };
}
