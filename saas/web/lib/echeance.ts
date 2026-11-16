// ── L'ÉCHÉANCE D'UNE CONNEXION : PRÉVENIR AVANT LA PANNE ─────────────────────
//
// `.scratch/recolte/tickets/05-l-echeance-se-dit-avant-la-panne.md`. La récolte
// écrit la date à laquelle le jeton mourra (`connected_accounts.jeton_expire_le`,
// section 27 du `000`). Ce module en fait ce que les deux écrans disent : la
// page Connexions et le rapport hebdo.
//
// Sans directive et sans import : pur, il se teste sous Node seul (harnais du
// ticket) et se lit des deux côtés de la frontière client (`CLAUDE.md` §8).
//
// Les règles tenues, chacune testée :
//   · une date absente ou illisible ne rend RIEN — jamais une échéance supposée
//     (`CLAUDE.md` §7). Google ne donne aucune échéance à un refresh token ;
//   · le préavis est celui du worker (`sources/meta/auth/token.py`,
//     `PREAVIS_JOURS`) : la récolte passe une fois par semaine, 14 jours
//     laissent deux rapports pour se reconnecter avant la panne ;
//   · les jours restants sont des jours PLEINS, arrondis vers le bas : « dans
//     1 jour » ne s'écrit pas pour une connexion qui meurt dans trois heures.

export const PREAVIS_JOURS = 14;
const JOUR_MS = 86_400_000;

export type Echeance = {
  /** L'horodatage tel que la base le porte. */
  expireLe: string;
  /** Jours pleins avant l'échéance ; négatif ou nul = elle est passée. */
  joursRestants: number;
  /** Dans la fenêtre de préavis, ou déjà passée. */
  bientot: boolean;
  /** L'échéance est derrière nous : la prochaine récolte trouvera le jeton mort. */
  passee: boolean;
};

export function echeanceDe(expireLe: string | null | undefined, maintenant: Date): Echeance | null {
  if (!expireLe) return null;
  const d = new Date(expireLe);
  if (isNaN(d.getTime())) return null;
  const reste = d.getTime() - maintenant.getTime();
  const joursRestants = Math.floor(reste / JOUR_MS);
  return { expireLe, joursRestants, bientot: joursRestants < PREAVIS_JOURS, passee: reste <= 0 };
}

/** « dans 9 jours », « demain », « aujourd'hui » — pour une échéance à venir. */
export function dansCombien(e: Echeance): string {
  if (e.joursRestants <= 0) return "aujourd'hui";
  if (e.joursRestants === 1) return "demain";
  return `dans ${e.joursRestants} jours`;
}
