// Header commun : logo, navigation, email, déconnexion.
export function SiteHeader({ email, active }: { email: string; active: "rapport" | "couts" }) {
  const link = (href: string, label: string, isActive: boolean) => (
    <a
      href={href}
      className={`text-[12px] rounded-full px-3 py-1 transition-colors ${
        isActive
          ? "bg-ink text-white font-semibold"
          : "text-muted hover:bg-black/[0.04] font-medium"
      }`}
    >
      {label}
    </a>
  );

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <span className="text-[13px] font-bold tracking-tight text-ink">Pulse</span>
        <nav className="flex items-center gap-1">
          {link("/", "Rapport", active === "rapport")}
          {link("/couts", "Coûts", active === "couts")}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-faint hidden sm:inline">{email}</span>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-[11px] text-muted border border-line rounded-full px-3 py-1 hover:bg-black/[0.03] transition-colors"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
