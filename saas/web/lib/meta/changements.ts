// ── LES CHANGEMENTS POSÉS SUR LA TENDANCE ────────────────────────────────────
//
// Spec, § « Le journal des changements » et § « L'état de la page vit dans
// l'URL » ; user stories 22 à 26, 44 à 46. Harnais :
// `.scratch/meta-ads/harnais/11-les-changements/`.
//
// Ce que Meta DÉCLARE avoir changé (`platform_changes`, récolté au ticket 04)
// devient un point par jour sur la courbe principale, et le jour ouvert se lit
// dans le Panneau latéral, rangé par campagne.
//
// LE FILTRE PASSE PAR L'ID, JAMAIS PAR LE NOM. La récolte rattache un
// changement de groupe d'annonces ou d'annonce à sa campagne par la hiérarchie
// d'IDs des insights ; quand elle ne la retrouve pas, `campaign_id` reste vide.
// Un tel changement ne se montre que SANS filtre, et le panneau filtré le
// COMPTE : le taire ferait croire que la journée est complète.
//
// Pas de directive, comme `lecture.ts` (`CLAUDE.md` §8) ; l'import de
// `./lecture` est un type seulement.

import type { Campagne, Periode } from "./lecture";

/** Une ligne de `platform_changes`, telle que PostgREST la rend. */
export type LigneChangement = {
  change_id: string | null;
  occurred_at: string | null;
  categorie: string | null;
  campaign_id: string | number | null;
  campaign_name: string | null;
  resume: string | null;
};

export type ChangementMeta = {
  id: string;
  /** YYYY-MM-DD, en UTC. */
  jour: string;
  /** « 14:02 », en UTC. */
  heure: string;
  nature: string;
  campagneId: string | null;
  campagneNom: string | null;
  /** Rédigée à la récolte, et elle NOMME l'élément touché (`_traduire_meta`
   *  écarte tout changement sans nom d'objet) : « le budget de l'ensemble
   *  "Acheteurs" est passé de 40,00 à 60,00 CHF ». */
  phrase: string;
};

/** Les catégories de `platform_changes`, dites comme Ads Manager les dit. */
const NATURES: Record<string, string> = {
  budget: "Budget",
  statut: "Statut",
  audience: "Ciblage",
  creatif: "Visuel",
  enchere: "Enchère",
  creation: "Création",
  motcle: "Mot-clé",
};
const NATURE_INCONNUE = "Réglage";

const deux = (n: number) => String(n).padStart(2, "0");

/**
 * Une ligne de base → un changement, ou `null` quand elle n'a ni date lisible
 * ni phrase.
 *
 * EN UTC, et c'est un choix par défaut, pas une vérité : `occurred_at` est un
 * `timestamptz`, PostgreSQL l'a ramené à l'instant UTC et le fuseau du compte
 * publicitaire n'est récolté nulle part. Un geste fait entre minuit et deux
 * heures à Zurich se pose donc sur la veille ; l'heure affichée le dit
 * (« UTC »), pour qu'on ne la lise pas comme une heure locale.
 */
export function changementDe(r: LigneChangement): ChangementMeta | null {
  const phrase = r.resume?.trim();
  if (!phrase || !r.occurred_at) return null;
  const d = new Date(r.occurred_at);
  if (isNaN(d.getTime())) return null;
  const campagneId = r.campaign_id === null || r.campaign_id === "" ? null : String(r.campaign_id);
  return {
    id: String(r.change_id ?? `${r.occurred_at}|${phrase}`),
    jour: d.toISOString().slice(0, 10),
    heure: `${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}`,
    nature: NATURES[String(r.categorie ?? "")] ?? NATURE_INCONNUE,
    campagneId,
    campagneNom: r.campaign_name?.trim() || null,
    phrase,
  };
}

/** Sans filtre, tout ; sous un filtre, la campagne par son ID — ses groupes et
 *  ses annonces compris, puisque la récolte leur a donné son ID. Une clé
 *  « sans-id: » n'attrape donc rien : on ne rattache jamais par le nom. */
function visible(c: ChangementMeta, filtre: string | null): boolean {
  return filtre === null || c.campagneId === filtre;
}

export type MarqueJour = {
  /** La place du jour dans `dates`. */
  index: number;
  nombre: number;
};

/** Un point par JOUR qui a au moins un changement visible, pas un par
 *  changement : trois gestes à la même heure se chevaucheraient. */
export function joursMarques(changements: ChangementMeta[], filtre: string | null, dates: string[]): MarqueJour[] {
  const parJour = new Map<string, number>();
  for (const c of changements) if (visible(c, filtre)) parJour.set(c.jour, (parJour.get(c.jour) ?? 0) + 1);
  return dates.flatMap((d, index) => (parJour.has(d) ? [{ index, nombre: parJour.get(d)! }] : []));
}

/** Le jour demandé par l'URL, s'il est dans la période. Un jour hors de la
 *  période ne s'ouvre pas (user story 46) : on lirait des changements sans les
 *  chiffres qui vont avec. Changer de période le referme donc sans qu'aucun
 *  lien ait à le savoir. La période exclut déjà le jour en cours. */
export function jourOuvertDe(x: string | undefined, periode: Periode): string | null {
  if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return null;
  const d = new Date(`${x}T00:00:00Z`);
  // `Date` accepte le 30 février et le reporte au 2 mars : on refuse.
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== x) return null;
  return x >= periode.debut && x <= periode.fin ? x : null;
}

export type GroupeJour = {
  /** `null` = la récolte n'a pas retrouvé la campagne. */
  campagneId: string | null;
  nom: string | null;
  couleur: string;
  lignes: ChangementMeta[];
};

export type PanneauJour = {
  jour: string;
  /** Les changements montrés. */
  total: number;
  groupes: GroupeJour[];
  /** Sous un filtre : les changements du jour dont la campagne est inconnue.
   *  Ils ne se montrent pas, mais se comptent. */
  nonRattaches: number;
};

const GRIS_INCONNU = "#c3c2bb";

/**
 * Le Panneau latéral d'un jour : ses changements rangés par campagne, dans
 * l'ordre du Bandeau (la plus dépensière d'abord), chacun à son heure ; la
 * campagne non retrouvée en dernier.
 *
 * Le nom d'une campagne est celui du Bandeau — le plus récent lu dans les
 * insights — pour qu'une campagne renommée se lise sous un seul nom. Une
 * campagne sans chiffres sur la période garde le nom écrit avec le changement.
 */
export function panneauDuJour(
  changements: ChangementMeta[],
  jour: string,
  filtre: string | null,
  campagnes: Campagne[]
): PanneauJour {
  const duJour = changements.filter((c) => c.jour === jour);
  const montres = duJour.filter((c) => visible(c, filtre));
  const rang = new Map(campagnes.map((c, i) => [c.cle, i]));
  const parCampagne = new Map<string | null, ChangementMeta[]>();
  for (const c of montres) parCampagne.set(c.campagneId, [...(parCampagne.get(c.campagneId) ?? []), c]);

  const place = (id: string | null) => (id === null ? Infinity : rang.get(id) ?? campagnes.length);
  const groupes = [...parCampagne.entries()]
    .sort(([a], [b]) => place(a) - place(b) || String(a).localeCompare(String(b)))
    .map(([id, lignes]): GroupeJour => {
      const connue = id === null ? undefined : campagnes.find((c) => c.cle === id);
      return {
        campagneId: id,
        nom: id === null ? null : connue?.nom ?? lignes.find((l) => l.campagneNom)?.campagneNom ?? id,
        couleur: connue?.couleur ?? GRIS_INCONNU,
        lignes: [...lignes].sort((a, b) => a.heure.localeCompare(b.heure)),
      };
    });

  return {
    jour,
    total: montres.length,
    groupes,
    nonRattaches: filtre === null ? 0 : duJour.filter((c) => c.campagneId === null).length,
  };
}
