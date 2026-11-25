import { PanneauLateral } from "@/components/meta/panneau";
import { MiniMoustache } from "@/components/instagram/annee/mini-moustache";
import { aUnePlace, dateCourte, formaterValeur, libellePlace, raisonPlace, TIRET } from "@/lib/instagram/tableau";
import { METRIQUES, type CleMetrique } from "@/lib/instagram/lecture";
import type { LecturePost } from "@/lib/instagram/panneau";
import {
  libelleJournee,
  raisonStory,
  texteEtatJournee,
  texteReleve,
  texteSansChiffres,
  ZERO_CLIC,
  type Comptes,
  type JourneeStories,
  type Story,
} from "@/lib/instagram/stories";

// ── LE PANNEAU « LIRE UNE JOURNÉE DE STORIES » ───────────────────────────────
//
// Spec `.scratch/instagram-stories/spec.md`, § Ce que la page montre, « Le
// Panneau d'une journée » ; ticket `issues/05`, point 3. Ouvert par
// `?post=stories-AAAA-MM-JJ` depuis le nuage, la liste des 5 ou le Tableau —
// le même cadre et le même paramètre que le Panneau d'un post.
//
// En tête la portée du jour (`reach_story`, dédoublonnée par Instagram) et les
// sommes, JAMAIS de ratio entre les deux (deux bases : jour d'affichage, jour
// de publication) ; puis les stories dans l'ordre de publication, chacune avec
// sa vignette (Pulse ne garde pas les vidéos), ses chiffres et l'âge de son
// relevé. Le calcul est dans `lib/instagram/stories.ts` (harnais
// `.scratch/instagram-stories/harnais/02-la-page/`).

type Somme = { cle: keyof Comptes; metrique: CleMetrique };

/** Les sommes de l'en-tête, dans l'ordre des Objectifs. La navigation se lit
 *  story par story, plus bas. */
const SOMMES: Somme[] = [
  { cle: "vues", metrique: "vues" },
  { cle: "partages", metrique: "partages" },
  { cle: "interactions", metrique: "interactions" },
  { cle: "abonnes", metrique: "abonnes" },
  { cle: "visitesProfil", metrique: "visites_profil" },
  { cle: "clicsLien", metrique: "clics_lien" },
];

const NAVIGATION: { cle: keyof Comptes; nom: string }[] = [
  { cle: "avancer", nom: "Avancer" },
  { cle: "revenir", nom: "Revenir" },
  { cle: "quitter", nom: "Quitter" },
  { cle: "suivante", nom: "Story suivante" },
];

/** Un compte sans unité ni décimale, comme les vues. */
const compte = (v: number | null) => formaterValeur("vues", v);

export function PanneauJournee({
  lecture,
  metrique,
  fermeture,
}: {
  lecture: LecturePost;
  metrique: CleMetrique;
  fermeture: string;
}) {
  const p = lecture.post;
  const j = p.journee as JourneeStories;
  const etat = texteEtatJournee(j);
  const sansChiffres = texteSansChiffres(j);
  const placeDite = lecture.place.etat !== "sans_metrique";

  return (
    <PanneauLateral
      titre={libelleJournee(j)}
      sousTitre={etat ? <span className="text-warn">{etat}</span> : <span>Dernier relevé : {dateCourte(p.releveA)}</span>}
      fermeture={fermeture}
    >
      <div className="rounded-xl bg-canvas p-4">
        <div className="text-[12px] text-muted">Portée du jour</div>
        <b className="mt-0.5 block text-[22px] tabular-nums text-ink">{formaterValeur("portee", j.porteeDuJour)}</b>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {j.porteeDuJour === null
            ? "La portée de tes stories n'est pas relevée pour ce jour."
            : "comptes touchés par tes stories ce jour-là — celles de la veille encore en ligne comprises, chaque compte compté une fois."}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
          {SOMMES.map(({ cle, metrique: m }) => {
            const v = j.sommes[cle];
            const partielle = v !== null && j.mesurees[cle] < j.stories.length;
            return (
              <div key={cle} className="min-w-0">
                <dt className="text-[12px] text-muted">{METRIQUES[m].nom}</dt>
                <dd className="tabular-nums text-ink">
                  <b>{formaterValeur(m, v)}</b>
                  {partielle && <span className="text-[11.5px] text-faint"> · sur {j.mesurees[cle]}</span>}
                </dd>
                {cle === "clicsLien" && v === 0 && <dd className="text-[11px] text-faint">{ZERO_CLIC}</dd>}
              </div>
            );
          })}
          <div className="min-w-0">
            <dt className="text-[12px] text-muted" title={METRIQUES.sorties_100.aide}>
              {METRIQUES.sorties_100.nom}
            </dt>
            <dd className="tabular-nums text-ink">
              <b>{formaterValeur("sorties_100", j.sortiesPour100)}</b>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[12px] text-faint">
          Sommes des stories de la journée{sansChiffres ? ` — ${sansChiffres} : elles ne comptent que ce qui a été mesuré` : ""}. «
          {TIRET} » : rien de mesuré, ce n&apos;est pas un zéro.
        </p>
      </div>

      {placeDite ? (
        <div className="mt-4 rounded-xl border border-line p-4">
          <div className="text-[12px] text-muted">{METRIQUES[metrique].nom}</div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <b className="text-[18px] tabular-nums text-ink">{formaterValeur(metrique, lecture.valeur)}</b>
            <span className={`text-[13px] ${aUnePlace(lecture.place) ? "text-muted" : "text-faint"}`} title={raisonPlace(lecture.place)}>
              {libellePlace(lecture.place) ?? ""}
            </span>
          </div>
          {lecture.moustache && lecture.valeur !== null && (
            <div className="mt-2">
              <MiniMoustache moustache={lecture.moustache} valeur={lecture.valeur} format="story" metrique={metrique} />
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[12.5px] text-muted">{lecture.place.etat === "sans_metrique" && lecture.place.phrase}</p>
      )}

      <h3 className="mt-5 text-[13px] font-semibold text-ink">Les stories, dans l&apos;ordre</h3>
      <ol className="mt-2 grid gap-3">
        {j.stories.map((s, i) => (
          <CarteStory key={s.id} s={s} rang={i + 1} />
        ))}
      </ol>
    </PanneauLateral>
  );
}

function CarteStory({ s, rang }: { s: Story; rang: number }) {
  const raison = raisonStory(s);
  const releve = texteReleve(s);
  return (
    <li className="flex min-w-0 gap-3 rounded-xl border border-line p-3">
      {s.image ? (
        // URL signée du bucket privé, une heure (`donnees-stories.ts`).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.image} alt="" loading="lazy" className="h-28 w-16 shrink-0 rounded-lg border border-line object-cover" />
      ) : (
        <span className="block h-28 w-16 shrink-0 rounded-lg border border-line bg-black/[0.04]" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-muted">
          <b className="text-ink">Story {rang}</b> · publiée à {s.publieeA.slice(11, 16)} (UTC)
          {s.mediaType === "VIDEO" && " · vidéo, vue par sa vignette"}
        </p>
        {raison ? (
          <p className="mt-1 text-[12.5px] text-muted">
            <span className="tabular-nums text-ink">{TIRET}</span> {raison}
          </p>
        ) : (
          <>
            <dl className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1 text-[12.5px]">
              <Chiffre nom="Portée" valeur={formaterValeur("portee", s.portee)} />
              <Chiffre nom="Vues" valeur={compte(s.comptes.vues)} />
              <Chiffre nom="Clics" valeur={compte(s.comptes.clicsLien)} aide={s.comptes.clicsLien === 0 ? ZERO_CLIC : undefined} />
            </dl>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] sm:grid-cols-4">
              {NAVIGATION.map((n) => (
                <Chiffre key={n.cle} nom={n.nom} valeur={compte(s.comptes[n.cle])} />
              ))}
            </dl>
          </>
        )}
        {releve && <p className="mt-1.5 text-[11.5px] text-faint">{releve}</p>}
      </div>
    </li>
  );
}

function Chiffre({ nom, valeur, aide }: { nom: string; valeur: string; aide?: string }) {
  return (
    <div className="min-w-0" title={aide}>
      <dt className="text-[11px] text-faint">{nom}</dt>
      <dd className="tabular-nums text-ink">{valeur}</dd>
      {aide && <dd className="text-[10.5px] text-faint">{aide}</dd>}
    </div>
  );
}
