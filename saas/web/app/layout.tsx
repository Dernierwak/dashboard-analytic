import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Instrument_Sans, Newsreader, Caveat } from "next/font/google";
import "./globals.css";
import { getCompteActifOuNull, getInfosNav } from "@/lib/account";
import { COOKIE_NAV, NAV_REPLIEE } from "@/lib/nav-cookie";
import { SideNav } from "@/components/side-nav";

// Trois familles, trois rôles qui ne se recouvrent pas — le détail est dans
// `docs/identite-visuelle.md` :
//  · Instrument Sans : l'interface ET les chiffres (en tabulaires). Sa largeur
//    variable (`wdth`) resserre les libellés de tableau sans changer de police ;
//  · Newsreader : les titres, la voix écrite du rapport. Axe optique inclus —
//    à 40 px il se dessine comme une fonte de titrage, pas comme du texte agrandi ;
//  · Caveat : l'annotation manuscrite, en marge. Un seul poids, chargé seul.
const instrument = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-instrument",
});
const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  // next/font 14.2 n'a pas de métriques de repli pour Newsreader et le dit à
  // chaque build : on renonce à l'ajustement plutôt que de laisser l'erreur.
  adjustFontFallback: false,
});
const caveat = Caveat({ subsets: ["latin"], weight: ["500"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "Pulse — Ta semaine en bref",
  description: "Le rapport hebdo de tes performances marketing.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const compte = await getCompteActifOuNull();
  const infos = compte ? await getInfosNav(compte.uid) : null;
  // Le repli de la barre est lu ICI, et pas dans le composant, pour une seule
  // raison : `localStorage` n'est pas lisible par le serveur. Le lire après
  // hydratation faisait peindre la colonne dépliée à 240 px puis sauter à
  // 64 px, à chaque navigation. Un cookie voyage avec la requête, donc le
  // premier octet de HTML porte déjà la bonne largeur.
  const replieInitial = cookies().get(COOKIE_NAV)?.value === NAV_REPLIEE;
  return (
    <html lang="fr" className={`${instrument.variable} ${newsreader.variable} ${caveat.variable}`}>
      <body className="font-sans antialiased">
        {compte && infos ? (
          <div className="lg:flex lg:items-start">
            <SideNav compte={compte} infos={infos} replieInitial={replieInitial} />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
