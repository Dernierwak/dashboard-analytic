// Le point de la semaine — données réelles, lues dans `weekly_reports`, publié
// en headless par `saas/data/supabase/processed_data/weekly_report/builder.py` (cron du Jour de travail).
//
// CETTE PAGE NE CONSEILLE RIEN, ELLE CONSTATE.
//
// ELLE N'EST QU'UNE SUITE DE SLOTS, un composant par bloc du payload
// (`components/hebdo/`). Chaque ticket du chantier hebdo
// (`.scratch/hebdo/tickets/`) construit SON composant sans toucher ce fichier ;
// un bloc pas encore construit rend l'ancien affichage, ou rien.

import { getWeeklyData } from "@/lib/report";
import { getChangementsApi } from "@/lib/changements-api";
import { SetupWizard } from "@/components/setup-wizard";
import { TitreSemaine, CompteNeuf } from "@/components/hebdo/titre-semaine";
import { BandeauTotaux } from "@/components/hebdo/bandeau-totaux";
import { RailCanaux } from "@/components/hebdo/rail-canaux";
import { CeQuiAEteFait } from "@/components/hebdo/ce-qui-a-ete-fait";
import { AnciensChangements } from "@/components/hebdo/changements-canal";


export const dynamic = "force-dynamic";

export default async function Page() {
  // Les changements que les plateformes déclarent, sur 90 jours : Google Ads ne
  // garde `change_event` que trente jours et Meta un peu plus — demander plus
  // large ne coûte rien. Lancée SANS être attendue, en même temps que
  // `getWeeklyData` : `AnciensChangements` l'attend lui-même.
  const depuisChg = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const changementsApi = getChangementsApi(depuisChg);
  const data = await getWeeklyData();
  const report = data.report;

  // L'HEURE DU RENDU, LUE UNE FOIS : le prochain passage et la carte du compte
  // neuf se calculent sur le même instant.
  const maintenant = new Date();

  return (
    // PAS DE `max-w-*` SUR LE CONTENEUR : `<main>` vit déjà à côté de la
    // colonne latérale (redimensionnable, `components/side-nav.tsx`), un
    // plafond fixe serait toujours faux à une autre largeur. Les paragraphes
    // portent chacun leur plafond en `ch`.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

      {/* Le fil de mise en place reste en tête tant qu'une étape est ouverte ;
          il rend `null` quand tout est franchi
          (`.scratch/refonte/issues/10-l-entree-premier-ecran.md`, point 2). */}
      <SetupWizard
        onboarded={data.onboarded}
        jourDeTravail={data.jourDeTravail}
        maintenantIso={maintenant.toISOString()}
      />

      {report ? (
        <>
          <TitreSemaine
            report={report}
            publieLe={data.publieLe}
            jourDeTravail={data.jourDeTravail}
            maintenant={maintenant}
          />
          <BandeauTotaux report={report} />
          <RailCanaux report={report} />
          <CeQuiAEteFait report={report} />
          <AnciensChangements report={report} changementsApi={changementsApi} />
        </>
      ) : (
        // AUCUN RAPPORT N'EXISTE ENCORE : une seule carte, qui dit quand
        // revenir (spec hebdo, tableau des états, « compte neuf »).
        <CompteNeuf jourDeTravail={data.jourDeTravail} maintenant={maintenant} />
      )}
    </main>
  );
}
