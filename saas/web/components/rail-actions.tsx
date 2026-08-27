import type { ChangementPlateforme, TrackedAction } from "@/lib/report";
import type { ChangementApi } from "@/lib/changements-api";
import { phraseChangement } from "@/components/etat-action";
import { Entree, LigneFait, MOT_CATEGORIE, type Fait } from "@/components/rail-entree";
import { RailFiltre } from "@/components/rail-filtre";

// LE FIL D'ACTIONS — un rail vertical, une pastille par action, du plus urgent
// au plus ancien. La forme suit ce que l'objet EST : une chronologie.
//
// UN SEUL RAIL, DEUX RÉGIMES. Pas deux traits côte à côte : la grammaire
// n'autorise qu'une forme par module, et deux rails dans une colonne de 300 px
// se liraient comme deux listes sans rapport. Ce qui change entre les deux
// régimes, c'est la PASTILLE (creuse = ça court, pleine = c'est jugé, barrée =
// abandonné — le lexique existe déjà) et la PRÉSENCE DE BOUTONS. Une entrée
// close ne porte aucun bouton, et c'est la différence la plus lisible qui soit.
//
// « En cours », le rail vertical et les programmées repliées restent rendus
// ici, côté serveur. Seul « Ce qui s'est passé » a besoin de JavaScript,
// depuis qu'il se filtre par thème et par plateforme (`rail-filtre.tsx`) — un
// `<select>` réclame de l'état, un fil qui se contente d'afficher n'en a pas
// besoin.
//
// LE FIL VOIT AUSSI CE QU'ON N'A PAS FAIT DEPUIS PULSE. Une campagne lancée un
// mardi soir dans le gestionnaire Meta, une autre coupée, une dépense qui
// double : sans elles, le fil raconte un tiers de l'histoire, et quand la
// courbe bouge rien n'explique pourquoi.
//
// Elles ne portent NI pastille NI verdict, et c'est une règle, pas un oubli :
// une pastille ronde désigne ce qu'on a décidé et qui sera jugé, un glyphe de
// canal désigne ce qui s'est simplement produit. On ne juge pas un fait.
//
// DEUX SORTES DE FAITS DE PLATEFORME, ET LE DÉCLARÉ GAGNE.
//
// Les nôtres sont DÉDUITS de la dépense quotidienne : robustes, mais aveugles —
// ils constatent une conséquence sans jamais nommer la cause. Ceux des API
// (`getChangementsApi`) sont DÉCLARÉS : la plateforme dit ce qui a été touché,
// le budget, un mot-clé, une audience. Quand les deux racontent le même fait le
// même jour sur la même campagne, on garde le déclaré et on jette le déduit :
// « le budget est passé de 30 à 75 CHF » vaut mieux que « sa dépense
// quotidienne a changé ».
//
// La clé de rapprochement est volontairement grossière — jour + canal +
// campagne, sans regarder la catégorie. Un changement de budget déclaré et une
// dépense qui bouge le même jour sur la même campagne SONT le même événement vu
// de deux côtés ; exiger que les catégories concordent ferait apparaître les
// deux lignes, ce qui est précisément le doublon qu'on veut éviter.

const ORDRE: Record<string, number> = { juger: 0, running: 1, observation: 2 };

function rang(a: TrackedAction): number {
  // `"auto"` (l'hypothèse d'un thème, posée par le worker sans clic) suit le
  // même rang que `"done"` : à juger une fois l'échéance passée, sinon en
  // observation — jamais « en cours », ce mot désignant un chantier que le
  // client a lui-même choisi de mener.
  if ((a.status === "done" || a.status === "auto") && a.due) return ORDRE.juger;
  if (a.status === "running") return ORDRE.running;
  return ORDRE.observation;
}

export function RailActions({
  actions,
  changements = [],
  changementsApi = [],
  themeCourant = null,
  maxH = "max-h-[420px] lg:max-h-[46vh]",
}: {
  actions: TrackedAction[];
  /** Ce qu'on a DÉDUIT de la dépense quotidienne. */
  changements?: ChangementPlateforme[];
  /** Ce que les plateformes DÉCLARENT elles-mêmes. Prime sur le déduit. */
  changementsApi?: ChangementApi[];
  /** Quand le thème d'une action est celui de la carte, on ne le réécrit pas :
   *  il est déjà en titre 400 px plus haut. Dans le bloc « hors thème », il
   *  varie d'une ligne à l'autre — c'est là qu'il est utile. */
  themeCourant?: string | null;
  maxH?: string;
}) {
  const vivantes = actions
    .filter((a) => a.status === "running" || a.status === "done" || a.status === "auto")
    // L'urgence en haut : « à juger » est la seule chose du rail qui réclame un
    // geste, un tri purement chronologique l'enterrerait sous cinq entrées.
    .sort((a, b) => rang(a) - rang(b) || (a.decided_at < b.decided_at ? 1 : -1));

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
  // Le worker est corrigé, mais un rapport ne se régénère qu'à la demande : les
  // payloads déjà publiés porteraient l'erreur pendant des semaines. On la
  // rattrape donc à l'affichage, avec exactement la même règle, et on la retire
  // le jour où plus aucun payload ancien ne circule.
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

  // LES « PROGRAMMÉE » SORTENT DU FIL. Elles remplissaient le bloc hors thème
  // et noyaient les faits qui comptaient : ce n'est pas un événement, c'est un
  // ÉTAT, et il ne vaut qu'en nombre. Elles se replient en une ligne, dépliable
  // pour qui veut les noms.
  //
  // « Devait démarrer et n'a rien dépensé » ne se replie PAS avec elles : c'est
  // un fait daté, et c'est un problème — une campagne qu'on croyait lancée ne
  // tourne pas. Le repli est réservé à ce qui n'appelle aucune décision.
  const programmees = deduits.filter((c) => c.type === "planifiee");
  const survenus = deduits.filter((c) => c.type !== "planifiee");

  const faitDeduit = (c: ChangementPlateforme): Fait => ({
    date: c.date,
    canal: c.canal,
    campagne: c.campagne,
    theme: c.theme,
    phrase: phraseChangement(c),
    detail: c.detail,
  });

  // Les actions closes et les faits de plateforme se mêlent, triés par date :
  // ce sont deux sortes de faits révolus, et les séparer obligerait à lire deux
  // chronologies pour reconstituer une semaine.
  type Ligne =
    | { cle: string; date: string; action: TrackedAction }
    | { cle: string; date: string; fait: Fait };
  const closes: Ligne[] = [
    ...actions
      .filter((a) => a.status === "archived" || a.status === "dropped")
      .map((a) => ({ cle: `a-${a.id}`, date: a.decided_at, action: a })),
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
        theme: c.theme,
        phrase: c.phrase,
        quoi: MOT_CATEGORIE[c.categorie] ?? null,
      } satisfies Fait,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (vivantes.length + closes.length + programmees.length === 0) return null;

  const Titre = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] uppercase tracking-widest text-faint/80 font-bold pl-6 pt-2 pb-0.5">
      {children}
    </div>
  );

  return (
    <div className={`${maxH} defile -mx-1 px-1`}>
      <div className="relative">
        {/* Le rail s'arrête à la dernière pastille plutôt que de courir jusqu'au
            bord : un trait qui déborde promet une suite. */}
        <div className="absolute left-[3px] top-[22px] bottom-[22px] w-px bg-ink/[0.14]" />
        {vivantes.length > 0 && closes.length > 0 && <Titre>En cours</Titre>}
        {vivantes.map((a) => (
          <Entree key={a.id} a={a} vivante themeCourant={themeCourant} />
        ))}
        {closes.length > 0 && vivantes.length > 0 && <Titre>Ce qui s&apos;est passé</Titre>}
        {/* LE FILTRE NE PORTE QUE SUR « CE QUI S'EST PASSÉ ». Une campagne
            « programmée » n'est pas un événement (voir plus bas) et une action
            « en cours » n'est pas encore un fait révolu — les filtrer donnerait
            l'illusion qu'un thème ou une plateforme n'a RIEN en attente alors
            qu'il en a, simplement pas encore classé. */}
        <RailFiltre closes={closes} themeCourant={themeCourant} />

        {/* CE QUI ATTEND, replié. Une campagne programmée n'est pas un
            événement — c'est un état, et vingt états datés en pleine
            chronologie enterrent les trois faits qui comptent. En dessous de
            deux, le repli coûterait plus qu'il ne range. */}
        {programmees.length === 1 && (
          <LigneFait f={faitDeduit(programmees[0])} themeCourant={themeCourant} />
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
                  themeCourant={themeCourant}
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
