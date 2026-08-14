import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { getCompteActifOuNull, getInfosNav } from "@/lib/account";
import { COOKIE_NAV, NAV_REPLIEE } from "@/lib/nav-cookie";
import { SideNav } from "@/components/side-nav";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

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
    <html lang="fr" className={`${dmSans.variable} ${dmMono.variable}`}>
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
