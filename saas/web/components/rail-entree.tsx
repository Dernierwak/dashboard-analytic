import type { TrackedAction } from "@/lib/report";
import { CANAL, Effet, Pastille, dateCourte, etat } from "@/components/etat-action";
import { ActionVivante } from "@/components/action-vivante";
import { NoteLigne } from "@/components/note-ligne";

// LES DEUX FORMES D'UNE LIGNE DU FIL, PARTAGÉES.
//
// `Entree` (une décision qu'on juge) et `LigneFait` (un fait de plateforme
// qu'on constate) vivaient dans `rail-actions.tsx`, qui les rendait toutes les
// deux côté serveur. Depuis que « Ce qui s'est passé » se filtre par thème et
// par plateforme (`rail-filtre.tsx`, un composant client — un `<select>` a
// besoin d'état), les deux formes doivent pouvoir être rendues À LA FOIS par
// `rail-actions.tsx` (qui garde « En cours », côté serveur) et par
// `rail-filtre.tsx` (qui rend « Ce qui s'est passé », côté client). Un module
// sans directive se compile dans les deux mondes sans conflit tant qu'il ne
// fait rien de propre à l'un des deux — ce qui est le cas ici : de la mise en
// forme pure, et `ActionVivante` gère déjà sa propre frontière client.

/** Ce que le rail sait afficher d'un fait de plateforme, quelle que soit sa
 *  provenance. Un déclaré porte en plus ce qui a été touché (`quoi`). */
export type Fait = {
  date: string;
  canal: string;
  campagne: string;
  theme: string | null;
  phrase: string;
  detail?: string | null;
  /** « budget », « mot-clé »… — absent des faits déduits, qui ne le savent pas. */
  quoi?: string | null;
};

export const MOT_CATEGORIE: Record<string, string> = {
  budget: "budget",
  motcle: "mot-clé",
  enchere: "enchère",
  statut: "statut",
  audience: "audience",
  creatif: "visuel",
  autre: "réglage",
};

export function Entree({
  a,
  vivante,
  themeCourant,
}: {
  a: TrackedAction;
  vivante: boolean;
  /** Quand le thème de l'action est celui de la carte, on ne le réécrit pas :
   *  il est déjà en titre plus haut. */
  themeCourant: string | null;
}) {
  const e = etat(a);
  return (
    <div className="relative pl-6 py-2.5">
      <span className="absolute left-0 top-[15px]">
        <Pastille e={e} />
      </span>
      <div className="text-[10px] uppercase tracking-widest text-faint font-semibold">
        {dateCourte(a.decided_at)}
        {a.theme && a.theme !== themeCourant && (
          <span className="text-muted normal-case tracking-normal"> · {a.theme}</span>
        )}
      </div>
      <div className="text-[13.5px] text-ink leading-snug mt-0.5">{a.title}</div>
      {vivante ? (
        // La `key` dépend de l'état : sans elle, l'état local du composant
        // client survit à `revalidatePath` et les deux vues du même objet
        // divergent jusqu'au rechargement.
        <ActionVivante key={`${a.id}:${a.status}`} a={a} />
      ) : (
        <div className="text-[11.5px] mt-0.5 flex items-baseline gap-2 flex-wrap">
          <span className={`font-semibold ${e.cls}`}>{e.label}</span>
          <Effet a={a} />
          {a.kind === "note" && <NoteLigne id={a.id} />}
        </div>
      )}
    </div>
  );
}

// UN FAIT, PAS UNE DÉCISION. Le glyphe du canal à la place de la pastille :
// on voit d'un coup d'œil que ça vient de Meta ou de Google et pas de toi.
export function LigneFait({
  f,
  themeCourant,
  dense = false,
}: {
  f: Fait;
  themeCourant: string | null;
  dense?: boolean;
}) {
  const ca = CANAL[f.canal] ?? CANAL.meta;
  return (
    <div className={`relative pl-6 ${dense ? "py-1" : "py-2.5"}`}>
      <span
        className={`absolute left-[-2px] text-[11px] leading-none ${dense ? "top-[5px]" : "top-[11px]"}`}
        style={{ color: ca.couleur }}
        aria-hidden
      >
        {ca.glyphe}
      </span>
      <div className="text-[10px] uppercase tracking-widest text-faint font-semibold">
        {dateCourte(f.date)}
        <span className="text-muted normal-case tracking-normal">
          {" "}· sur {ca.nom}
          {/* Ce que la plateforme dit avoir touché. Absent d'un fait déduit,
              qui ne le sait pas — et on ne le devine pas. */}
          {f.quoi && <> · {f.quoi}</>}
          {f.theme && f.theme !== themeCourant && <> · {f.theme}</>}
        </span>
      </div>
      <div className="text-[13px] text-muted leading-snug mt-0.5">
        <b className="text-ink font-semibold">{f.campagne}</b> {f.phrase}
        {f.detail && <span className="text-faint"> — {f.detail}</span>}
      </div>
    </div>
  );
}
