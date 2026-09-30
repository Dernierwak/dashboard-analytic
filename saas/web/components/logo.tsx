// LE LOGO — une feuille d'encre au coin corné, et le pouls qui y est écrit.
//
// Il était un carré bleu arrondi portant une ligne de pouls : le pictogramme
// de n'importe quelle appli de santé. La feuille dit ce que Pulse livre (un
// rapport, chaque semaine), le pouls ce qu'il y relève. Même dessin que
// `IconeRapport`, en plein : la marque et l'entrée « Rapport » se répondent.
//
// `anime` : le pouls s'écrit une fois (`.trace-pouls`, `globals.css`) — sur la
// page de connexion seulement, le seul mouvement non demandé de l'application.
export function Logo({ mot = true, anime = false, taille = 28 }: { mot?: boolean; anime?: boolean; taille?: number }) {
  return (
    <span className="flex items-center gap-2 shrink-0">
      <svg viewBox="0 0 28 28" width={taille} height={taille} aria-hidden focusable="false" className="shrink-0">
        <path d="M6.5 2.5h11.2L23.5 8.3V24a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 24V4a1.5 1.5 0 0 1 1.5-1.5z" className="fill-brand" />
        <path d="M17.7 2.5v4.3a1.5 1.5 0 0 0 1.5 1.5h4.3z" fill="#fff" fillOpacity="0.35" />
        <path
          d="M8.5 16.5h2.6l1.7-4.6 2.6 7.6 1.8-3h2.4"
          fill="none"
          stroke="#fff"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={40}
          className={anime ? "trace-pouls" : undefined}
        />
      </svg>
      {mot && (
        <span className="font-serif text-[20px] leading-none font-medium tracking-[-0.02em] text-ink">
          Pulse
        </span>
      )}
    </span>
  );
}
