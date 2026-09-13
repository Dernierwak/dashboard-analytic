// ── LE CARNET : CE QUE LE COMPTE A ÉCRIT, LU N'IMPORTE OÙ ────────────────────
//
// Un seul objet pour toute l'application, sur le patron du bandeau de commandes
// (`lib/commandes.ts`) : le même module, posé sur plusieurs pages, et **filtré
// par exactement ce que le bandeau de la page filtre** — ses thèmes, sa
// campagne. La page ne choisit pas ce que le Carnet montre ; elle lui passe son
// contexte, et c'est le contexte qui décide. Tranché par
// `.scratch/refonte/issues/08-la-memoire-du-travail.md` §4, construit par
// `.scratch/construction/issues/12-le-carnet-et-la-mort-de-preuve.md`.
//
// LE THÈME NE ROUTE PAS LE MODULE, IL L'ENRICHIT. Correction de David en 08 :
// « les thèmes ne découpent pas l'application en deux axes, ils DÉBLOQUENT des
// modules ». Une note sans thème vit donc sur le Carnet de sa page comme les
// autres ; poser un thème au bandeau ne fait pas apparaître un autre module, il
// resserre celui-ci.
//
// LA PAGE N'EST PAS UN FILTRE, ELLE EST UN CONTEXTE D'ÉCRITURE. `/meta` ne
// cache pas les notes de Google : rien en base ne rattache à un canal une note
// qui ne désigne aucune campagne, et filtrer là-dessus reviendrait à lui prêter
// un sujet qu'elle n'a jamais eu (`CLAUDE.md` §7). Ce que la page apporte, c'est
// la RÉGIE de la campagne qu'on y écrit : une note posée depuis `/meta` avec la
// campagne « Été » au bandeau naît `('meta', 'Été')` sans qu'on demande rien à
// personne.
//
// CE FICHIER N'A PAS DE DIRECTIVE, ET C'EST VOULU : il est lu par des
// composants SERVEUR. Une constante exportée depuis un module `"use client"`
// devient une référence client côté serveur, la valeur lue est un proxy, et
// rien ne lève (`CLAUDE.md` §8).
import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";

/** La régie et la clé d'une campagne — une PAIRE, jamais une clé seule.
 *  Meta identifie une campagne par son nom, Google par son identifiant
 *  (`lib/report.ts`, `ThemeCampaign`) : rien n'interdit d'appeler une campagne
 *  Meta « 22334455 », et la note basculerait sur la campagne Google homonyme.
 *  C'est pour ça que la migration porte DEUX colonnes
 *  (`supabase/migrations/suivi_actions_auteur_campagne.sql`). */
export type CampagneNote = {
  canal: "meta" | "google";
  cle: string;
  /** Le nom lisible, quand la page le connaît. Jamais stocké : une campagne se
   *  renomme, la note raconte ce qui a été fait, pas comment ça s'appelle
   *  aujourd'hui. */
  nom?: string | null;
};

/** Ce que la page passe au Carnet : son bandeau, et sa régie. */
export type ContexteCarnet = {
  /** La régie de la page, quand elle en a une. Sert à l'ÉCRITURE (la paire
   *  d'une campagne) et à lever l'ambiguïté du filtre de campagne — jamais à
   *  cacher des notes. */
  canal?: "meta" | "google" | null;
  /** Les thèmes cochés au bandeau (`themesChoisis`). Vide = tous. */
  themes: string[];
  /** La campagne cochée au bandeau, déjà appariée à la régie de la page. */
  campagne?: CampagneNote | null;
};

export type NoteCarnet = {
  id: string;
  titre: string;
  /** `decided_at` — le jour que la personne a choisi, jamais le jour du clic. */
  jour: string;
  theme: string | null;
  campagne: CampagneNote | null;
  /** Le nom à afficher, DÉJÀ résolu. `null` = on ne sait pas qui a écrit —
   *  soit la ligne est antérieure à la colonne d'auteur (aucun backfill,
   *  ADR 0004), soit la personne n'est pas visible depuis ce compte. On l'écrit
   *  tel quel : inventer un auteur est un fait fabriqué. */
  auteur: string | null;
  /** C'est moi qui l'ai écrite — le seul cas où le nom est certain. */
  deMoi: boolean;
  /** Vrai quand personne ne peut être désigné comme auteur (colonne vide) :
   *  la note est alors modifiable par quiconque peut éditer le compte. */
  sansAuteur: boolean;
};

/** LE BILAN DU CARNET — un COMPTAGE, jamais une mesure.
 *
 *  Il remplace le moteur de preuve qui remesurait sur le compte entier ce que
 *  le rail mesure sur le thème (mort le 2026-09-13, voir la pierre tombale dans
 *  `saas/traitement/build_report.py`). Ici on ne mesure rien : on compte des
 *  `suivi_actions.verdict` déjà écrits par la boucle du rail. Deux moteurs ne
 *  peuvent donc plus se contredire — il n'y en a plus qu'un, et le second ne
 *  fait que compter ses lignes. */
export type BilanCarnet = {
  /** Combien d'actions ont reçu un verdict sur la fenêtre. */
  juges: number;
  /** Combien parmi elles ont bougé dans le bon sens (`verdict = 'better'`). */
  marche: number;
  /** La fenêtre comptée, en jours — écrite à l'écran, jamais sous-entendue. */
  jours: number;
};

export type Carnet = {
  notes: NoteCarnet[];
  bilan: BilanCarnet | null;
  /** Les notes du compte que le contexte de la page écarte. Écrit à l'écran :
   *  sans ça, « 2 notes » sur un compte qui en a douze se lit comme une panne
   *  (leçon du prototype du ticket 19 de la refonte). */
  horsContexte: number;
  contexte: ContexteCarnet;
  /** Le compte porte plus d'une personne → l'auteur s'affiche. Sur un compte
   *  solo, « David » à côté de chaque ligne est du bruit permanent (08 §5). */
  partage: boolean;
  peutEditer: boolean;
  /** Le Propriétaire peut corriger et effacer n'importe quelle note ; un Membre,
   *  seulement les siennes. */
  proprietaire: boolean;
  /** Les colonnes `author_id` / `campaign_*` existent en base. Fausse tant que
   *  `suivi_actions_auteur_campagne.sql` n'est pas joué : le module s'affiche
   *  alors sans auteur ni campagne, et il le DIT plutôt que de laisser croire
   *  que personne n'en a jamais désigné. */
  migrationOk: boolean;
};

/** La fenêtre du bilan. Trente jours parce que c'est l'horizon d'un verdict
 *  (14 jours) doublé : plus court, un compte calme afficherait « 0 jugée » la
 *  moitié du temps ; plus long, le bilan cesserait de parler du mois en cours. */
export const JOURS_BILAN = 30;

const CANAUX = new Set(["meta", "google"]);

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** La campagne d'une ligne, ou `null`. La paire est indivisible : une clé sans
 *  régie ne désigne rien (la contrainte de base le refuse déjà, on ne le
 *  suppose pas ici pour autant). */
function campagneDeLaLigne(row: Record<string, unknown>): CampagneNote | null {
  const canal = String(row.campaign_channel ?? "");
  const cle = String(row.campaign_key ?? "");
  if (!CANAUX.has(canal) || !cle) return null;
  return { canal: canal as "meta" | "google", cle };
}

/** QUI PEUT NOMMER QUI, ET CE QU'ON NE SAIT PAS.
 *
 *  `dashboard_members` ne se lit pas en entier par n'importe qui : la politique
 *  `dm_select` montre au Propriétaire toutes les invitations de son compte, et à
 *  un Membre la sienne seulement (`supabase/migrations/equipe_partage.sql`).
 *  Conséquence assumée : un Membre qui lit la note d'un AUTRE Membre ne peut pas
 *  le nommer. On écrit alors « un membre » — c'est-à-dire ce qu'on sait — plutôt
 *  que de deviner (`CLAUDE.md` §7).
 *
 *  Rend aussi `partage` : le compte porte-t-il plus d'une personne ? Regarder un
 *  compte qui n'est pas le sien y répond par oui sans rien lire. */
async function annuaire(uid: string, moi: string): Promise<{
  noms: Map<string, string>;
  partage: boolean;
}> {
  const supabase = createClient();
  const noms = new Map<string, string>();
  if (uid !== moi) {
    // Je suis invité ici : le compte porte au moins son Propriétaire et moi.
    const r = await supabase
      .from("dashboard_members")
      .select("owner_id, owner_email")
      .eq("member_id", moi)
      .eq("owner_id", uid)
      .limit(1);
    const ligne = r.data?.[0];
    if (ligne?.owner_id)
      noms.set(String(ligne.owner_id), String(ligne.owner_email || "le propriétaire"));
    return { noms, partage: true };
  }
  const r = await supabase
    .from("dashboard_members")
    .select("member_id, member_email")
    .eq("owner_id", uid);
  for (const ligne of r.data ?? [])
    if (ligne.member_id) noms.set(String(ligne.member_id), String(ligne.member_email || "un membre"));
  // Une invitation posée sur un e-mail que personne n'a encore accepté ne
  // rattache aucun identifiant : elle compte quand même une personne de plus
  // sur le compte, mais elle ne peut avoir écrit aucune note.
  return { noms, partage: (r.data ?? []).length > 0 };
}

/** LE COMPTAGE DES VERDICTS — le bilan, et rien d'autre.
 *
 *  Deux comptages `head` : PostgREST rend le nombre de lignes sans en
 *  transporter une seule, donc le plafond des 1 000 lignes ne s'applique pas
 *  (`CLAUDE.md` §8) et un compte chargé ne coûte pas une lecture de plus.
 *
 *  `check_at` et pas `decided_at` : c'est la seule date qui dit quand le verdict
 *  est réellement tombé — elle est recalculée à `done_at + 14 j` au clic
 *  « ✓ C'est fait », qui peut survenir bien après la décision
 *  (`supabase/migrations/suivi_actions_verdict.sql`).
 *
 *  Rend `null` quand la colonne n'existe pas encore : une absence de bilan est
 *  une absence, pas un zéro (`CLAUDE.md` §7). */
export async function compterVerdicts(uid: string): Promise<BilanCarnet | null> {
  const supabase = createClient();
  const borne = new Date();
  borne.setDate(borne.getDate() - (JOURS_BILAN - 1));
  const depuis = iso(borne);
  const verdicts = () =>
    supabase
      .from("suivi_actions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("check_at", depuis)
      .not("verdict", "is", null);
  const [juges, marche] = await Promise.all([verdicts(), verdicts().eq("verdict", "better")]);
  if (juges.error || juges.count === null) return null;
  return {
    juges: juges.count ?? 0,
    marche: marche.error ? 0 : marche.count ?? 0,
    jours: JOURS_BILAN,
  };
}

/** Le bilan seul, pour un écran qui ne montre pas les notes — la page
 *  d'accueil, où le rail des actions porte déjà la chronologie du thème et où
 *  la relire en entier ferait deux lectures du même fil. */
export async function getBilanCarnet(): Promise<BilanCarnet | null> {
  const compte = await getCompteActif();
  return compterVerdicts(compte.uid);
}

/** LE CARNET D'UNE PAGE. Une seule lecture pour tout le module.
 *
 *  Les notes `running` n'y sont pas : une note pas encore cochée est ce qu'on
 *  COMPTE faire, elle vit au module « À faire » et ne se date qu'au moment où on
 *  la coche (`CONTEXT.md`, entrée Note). L'afficher ici la ferait lire comme un
 *  fait accompli. */
export async function getCarnet(contexte: ContexteCarnet): Promise<Carnet> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;
  const proprietaire = uid === compte.moi;

  const COLONNES_NEUVES =
    "id, title, theme, decided_at, author_id, campaign_channel, campaign_key";
  const COLONNES_ANCIENNES = "id, title, theme, decided_at";

  // Le filtre est celui du bandeau, et rien d'autre. `.in` plutôt que `.eq` :
  // le bandeau autorise plusieurs thèmes cochés, ce qui veut dire « cache-moi
  // le reste » (`lib/channels.ts`, `keep`).
  let requete = supabase
    .from("suivi_actions")
    .select(COLONNES_NEUVES, { count: "exact" })
    .eq("user_id", uid)
    .eq("kind", "note")
    .neq("status", "running")
    .order("decided_at", { ascending: false })
    .limit(200);
  if (contexte.themes.length) requete = requete.in("theme", contexte.themes);
  if (contexte.campagne)
    requete = requete
      .eq("campaign_channel", contexte.campagne.canal)
      .eq("campaign_key", contexte.campagne.cle);

  const [listeRes, totalRes, bilan, qui] = await Promise.all([
    requete,
    // Le carnet ENTIER, pour dire ce que le contexte écarte. Un comptage
    // `head` plutôt qu'une liste tronquée : PostgREST plafonne à 1 000 lignes
    // et tronque en silence (`CLAUDE.md` §8), un `length` mentirait au-delà.
    supabase
      .from("suivi_actions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("kind", "note")
      .neq("status", "running"),
    compterVerdicts(uid),
    annuaire(uid, compte.moi),
  ]);

  // LES COLONNES NEUVES PEUVENT NE PAS EXISTER — la migration
  // `suivi_actions_auteur_campagne.sql` est écrite et n'est PAS jouée. Sans ce
  // repli, le Carnet serait vide partout le jour du déploiement, et le module
  // se lirait comme une panne. On relit alors sans elles, et `migrationOk`
  // fausse fait DIRE à l'écran pourquoi il n'y a ni auteur ni campagne.
  //
  // ON NE DIT « MIGRATION PAS JOUÉE » QUE SI C'EST CE QUE LA BASE A DIT. Une
  // panne réseau ou un refus RLS ferait aussi échouer la lecture, et l'écran
  // afficherait alors une cause fausse — un fait fabriqué comme un autre
  // (`CLAUDE.md` §7). On lit le message avant de conclure.
  const colonneAbsente =
    listeRes.error !== null && /author_id|campaign_/.test(String(listeRes.error.message || ""));
  let lignes: Record<string, unknown>[] = listeRes.data ?? [];
  let retenues = listeRes.count ?? lignes.length;
  let migrationOk = !colonneAbsente;
  if (colonneAbsente) {
    let repli = supabase
      .from("suivi_actions")
      .select(COLONNES_ANCIENNES, { count: "exact" })
      .eq("user_id", uid)
      .eq("kind", "note")
      .neq("status", "running")
      .order("decided_at", { ascending: false })
      .limit(200);
    if (contexte.themes.length) repli = repli.in("theme", contexte.themes);
    const r = await repli;
    lignes = r.data ?? [];
    retenues = r.count ?? lignes.length;
    migrationOk = false;
  }

  const { noms, partage } = qui;
  const notes: NoteCarnet[] = lignes.map((row: Record<string, unknown>) => {
    const auteurId = row.author_id ? String(row.author_id) : null;
    const deMoi = auteurId !== null && auteurId === compte.moi;
    return {
      id: String(row.id),
      titre: String(row.title ?? ""),
      jour: String(row.decided_at ?? "").slice(0, 10),
      theme: (row.theme as string | null) ?? null,
      campagne: campagneDeLaLigne(row),
      auteur: deMoi ? "toi" : auteurId ? noms.get(auteurId) ?? null : null,
      deMoi,
      sansAuteur: auteurId === null,
    };
  });

  const total = totalRes.count ?? notes.length;

  return {
    notes,
    bilan,
    // Jamais négatif : les deux comptages sont pris au même instant, mais une
    // note écrite entre les deux requêtes ferait passer `retenues` devant
    // `total`, et « -1 autre note » est un chiffre qui n'existe pas.
    horsContexte: Math.max(0, total - retenues),
    contexte,
    partage,
    peutEditer: compte.peutEditer,
    proprietaire,
    migrationOk,
  };
}

/** Qui a le droit de corriger ou d'effacer cette note.
 *
 *  Règle de 08 §5 et de l'ADR 0004 : une note est personnelle, elle a un auteur,
 *  et **elle ne s'efface que par lui** — tout le monde la VOIT, personne d'autre
 *  n'y touche. Le Propriétaire fait exception : c'est son compte, et sans lui
 *  une note deviendrait ineffaçable au départ de son auteur.
 *
 *  Une note SANS auteur reste modifiable par quiconque peut éditer : elle est
 *  antérieure à la colonne (aucun backfill, ADR 0004) et l'interdire à tout le
 *  monde la figerait pour toujours sans que personne l'ait décidé.
 *
 *  Ce n'est PAS une autorisation : la base tranche (RLS + le déclencheur qui
 *  fige `author_id`). C'est ce que l'écran propose, et le serveur le revérifie
 *  (`app/actions.ts`). */
export function peutToucher(
  note: Pick<NoteCarnet, "deMoi" | "sansAuteur">,
  carnet: Pick<Carnet, "peutEditer" | "proprietaire">
): boolean {
  if (!carnet.peutEditer) return false;
  return note.deMoi || note.sansAuteur || carnet.proprietaire;
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 2026-08-05 » → « 5 août ». Même forme que le bandeau (`lib/commandes.ts`) :
 *  une date se lit, `05/08/2026` demande un effort. */
export function jourLisible(isoJour: string): string {
  const [, m, d] = isoJour.split("-");
  const mois = MOIS[Number(m) - 1];
  return mois ? `${Number(d)} ${mois}` : isoJour;
}
