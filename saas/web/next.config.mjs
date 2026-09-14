/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Les trois pages légales LISENT leur `.md` dans `legal/` au moment du
    // rendu. Le chemin est construit (`path.join(process.cwd(), "legal", f)`),
    // donc le traçage de fichiers de Next ne peut pas le deviner : sans cette
    // liste, les `.md` ne partent PAS dans le bundle serverless et les trois
    // pages tombent en 500 en production — en local elles marcheraient très
    // bien. C'est exactement le genre d'écart qui se découvre sur l'URL qu'on
    // vient de donner à un reviewer Google.
    //
    // Vérifié après coup dans `.next/server/app/<route>/page.js.nft.json` : Next
    // trace le dossier `legal/` ENTIER sur les trois routes, pas seulement le
    // fichier nommé ici. Les dossiers de vérification voyagent donc avec — ils
    // ne sont servis par aucune route (le slug est une union fermée, il n'y a
    // pas de chemin à traverser) et ne portent aucun secret. C'est du poids,
    // pas une fuite ; noté pour que la prochaine session ne le redécouvre pas.
    outputFileTracingIncludes: {
      "/privacy": ["./legal/PRIVACY_POLICY.md"],
      "/terms": ["./legal/TERMS_OF_SERVICE.md"],
      "/suppression": ["./legal/DATA_DELETION.md"],
    },
  },
};
export default nextConfig;
