"use client";

// Un échec doit se voir et se comprendre : un clic sans réponse est la chose
// qui fait le plus douter d'un produit. Ce bloc vivait en double, inline, dans
// « Ce que tu dois faire » et dans les boutons de conseil.
export function Erreur({ texte, onFermer }: { texte: string; onFermer: () => void }) {
  return (
    <div className="mt-2 text-[11.5px] leading-snug text-neg bg-neg/[0.06] border border-neg/25 rounded-lg px-3 py-2">
      {texte}
      <button onClick={onFermer} className="block mt-1 text-[10.5px] font-semibold text-faint">
        fermer
      </button>
    </div>
  );
}
