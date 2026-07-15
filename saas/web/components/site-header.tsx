import { FetchButton } from "@/components/fetch-button";

export type PageKey = "rapport" | "couts" | "meta" | "google" | "instagram" | "labels";

const NAV: { key: PageKey; href: string; label: string }[] = [
  { key: "rapport", href: "/", label: "Rapport" },
  { key: "couts", href: "/couts", label: "Coûts" },
  { key: "meta", href: "/meta", label: "▣ Meta" },
  { key: "google", href: "/google", label: "◆ Google" },
  { key: "instagram", href: "/instagram", label: "◎ Instagram" },
  { key: "labels", href: "/labels", label: "Labels" },
];

// Header commun : logo, navigation, mes données, email, déconnexion.
export function SiteHeader({ email, active }: { email: string; active: PageKey }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[13px] font-bold tracking-tight text-ink">Pulse</span>
        <nav className="flex items-center gap-1 flex-wrap">
          {NAV.map((n) => (
            <a
              key={n.key}
              href={n.href}
              className={`text-[12px] rounded-full px-3 py-1 transition-colors whitespace-nowrap ${
                active === n.key
                  ? "bg-ink text-white font-semibold"
                  : "text-muted hover:bg-black/[0.04] font-medium"
              }`}
            >
              {n.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <FetchButton />
        <span className="text-[11px] text-faint hidden lg:inline">{email}</span>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-[11px] text-muted border border-line rounded-full px-3 py-1 hover:bg-black/[0.03] transition-colors whitespace-nowrap"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
