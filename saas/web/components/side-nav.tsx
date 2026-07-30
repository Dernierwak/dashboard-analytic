"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { FetchButton } from "@/components/fetch-button";
import { CompteSwitch } from "@/components/compte-switch";
import type { CompteActif } from "@/lib/account";

// La navigation passe sur le côté. Trois raisons, dans l'ordre d'importance :
//  · six onglets alignés en haut se lisent comme une frise indistincte ; en
//    colonne, chacun a sa ligne et se repère du premier coup ;
//  · la place ainsi libérée en haut revient au contenu (le verdict de la
//    semaine gagne un écran entier sur mobile) ;
//  · une colonne fixe peut porter en permanence ce qu'on doit savoir sans
//    chercher : le compte regardé, ce qu'on doit faire, la fraîcheur des
//    données. Une barre horizontale n'a jamais la place pour ça.
// Sur téléphone elle redevient une barre horizontale : une colonne y mangerait
// la moitié de l'écran.

const NAV: { href: string; label: string; glyphe?: string }[] = [
  { href: "/", label: "Rapport" },
  { href: "/labels", label: "Thèmes", glyphe: "◫" },
  { href: "/couts", label: "Coûts" },
  { href: "/meta", label: "Meta", glyphe: "▣" },
  { href: "/google", label: "Google", glyphe: "◆" },
  { href: "/instagram", label: "Instagram", glyphe: "◎" },
  { href: "/equipe", label: "Équipe" },
];

export type InfosNav = {
  aFaire: number;
  fraicheur: string | null; // « données au 27 jul »
};

export function SideNav({ compte, infos }: { compte: CompteActif; infos: InfosNav }) {
  const path = usePathname() ?? "/";
  const actif = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <aside className="lg:w-[232px] lg:shrink-0 lg:h-screen lg:sticky lg:top-0 border-b lg:border-b-0 lg:border-r border-line bg-white/70 backdrop-blur">
      <div className="flex lg:flex-col lg:h-full items-center lg:items-stretch gap-3 lg:gap-0 px-4 lg:px-4 py-3 lg:py-5">
        <span className="text-[14px] font-bold tracking-tight text-ink lg:mb-5 shrink-0">
          Pulse
        </span>

        <nav className="flex lg:flex-col items-center lg:items-stretch gap-1 overflow-x-auto lg:overflow-visible flex-1 lg:flex-none min-w-0">
          {NAV.map((n) => {
            const on = actif(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2 text-[13px] rounded-lg px-3 py-2 lg:py-2.5 whitespace-nowrap transition-colors ${
                  on
                    ? "bg-ink text-white font-semibold"
                    : "text-ink/75 hover:bg-black/[0.05] font-medium"
                }`}
              >
                {n.glyphe && (
                  <span className={`text-[13px] ${on ? "text-white/70" : "text-faint"}`}>
                    {n.glyphe}
                  </span>
                )}
                {n.label}
                {n.href === "/" && infos.aFaire > 0 && (
                  <span
                    className={`ml-auto text-[10.5px] font-bold rounded-full px-1.5 py-0.5 ${
                      on ? "bg-white/20 text-white" : "bg-brand text-white"
                    }`}
                  >
                    {infos.aFaire}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Ce qu'on doit savoir en permanence, sans avoir à le chercher */}
        <div className="hidden lg:block mt-5 pt-4 border-t border-line">
          <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-2">
            Où on en est
          </div>
          <div className="text-[12px] text-ink leading-relaxed">
            {infos.aFaire > 0 ? (
              <>
                <span className="font-semibold">{infos.aFaire}</span> action
                {infos.aFaire > 1 ? "s" : ""} à faire
              </>
            ) : (
              <span className="text-muted">Rien en cours</span>
            )}
          </div>
          {infos.fraicheur && (
            <div className="text-[11px] text-faint mt-1">{infos.fraicheur}</div>
          )}
        </div>

        <div className="lg:mt-auto flex lg:flex-col items-center lg:items-stretch gap-2 lg:gap-2.5 lg:pt-4 shrink-0">
          <CompteSwitch comptes={compte.comptes} actif={compte.uid} />
          {compte.peutEditer && <FetchButton />}
          <span className="hidden lg:block text-[10.5px] text-faint truncate" title={compte.email}>
            {compte.email}
          </span>
          <form action="/auth/signout" method="post" className="hidden lg:block">
            <button
              type="submit"
              className="w-full text-[11px] text-muted border border-line rounded-full px-3 py-1.5 hover:bg-black/[0.03] transition-colors"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
