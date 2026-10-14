// ── LE JOURNAL S'OUVRE SANS REPASSER PAR LE SERVEUR ──────────────────────────
//
// Mesuré en production le 2026-10-14 (ticket 17 de `.scratch/journal-meta/`) :
// ouvrir le jour d'un point par `router.push` prenait 1,7 à 2,1 s, et naviguer
// vers `/meta` sans AUCUN panneau autant (1,8 à 2,9 s). La page est
// `force-dynamic` : chaque navigation relit toutes ses données pour ne changer
// que le panneau. Or le journal de la période est déjà dans la page — le
// panneau du journal se calcule donc dans le navigateur, et seule l'URL change.
//
// `history.pushState` et non `router.push` : Next 14.2 le synchronise avec
// `useSearchParams` sans requête au serveur, et copie son état dans l'entrée
// d'historique, si bien que « retour » restaure la page sans la relire. L'URL
// reste la vérité : un lien partagé ou un rechargement rend le même panneau.
// OUVRIR EMPILE, FERMER REMPLACE, comme le Panneau latéral (`panneau.tsx`).
//
// Ce chemin ne change QUE l'état du journal (`jour`, `element`,
// `panneau=changements`). Les paramètres du dernier rendu serveur sont donc
// périmés sur ces clés-là seulement, et la page les retire de ceux qu'elle
// donne à ses liens (`sansJournal`, `liens.ts`).
//
// Sans directive : appelé seulement depuis des gestionnaires de clic, donc
// jamais au rendu serveur.

export const ouvrirSurPlace = (url: string) => window.history.pushState(null, "", url);
export const fermerSurPlace = (url: string) => window.history.replaceState(null, "", url);
