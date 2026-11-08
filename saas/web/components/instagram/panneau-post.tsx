import { PanneauLateral } from "@/components/meta/panneau";
import { MiniMoustache } from "@/components/instagram/annee/mini-moustache";
import { AgePost } from "@/components/instagram/age";
import { aUnePlace, dateCourte, formaterValeur, formaterVisionnage, libellePlace, raisonPlace, TIRET } from "@/lib/instagram/tableau";
import { METRIQUES, NOM_FORMAT, type CleMetrique } from "@/lib/instagram/lecture";
import { lecteurDe, type LecturePost } from "@/lib/instagram/panneau";

// ── LE PANNEAU « LIRE UN POST » ──────────────────────────────────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Panneau latéral — lire un post » ;
// user story 29. Ouvert par `?post=` depuis le nuage, la liste des 5
// meilleurs ou le Tableau. Le cadre est celui de la page Meta
// (`PanneauLateral` : Échap, voile, fermer = `replace` vers `fermeture`) ;
// le calcul est `lecturePostDe` (`lib/instagram/panneau.ts`, harnais du
// ticket 11). Absents, comme la spec le veut : le carrousel entier et les
// commentaires.

export function PanneauPost({
  lecture,
  metrique,
  phraseHebdo,
  fermeture,
}: {
  lecture: LecturePost;
  metrique: CleMetrique;
  /** `phraseEcartHebdo` — `null` quand aucun rapport n'a listé ce post avant
   *  son dernier relevé. */
  phraseHebdo: string | null;
  fermeture: string;
}) {
  const p = lecture.post;
  const lecteur = lecteurDe(p);
  const nom = METRIQUES[metrique].nom;
  return (
    <PanneauLateral
      titre={`${p.format ? NOM_FORMAT[p.format] : "Post"} du ${dateCourte(p.date)}`}
      sousTitre={
        <>
          {lecture.age ? (
            <AgePost post={p} />
          ) : (
            <span>Dernier relevé : {dateCourte(p.releveA)}</span>
          )}
          {p.boosteVuLe && <span className="rounded-full border border-line px-1.5 py-px text-[11px]">Boosté</span>}
        </>
      }
      fermeture={fermeture}
    >
      {lecteur ? (
        // Le lecteur public d'Instagram : Pulse ne garde que l'image, et le
        // lien vidéo de Meta expire (spec). 520 px : la hauteur du Panneau du
        // prototype D retenu par David (maquette jetable, jamais versionnée) — pas
        // remesurée sur un vrai Reel dans un navigateur.
        <iframe
          src={lecteur}
          title="Le post sur Instagram"
          loading="lazy"
          className="h-[520px] w-full rounded-xl border border-line"
          allow="encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="w-full rounded-xl border border-line object-cover" />
        )
      )}

      {p.permalink && (
        <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[13px] font-medium text-ink underline-offset-2 hover:underline">
          Voir sur Instagram ↗
        </a>
      )}
      <p className="mt-3 whitespace-pre-line text-[13.5px] text-ink/85">{p.legende || "(sans légende)"}</p>

      <div className="mt-5 rounded-xl bg-canvas p-4">
        <div className="text-[12px] text-muted">{nom}</div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <b className="text-[22px] tabular-nums text-ink">{formaterValeur(metrique, lecture.valeur)}</b>
          <span className="text-[13px] text-muted" title={raisonPlace(lecture.place)}>
            {libellePlace(lecture.place) ?? ""}
          </span>
        </div>
        {lecture.moustache && lecture.valeur !== null && p.format && (
          <div className="mt-2">
            <MiniMoustache moustache={lecture.moustache} valeur={lecture.valeur} format={p.format} metrique={metrique} />
          </div>
        )}
        {p.boosteVuLe && <p className="mt-2 text-[12px] text-muted">Chiffres organiques, hors boost — Instagram les rend ainsi.</p>}
      </div>

      <h3 className="mt-5 text-[13px] font-semibold text-ink">Sa place sur chaque métrique</h3>
      <table className="mt-2 w-full text-[13px]">
        <tbody>
          {lecture.places.map((x) => {
            const place = libellePlace(x.place);
            return (
              <tr key={x.metrique} className={`border-t border-line ${x.metrique === metrique ? "font-semibold" : ""}`}>
                <th scope="row" className="py-1.5 pr-2 text-left font-normal text-muted">
                  {METRIQUES[x.metrique].nom}
                </th>
                <td className="py-1.5 pr-2 text-right tabular-nums text-ink">{formaterValeur(x.metrique, x.valeur)}</td>
                <td className={`py-1.5 text-right ${aUnePlace(x.place) ? "text-ink" : "text-faint"}`} title={raisonPlace(x.place)}>
                  {place ?? TIRET}
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-line">
            <th scope="row" className="py-1.5 pr-2 text-left font-normal text-muted" title="Instagram ne le donne que pour un Reel">
              Temps de visionnage moyen
            </th>
            <td className="py-1.5 pr-2 text-right tabular-nums text-ink">{formaterVisionnage(lecture.visionnage)}</td>
            <td />
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-faint">
        « {TIRET} » : Instagram n&apos;a rien rendu, ce n&apos;est pas un zéro. La place se lit parmi tes posts du même format des 12
        derniers mois.
      </p>

      {phraseHebdo && <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-muted">{phraseHebdo}</p>}
    </PanneauLateral>
  );
}

/** Un `?post=` qui ne désigne aucun post du compte (lien partagé d'un autre
 *  compte, post retiré de la base) : on le dit plutôt que de rien ouvrir. */
export function PanneauPostIntrouvable({ fermeture }: { fermeture: string }) {
  return (
    <PanneauLateral titre="Post introuvable" fermeture={fermeture}>
      <p className="text-[14px] text-muted">Ce post n&apos;est pas dans les posts Instagram de ce compte.</p>
    </PanneauLateral>
  );
}
