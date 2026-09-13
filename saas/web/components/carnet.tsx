import {
  getCarnet,
  getBilanCarnet,
  peutToucher,
  jourLisible,
  type BilanCarnet as Bilan,
  type CampagneNote,
} from "@/lib/carnet";
import { NoteAjout } from "@/components/note-ajout";
import { CarnetLigne } from "@/components/carnet-ligne";

// ── LE CARNET : UN MODULE UNIQUE, POSÉ PARTOUT ──────────────────────────────
//
// « Tu as à la fin un peu tout ton historique de ce que tu fais pour
// travailler. Cela permet de garder le client. » — David, ticket 03 de la
// refonte. C'est le seul mécanisme de rétention de toute la carte, et aucun des
// dix produits concurrents lus n'en a un.
//
// LE MÊME OBJET SUR TOUTES LES PAGES, filtré par le contexte de la page — le
// patron du bandeau de commandes (`.scratch/refonte/issues/12-module-de-commandes.md`).
// Ce qui le filtre est exactement ce que le bandeau filtre : ses thèmes, sa
// campagne. Rien d'autre. La raison vit dans l'en-tête de `lib/carnet.ts`.
//
// CE QU'IL N'EST PAS, ET CE QU'IL NE DÉFAIT PAS. Le **rail des actions** de la
// page d'accueil garde le cycle de vie complet d'une action avec son effet
// chiffré, à l'intérieur de la carte de son thème — résultat d'une fusion
// délibérée (`685a3e9`, 615 lignes supprimées) qui a réglé un vrai problème :
// le conseil, la case à cocher et le verdict vivaient à 900 px les uns des
// autres. **Ce module ne le remplace pas et ne le rejoue pas.** Il répond à une
// autre question : « qu'est-ce que j'ai écrit, ici, sur ce que je regarde ? »
//
// AUCUNE SEMAINE PASSÉE NE SE ROUVRE. La mémoire est le fil continu, pas
// l'archive rejouée : un rapport archivé porte des chiffres figés qui
// contrediraient le rail sur les mêmes jours — deux vérités à l'écran
// (`.scratch/refonte/issues/08-la-memoire-du-travail.md` §2).
//
// AUCUNE MARQUE SUR UNE COURBE ICI. Elles ont existé et David les a fait
// retirer le 24 août 2026 : des points noirs pleins au milieu des points bleus
// de la série. La question « comment marquer sans salir le tracé » est
// prototypée en quatre variantes et **attend son jugement** (ticket 19 de la
// refonte) — elle ne se trancherait pas dans ce module.

/** LA PHRASE DU BILAN, écrite à UN seul endroit.
 *
 *  Deux écrans la portent — le module complet et la page d'accueil — et deux
 *  formulations du même comptage, c'est deux vérités possibles à l'écran.
 *
 *  Elle dit toujours DEUX choses que le chiffre seul ne dit pas : sur quelle
 *  fenêtre il porte, et qu'il porte sur TOUT LE COMPTE. Sans la seconde, on
 *  lirait le bilan comme celui du filtre posé au bandeau juste au-dessus. */
function PhraseBilan({ b }: { b: Bilan }) {
  return (
    <p className="text-[11.5px] text-muted">
      <span className="font-mono text-ink font-semibold">{b.juges}</span>{" "}
      {b.juges > 1 ? "actions jugées" : "action jugée"} sur {b.jours} jours,{" "}
      <span className="font-mono text-ink font-semibold">{b.marche}</span>{" "}
      {b.marche > 1 ? "ont marché" : "a marché"}
      <span className="text-faint"> · sur tout le compte</span>
    </p>
  );
}

/** LE BILAN SEUL — ce que la page d'accueil prend du Carnet, et rien d'autre.
 *
 *  Elle ne monte pas le module entier, et c'est une règle du ticket : le rail
 *  des actions y porte déjà la chronologie complète à l'intérieur de la carte
 *  de son thème, avec l'effet chiffré. Le relire en liste ferait DEUX lectures
 *  du même fil, à 900 px d'écart — exactement ce que la fusion de `685a3e9`
 *  avait défait, et que ce ticket a l'ordre de ne pas rejouer.
 *
 *  L'ordre du premier écran est Verdict → **bilan du Carnet** → À faire → rail
 *  → résumé IA replié. Ce composant pose la deuxième marche ; le rail des
 *  actions en cours, la descente du résumé et les trois dates ont été posés par
 *  le ticket 13 de la construction. Le rail de la page d'accueil ne montre que
 *  ce qui COURT — il ne rejoue ni la chronologie d'un thème, ni ce module. */
export async function BilanDuCarnet() {
  const bilan = await getBilanCarnet();
  // Rien de jugé n'est pas « zéro action jugée » à afficher : un compte qui
  // démarre n'a rien à lire ici, et une ligne à zéro se lirait comme un échec.
  if (!bilan || bilan.juges === 0) return null;
  return (
    <div className="mb-7 -mt-3 flex items-baseline gap-2 flex-wrap">
      <span className="text-[11px] uppercase tracking-widest text-faint font-semibold">
        Ton carnet
      </span>
      <PhraseBilan b={bilan} />
    </div>
  );
}

/** Ce que la page sait de son propre contexte. */
type Props = {
  /** La régie de la page. Sert à apparier la campagne du bandeau — jamais à
   *  cacher des notes (voir `lib/carnet.ts`). */
  canal?: "meta" | "google" | null;
  /** Les thèmes cochés au bandeau (`themesChoisis(searchParams)`). */
  themes: string[];
  /** La clé de campagne cochée au bandeau, telle quelle. */
  campKey?: string | null;
  /** De quoi NOMMER une clé de campagne. Une clé Google est un identifiant :
   *  l'afficher nu donnerait « 22334455 » à lire. */
  campagnes?: { key: string; name: string }[];
};

function nommer(
  campagne: CampagneNote | null,
  canal: "meta" | "google" | null | undefined,
  campagnes: { key: string; name: string }[]
): string | null {
  if (!campagne) return null;
  // On ne nomme QUE les campagnes de la régie de la page : deux régies peuvent
  // porter la même clé, et emprunter le nom de l'autre désignerait la mauvaise
  // campagne (`CLAUDE.md` §7, et le bug payé au ticket 03).
  if (canal && campagne.canal === canal) {
    const trouvee = campagnes.find((c) => c.key === campagne.cle);
    if (trouvee) return trouvee.name;
  }
  return campagne.cle;
}

export async function Carnet({ canal = null, themes, campKey = null, campagnes = [] }: Props) {
  // Une clé de campagne ne désigne rien sans sa régie : hors d'une page canal,
  // le filtre de campagne n'existe pas (ni `/labels` ni `/` n'en portent un).
  const campagne: CampagneNote | null =
    canal && campKey
      ? { canal, cle: campKey, nom: campagnes.find((c) => c.key === campKey)?.name ?? null }
      : null;

  const carnet = await getCarnet({ canal, themes, campagne });
  const { notes, bilan, horsContexte } = carnet;
  const filtre = themes.length > 0 || campagne !== null;

  const porte = carnet.peutEditer ? (
    <NoteAjout theme={themes.length === 1 ? themes[0] : null} campagne={campagne} />
  ) : null;

  // LE MODULE DISPARAÎT, LA PORTE RESTE — le patron du module « À faire »
  // (ticket 11). Un Carnet vide sur six pages est du bruit ; mais si le geste
  // d'écriture partait avec le cadre, plus rien ne pourrait faire revenir le
  // module : on ne pourrait plus écrire, donc rien n'entrerait, donc il
  // resterait vide. C'était un cul-de-sac, et cette carte n'en veut aucun.
  if (notes.length === 0 && horsContexte === 0 && !bilan?.juges)
    return (
      <div className="mt-6">
        {porte}
        {porte && (
          <p className="text-[10.5px] text-faint/80 mt-1.5 leading-relaxed max-w-[68ch]">
            Ton carnet est vide. Ce que tu écris ici, Pulse ne peut pas le deviner — et
            c&apos;est ce qui explique une courbe qui bouge, trois semaines plus tard.
          </p>
        )}
      </div>
    );

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink">
          Ton carnet
        </h2>
        {/* LE BILAN EST UN COMPTAGE, ET IL PORTE SUR TOUT LE COMPTE — deux
            choses que la phrase doit dire elle-même. Il remplace le moteur de
            preuve, qui REMESURAIT sur le compte entier ce que le rail mesure sur
            le thème : deux moteurs, deux verdicts possibles sur la même
            décision. Ici on ne mesure rien, on compte des verdicts déjà écrits.
            Le module, lui, peut être filtré : sans « sur tout le compte », on
            lirait le bilan comme celui du filtre posé. */}
        {bilan && bilan.juges > 0 && <PhraseBilan b={bilan} />}
      </div>

      <div className="rounded-xl border border-line bg-white shadow-card px-4 py-3.5">
        {notes.length === 0 ? (
          <p className="text-[12.5px] text-muted leading-relaxed">
            Rien d&apos;écrit {filtre ? "sur ce que tu regardes ici" : "pour l'instant"}.
          </p>
        ) : (
          <ul className="divide-y divide-line/70">
            {notes.map((n) => {
              const nom = nommer(n.campagne, canal, campagnes);
              return (
                <li key={n.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-faint shrink-0">
                      {jourLisible(n.jour)}
                    </span>
                    {n.theme && (
                      <span className="text-[11px] text-brand font-semibold">{n.theme}</span>
                    )}
                    {nom && (
                      <span className="text-[11px] text-muted truncate max-w-[220px]">
                        {nom}
                      </span>
                    )}
                    {/* L'AUTEUR NE S'AFFICHE QUE SUR UN COMPTE PARTAGÉ : « David »
                        à côté de chaque ligne d'un compte solo est du bruit
                        permanent (08 §5). Et il ne s'INVENTE pas : une note dont
                        on ne peut pas nommer l'auteur dit « un membre ». */}
                    {carnet.partage && !n.sansAuteur && (
                      <span className="text-[11px] text-faint">{n.auteur ?? "un membre"}</span>
                    )}
                  </div>
                  <p className="text-[12.5px] text-ink leading-snug mt-0.5">{n.titre}</p>
                  {peutToucher(n, carnet) && <CarnetLigne id={n.id} titre={n.titre} />}
                </li>
              );
            })}
          </ul>
        )}
        {porte}
      </div>

      {/* CE QUE LE FILTRE ÉCARTE, ÉCRIT. Sans ça, « 2 notes » sur un compte qui
          en porte douze se lit comme une panne — leçon du prototype du ticket 19
          de la refonte, et application directe du §7 : une absence à l'écran
          n'est pas une absence en base. */}
      {horsContexte > 0 && (
        <p className="text-[10.5px] text-faint/80 mt-2 leading-relaxed">
          {horsContexte} autre{horsContexte > 1 ? "s" : ""} note
          {horsContexte > 1 ? "s" : ""} dans ton carnet, hors de ce que tu regardes ici.
        </p>
      )}
      {/* LA MIGRATION N'EST PAS JOUÉE, ET L'ÉCRAN LE DIT. Sans cette phrase,
          « aucune campagne » se lirait comme « personne n'en a jamais désigné »,
          alors que la base ne sait pas encore porter la colonne. */}
      {!carnet.migrationOk && (
        <p className="text-[10.5px] text-faint/80 mt-1.5 leading-relaxed">
          {campagne
            ? "Ces notes ne sont PAS filtrées par campagne, et aucune ne porte d'auteur : "
            : "Ni auteur ni campagne sur ces notes : "}
          la migration
          <span className="font-mono"> suivi_actions_auteur_campagne.sql</span> n&apos;est pas
          encore jouée en base.
        </p>
      )}
    </section>
  );
}
