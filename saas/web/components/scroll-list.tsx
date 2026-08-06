import type { ReactNode } from "react";

// Liste réutilisable — même hiérarchie partout : un en-tête (titre + compteur),
// puis une box à hauteur fixe qui SCROLLE en interne (façon feed). Utilisée
// pour les thèmes, les campagnes, les posts, toute liste longue.
export function ScrollList({
  title,
  count,
  action,
  children,
  maxH = "max-h-[52vh]",
  className = "",
  divise = true,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  maxH?: string;
  className?: string;
  /** false quand le contenu porte déjà sa propre continuité — un rail de frise,
   *  par exemple, que les filets horizontaux viendraient hacher. */
  divise?: boolean;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-[11px] uppercase tracking-wide text-faint font-bold">
          {title}
          {count !== undefined && <span className="text-faint/70"> ({count})</span>}
        </h3>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <div
        className={`${maxH} overflow-y-auto rounded-xl border border-line bg-white ${
          divise ? "divide-y divide-line" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
