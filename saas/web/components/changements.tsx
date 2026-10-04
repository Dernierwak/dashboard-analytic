import type { ChangementPlateforme } from "@/lib/report";
import type { ChangementApi } from "@/lib/changements-api";
import { CANAL, dateCourte, phraseChangement } from "@/components/etat-action";

// CE QUI A BOUGÉ SUR TES PLATEFORMES — une chronologie de FAITS, rien d'autre.
//
// Ce module est ce qui reste du « rail d'actions ». Le rail mêlait deux objets
// de nature opposée : les actions que le client avait décidées (jugées plus
// tard par un verdict) et les faits survenus sur ses plateformes. Les premières
// sont parties avec le suivi des recommandations ; les seconds restent, parce
// qu'ils répondent à une question que Pulse doit continuer de tenir — quand la
// courbe bouge, qu'est-ce qui a changé ce jour-là.
//
// Un fait ne porte NI pastille NI verdict, et ce n'est pas un oubli : on ne
// juge pas ce qui s'est simplement produit. D'où le glyphe de canal, jamais la
// pastille ronde qui désignait une décision.
//
// DEUX SORTES DE FAITS, ET LE DÉCLARÉ GAGNE.
//
// Les nôtres sont DÉDUITS de la dépense quotidienne : robustes, mais aveugles —
// ils constatent une conséquence sans nommer la cause. Ceux des API
// (`getChangementsApi`) sont DÉCLARÉS : la plateforme dit ce qui a été touché,
// le budget, un mot-clé, une audience. Quand les deux racontent le même fait le
// même jour sur la même campagne, on garde le déclaré : « le budget est passé
// de 30 à 75 CHF » vaut mieux que « sa dépense quotidienne a changé ».
//
// La clé de rapprochement est volontairement grossière — jour + canal +
// campagne, sans regarder la catégorie. Un changement de budget déclaré et une
// dépense qui bouge le même jour sur la même campagne SONT le même événement vu
// de deux côtés ; exiger que les catégories concordent ferait apparaître les
// deux lignes, ce qui est précisément le doublon qu'on veut éviter.

export const MOT_CATEGORIE: Record<string, string> = {
  budget: "budget",
  motcle: "mot-clé",
  enchere: "enchère",
  statut: "statut",
  audience: "audience",
  creatif: "visuel",
  creation: "création",
  autre: "réglage",
};

type Fait = {
  date: string;
  canal: string;
  campagne: string;
  phrase: string;
  detail?: string | null;
  /** « budget », « mot-clé »… — absent des faits déduits, qui ne le savent pas. */
  quoi?: string | null;
};

function LigneFait({ f, dense = false }: { f: Fait; dense?: boolean }) {
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
        </span>
      </div>
      <div className="text-[13px] text-muted leading-snug mt-0.5">
        <b className="text-ink font-semibold">{f.campagne}</b> {f.phrase}
        {f.detail && <span className="text-faint"> — {f.detail}</span>}
      </div>
    </div>
  );
}

/** Sépare les faits survenus des campagnes simplement programmées.
 *
 *  Exporté parce que la page d'accueil a besoin de compter les deux avant de
 *  décider si le module vaut d'être rendu. Deux comptages écrits séparément
 *  finiraient par diverger.
 */
export function trierChangements(
  changements: ChangementPlateforme[] = [],
  changementsApi: ChangementApi[] = []
) {
  // Le déclaré efface le déduit qui raconte le même fait.
  const couverts = new Set(
    changementsApi
      .filter((c) => c.campagne)
      .map((c) => `${c.date}|${c.canal}|${c.campagne}`)
  );
  // RATTRAPAGE DES ANCIENS RAPPORTS.
  //
  // Jusqu'au 12 août 2026 le worker écrivait « planifiée » pour toute campagne
  // déclarée qui n'avait jamais dépensé, sans regarder ni sa date ni la fenêtre
  // de 60 jours des autres types. Un compte réel affichait donc vingt lignes
  // « est programmée », dont une campagne de Noël 2025 — quinze mois plus tôt.
  //
  // Le worker est corrigé, mais un payload déjà publié porte encore l'erreur :
  // on la rattrape à l'affichage, avec exactement la même règle.
  const auj = new Date().toISOString().slice(0, 10);
  const borne = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const deduits = changements
    .filter((c) => !couverts.has(`${c.date}|${c.canal}|${c.campagne}`))
    .filter((c) => c.type !== "planifiee" || c.date >= borne)
    .map((c) =>
      c.type === "planifiee" && c.date <= auj
        ? { ...c, type: "jamais_lancee" as const }
        : c
    );
  return {
    // « Programmée » n'est pas un événement, c'est un ÉTAT, et il ne vaut qu'en
    // nombre : vingt états datés en pleine chronologie enterrent les trois
    // faits qui comptent. D'où la séparation, et le repli côté rendu.
    programmees: deduits.filter((c) => c.type === "planifiee"),
    survenus: deduits.filter((c) => c.type !== "planifiee"),
  };
}

const faitDeduit = (c: ChangementPlateforme): Fait => ({
  date: c.date,
  canal: c.canal,
  campagne: c.campagne,
  phrase: phraseChangement(c),
  detail: c.detail,
});

export function Changements({
  changements = [],
  changementsApi = [],
  maxH = "max-h-[420px] lg:max-h-[46vh]",
}: {
  /** Ce qu'on a DÉDUIT de la dépense quotidienne. */
  changements?: ChangementPlateforme[];
  /** Ce que les plateformes DÉCLARENT elles-mêmes. Prime sur le déduit. */
  changementsApi?: ChangementApi[];
  maxH?: string;
}) {
  const { programmees, survenus } = trierChangements(changements, changementsApi);

  const lignes = [
    ...survenus.map((c, i) => ({
      cle: `c-${c.canal}-${c.campagne}-${c.type}-${i}`,
      date: c.date,
      fait: faitDeduit(c),
    })),
    ...changementsApi.map((c) => ({
      cle: `api-${c.cle}`,
      date: c.date,
      fait: {
        date: c.date,
        canal: c.canal,
        campagne: c.campagne ?? "Le compte",
        phrase: c.phrase,
        quoi: MOT_CATEGORIE[c.categorie] ?? null,
      } satisfies Fait,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (lignes.length + programmees.length === 0) return null;

  return (
    <div className={`${maxH} defile -mx-1 px-1`}>
      <div className="relative">
        {/* Le fil s'arrête à la dernière ligne plutôt que de courir jusqu'au
            bord : un trait qui déborde promet une suite. */}
        <div className="absolute left-[3px] top-[22px] bottom-[22px] w-px bg-ink/[0.14]" />
        {lignes.map((l) => (
          <LigneFait key={l.cle} f={l.fait} />
        ))}

        {/* CE QUI ATTEND, replié. En dessous de deux, le repli coûterait plus
            qu'il ne range. */}
        {programmees.length === 1 && (
          <LigneFait f={faitDeduit(programmees[0])} />
        )}
        {programmees.length > 1 && (
          <details className="group relative pl-6 py-2">
            <span
              className="absolute left-[-2px] top-[13px] text-[11px] leading-none text-faint"
              aria-hidden
            >
              ◌
            </span>
            <summary className="cursor-pointer select-none list-none text-[12.5px] text-muted leading-snug">
              <b className="text-ink font-semibold">{programmees.length} campagnes</b>{" "}
              programmées, aucune dépense encore{" "}
              <span className="text-brand font-semibold group-open:hidden">voir ▾</span>
              <span className="text-brand font-semibold hidden group-open:inline">replier ▴</span>
            </summary>
            <div className="mt-1 -ml-6">
              {programmees.map((c, i) => (
                <LigneFait
                  key={`pl-${c.canal}-${c.campagne}-${i}`}
                  f={faitDeduit(c)}
                  dense
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
