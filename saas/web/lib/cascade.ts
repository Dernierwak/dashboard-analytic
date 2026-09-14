// UNE ÉCRITURE QUI EN ENTRAÎNE SIX — ET CE QU'ON DIT QUAND ELLE S'ARRÊTE AU
// MILIEU.
//
// Renommer ou supprimer un thème touche jusqu'à SIX tables : la liste maîtresse
// (`profiles.labels`), les assignations Meta et Google, les actions décidées,
// les événements GA4 du thème, son objectif, et les posts Instagram. PostgREST
// n'a pas de transaction : ce sont six requêtes distinctes, et rien n'annule
// les précédentes quand la troisième échoue.
//
// Avant ce module, ces six `await` étaient NUS — leur résultat n'était même pas
// capturé. Une panne au milieu laissait le compte avec un thème à moitié
// renommé, et l'écran répondait « renommé partout ». C'est le piège de
// `CLAUDE.md` §8 posé six fois d'affilée, et le plus cher des trois : il produit
// un état incohérent, pas seulement un silence.
//
// ── POURQUOI PAS UNE FONCTION SQL `SECURITY DEFINER` ────────────────────────
//
// Le ticket 19 pose la question, et elle est juste : six écritures qui doivent
// tenir ensemble SONT une transaction. Elle reste la bonne réponse le jour où
// la base se joue. Elle n'est pas prenable aujourd'hui — aucun accès à la base,
// donc une migration écrite et NON JOUÉE (c'est déjà le cas des tickets 03, 04
// et 05), et un `actions.ts` qui appellerait une fonction inexistante : le
// renommage d'un thème cesserait de marcher en production au lieu d'être
// seulement silencieux. On ne remplace pas un mensonge par une panne.
//
// Ce que ce module fait à la place est le patron déjà retenu et écrit dans
// `_fusionnerLabels` (`app/actions.ts`) : la séquence s'ARRÊTE à la première
// panne, elle DIT sur quelle étape, et l'ordre des étapes la rend REJOUABLE —
// la liste maîtresse en dernier, pour qu'un arrêt laisse le thème visible et
// donc relançable, au lieu de le faire disparaître en laissant des campagnes
// pointer vers un nom introuvable. C'est un arbitrage, pas une préférence :
// `arretCascade` est là pour que le client sache TOUJOURS qu'il doit relancer.

/** Ce qu'une écriture PostgREST rend quand elle a échoué — `null` sinon. On ne
 *  regarde que la présence de l'erreur : son texte vient de PostgREST et n'est
 *  pas montré au client. */
export type Panne = { message?: string } | null | undefined;

/** Une écriture, et le nom que le client verra si c'est elle qui s'arrête. Le
 *  nom est en français courant (« campagnes Meta »), jamais un nom de table :
 *  personne ne sait ce qu'est `meta_campaign_config`. */
export type Etape = {
  nom: string;
  ecrire: () => Promise<Panne>;
};

export type Enchainement = { ok: true } | { ok: false; etape: string };

/** Les étapes dans l'ORDRE, jusqu'à la première qui échoue.
 *
 *  En série et jamais en parallèle : `Promise.all` lancerait les six d'un coup,
 *  donc écrirait les cinq autres alors que la première a déjà échoué — c'est
 *  exactement l'état incohérent qu'on cherche à éviter. L'ordre est la seule
 *  chose qui rend un arrêt rattrapable. */
export async function enchainer(etapes: Etape[]): Promise<Enchainement> {
  for (const etape of etapes) {
    if (await etape.ecrire()) return { ok: false, etape: etape.nom };
  }
  return { ok: true };
}

/** CE QUE L'ÉCRAN DIT SUR UN ARRÊT. Trois choses, et pas une de plus : que ce
 *  n'est pas fini, OÙ ça s'est arrêté, et que relancer reprend sans rien
 *  refaire en double. Aucune promesse de réparation automatique : il n'y en a
 *  pas.
 *
 *  Le `geste` est un groupe nominal déjà accordé par l'appelant
 *  (« Renommage incomplet », « Suppression incomplète ») — la phrase n'a donc
 *  pas à deviner le genre du mot qu'on lui passe. */
export function arretCascade(geste: string, etape: string): string {
  return (
    `${geste} : arrêté sur « ${etape} ». Ce qui est déjà écrit n'est pas refait — ` +
    `relance pour finir.`
  );
}
