// PROTOTYPE, À RETIRER AVANT LE COMMIT — ticket 05 de `.scratch/meta-ads/`
// (« Les 3-4 modules du dashboard, et leur ordre »). Le dashboard Meta Ads en
// une version, le prisme Notoriété / Trafic / Conversion en `?categorie=`, `?campagne=`, `?periode=`. Données inventées, en
// dur : la question est la forme, pas la récolte.
//
// Rangé sous `/meta` pour être vu DANS l'app, avec sa colonne latérale et la
// session de David. Tout le dossier part avant le commit — `git grep
// prototype-modules` doit être vide, et `npm run build` retrouve son compte de
// routes.
import { Suspense } from "react";
import { Prototype } from "./prototype";

export default function PrototypeModules() {
  return (
    <Suspense>
      <Prototype />
    </Suspense>
  );
}
