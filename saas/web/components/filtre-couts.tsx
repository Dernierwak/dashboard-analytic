"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// LE FILTRE DE LA PAGE COÛTS — une période, et autant de thèmes qu'on veut.
//
// Deux choix de forme, tous deux dictés par l'usage :
//
// · les thèmes se COCHENT, ils ne se choisissent pas dans un menu. « Combien
//   me coûtent l'e-bike ET l'Audio Tour ensemble » est la question qu'on pose
//   vraiment ; un `<select>` simple oblige à la poser deux fois et à
//   additionner de tête. Chaque thème garde sa couleur — la même que dans
//   l'anneau juste en dessous, la même que dans le rapport ;
//
// · l'état vit dans l'URL, pas dans un `useState`. La page est rendue côté
//   serveur : c'est le serveur qui refiltre l'anneau et la courbe, donc l'état
//   doit voyager avec l'adresse. Effet de bord voulu — une vue filtrée se
//   partage et se met en favori.
//
// Les thèmes sont passés en paramètres répétés (`?l=a&l=b`) et non en liste
// séparée par des virgules : un thème peut contenir une virgule, la liste
// deviendrait deux thèmes fantômes.

const PRESETS = [
  { cle: "30", mot: "30 jours" },
  { cle: "90", mot: "90 jours" },
  { cle: "mois", mot: "Ce mois" },
  { cle: "an", mot: "Cette année" },
];

export function FiltreCouts({
  labels,
  choisis,
  preset,
  from,
  to,
  teintes,
}: {
  labels: string[];
  choisis: string[];
  preset: string;
  from?: string;
  to?: string;
  /** La couleur de chaque thème, calculée côté serveur avec l'univers complet. */
  teintes: Record<string, { trait: string; aplat: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");
  const pris = new Set(choisis);

  const pousser = (q: URLSearchParams) => router.push(`${pathname}?${q.toString()}`);

  const setPreset = (cle: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set("p", cle);
    q.delete("from");
    q.delete("to");
    pousser(q);
  };

  const basculer = (l: string) => {
    const q = new URLSearchParams(sp.toString());
    q.delete("l");
    const suivant = pris.has(l) ? choisis.filter((x) => x !== l) : [...choisis, l];
    for (const x of suivant) q.append("l", x);
    pousser(q);
  };

  const toutVoir = () => {
    const q = new URLSearchParams(sp.toString());
    q.delete("l");
    pousser(q);
  };

  const dates = () => {
    if (!f || !t || f > t) return;
    const q = new URLSearchParams(sp.toString());
    q.set("from", f);
    q.set("to", t);
    q.delete("p");
    pousser(q);
  };

  const surMesure = Boolean(from && to);
  const pastille =
    "text-[11.5px] font-semibold rounded-full px-3 py-1.5 border transition-colors";

  return (
    <div className="bg-white border border-line rounded-xl shadow-card px-4 py-3.5 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-faint font-bold mr-1">
          Période
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.cle}
            onClick={() => setPreset(p.cle)}
            className={`${pastille} ${
              !surMesure && preset === p.cle
                ? "bg-ink text-white border-ink"
                : "border-line text-muted bg-white hover:bg-black/[0.03]"
            }`}
          >
            {p.mot}
          </button>
        ))}
        {/* La période sur mesure prend TOUTE la ligne sur téléphone : mêlée aux
            quatre presets, elle produisait un « Cette année · ou du · [date] »
            sur une même rangée, où plus rien ne se distinguait. */}
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto sm:ml-1">
          <span className="text-[11px] text-faint">ou du</span>
          <input
            type="date"
            value={f}
            onChange={(e) => setF(e.target.value)}
            className="rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] text-muted outline-none focus:border-brand"
          />
          <span className="text-[11px] text-faint">au</span>
          <input
            type="date"
            value={t}
            onChange={(e) => setT(e.target.value)}
            className="rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] text-muted outline-none focus:border-brand"
          />
          <button
            onClick={dates}
            disabled={!f || !t || f > t}
            className={`${pastille} disabled:opacity-40 ${
              surMesure
                ? "bg-ink text-white border-ink"
                : "border-line text-muted bg-white hover:bg-black/[0.03]"
            }`}
          >
            OK
          </button>
        </div>
      </div>

      {labels.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-line">
          <span className="text-[10px] uppercase tracking-widest text-faint font-bold mr-1">
            Thèmes
          </span>
          <button
            onClick={toutVoir}
            className={`${pastille} ${
              choisis.length === 0
                ? "bg-ink text-white border-ink"
                : "border-line text-muted bg-white hover:bg-black/[0.03]"
            }`}
          >
            Tous
          </button>
          {labels.map((l) => {
            const actif = pris.has(l);
            const teinte = teintes[l];
            return (
              <button
                key={l}
                onClick={() => basculer(l)}
                className={`${pastille} inline-flex items-center gap-1.5 ${
                  actif ? "text-ink" : "border-line text-muted bg-white hover:bg-black/[0.03]"
                }`}
                style={
                  actif && teinte
                    ? { background: teinte.aplat, borderColor: teinte.trait }
                    : undefined
                }
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 border-2"
                  style={{
                    background: actif ? teinte?.trait : teinte?.aplat,
                    borderColor: teinte?.trait,
                  }}
                />
                {l}
              </button>
            );
          })}
          {choisis.length > 0 && (
            <span className="text-[11px] text-faint">
              {choisis.length} thème{choisis.length > 1 ? "s" : ""} sur {labels.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
