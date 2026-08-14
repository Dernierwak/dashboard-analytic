"use client";

import { useState, useTransition } from "react";
import { createLabel, renameLabel, deleteLabel, togglePriorityLabel } from "@/app/actions";
import type { LabelRowData } from "@/lib/channels";

export function CreateLabel() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-4 mb-6">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nouveau thème — ex. e-bike, Freizeit, promo…"
          className="flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              startTransition(async () => {
                const r = await createLabel(name);
                setMessage(r.message);
                if (r.ok) setName("");
              });
            }
          }}
        />
        <button
          disabled={pending || !name.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = await createLabel(name);
              setMessage(r.message);
              if (r.ok) setName("");
            })
          }
          className="text-[12.5px] font-semibold text-white bg-brand rounded-lg px-4 py-2 hover:bg-brand/90 disabled:opacity-40"
        >
          {pending ? "…" : "Créer"}
        </button>
      </div>
      {message && <p className="text-[11.5px] text-muted mt-2">{message}</p>}
    </div>
  );
}

// Ligne de thème — pensée pouce d'abord : étoile et boutons ≥ 40 px de zone
// tactile, nom bien lisible, actions qui passent à la ligne sur petit écran.
export function LabelRow({
  row,
  priority,
  rang = null,
}: {
  row: LabelRowData;
  priority: boolean;
  /**
   * Le rang de l'étoile, 1 = posée en premier. `null` quand le thème n'est pas
   * étoilé. C'est LE nombre qui rend visible une règle autrement invisible :
   * l'IA ne rédige que les trois premières étoiles, et rien à l'écran ne disait
   * dans quel ordre elles avaient été posées. Une étoile de rang 4 se voit donc
   * comme telle, sur la ligne même où on la retire.
   */
  rang?: number | null;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm-delete">("view");
  const [newName, setNewName] = useState(row.name);
  const [message, setMessage] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = row.meta + row.google + row.instagram;
  // Étoilé, mais après les trois premières : la carte du thème existera, ses
  // conseils calculés aussi, ses pistes IA non.
  const horsIa = priority && rang !== null && rang > 3;

  return (
    <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5 flex-wrap">
      {/* ★ Prioritaire — le moteur concentre ses conseils dessus, et l'IA
          n'en rédige que pour les trois premières. Le message rendu par
          `togglePriorityLabel` s'affiche que l'action ait réussi ou non : ce
          n'est plus un refus, c'est un avertissement. */}
      <button
        disabled={pending}
        title={
          priority
            ? `Retirer des priorités${rang !== null ? ` (★${rang})` : ""}`
            : "Marquer prioritaire — l'IA rédige les 3 premières"
        }
        onClick={() =>
          startTransition(async () => {
            const r = await togglePriorityLabel(row.name, priority);
            setMessage(r.message ?? null);
            setEchec(!r.ok);
          })
        }
        className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-full leading-none transition-colors disabled:opacity-50 ${
          horsIa
            ? "text-warn/45"
            : priority
              ? "text-warn"
              : "text-line hover:text-warn/60 active:text-warn/60"
        }`}
      >
        {priority ? (
          <span className="flex items-baseline">
            <span className="text-[22px]">★</span>
            {rang !== null && <span className="text-[10px] font-bold ml-px">{rang}</span>}
          </span>
        ) : (
          <span className="text-[22px]">☆</span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        {mode === "rename" ? (
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            className="rounded-lg border border-brand bg-canvas px-3 py-2 text-[14px] text-ink outline-none w-full max-w-[240px]"
          />
        ) : (
          <div className="text-[15px] font-semibold text-ink leading-snug truncate">
            {row.name}
          </div>
        )}
        <div className="text-[11.5px] text-faint mt-0.5">
          <span style={{ color: "#1a56ff" }}>▣</span> {row.meta} ·{" "}
          <span style={{ color: "#1a7a4a" }}>◆</span> {row.google} ·{" "}
          <span style={{ color: "#7b4fff" }}>◎</span> {row.instagram}
          {total === 0 && <span className="ml-1.5">— jamais utilisé</span>}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
        {mode === "view" && (
          <>
            <button
              onClick={() => setMode("rename")}
              className="text-[12px] font-semibold text-muted border border-line rounded-full px-3.5 py-2 hover:bg-black/[0.03] active:bg-black/[0.05]"
            >
              Renommer
            </button>
            <button
              onClick={() => setMode("confirm-delete")}
              className="text-[12px] font-semibold text-muted border border-line rounded-full px-3.5 py-2 hover:bg-black/[0.03] active:bg-black/[0.05]"
            >
              Supprimer
            </button>
          </>
        )}
        {mode === "rename" && (
          <>
            <button
              disabled={pending || !newName.trim() || newName === row.name}
              onClick={() =>
                startTransition(async () => {
                  const r = await renameLabel(row.name, newName);
                  setMessage(r.ok ? null : r.message);
                  setEchec(!r.ok);
                  if (r.ok) setMode("view");
                })
              }
              className="text-[12px] font-semibold text-white bg-brand rounded-full px-4 py-2 disabled:opacity-40"
            >
              {pending ? "…" : "OK"}
            </button>
            <button
              onClick={() => {
                setMode("view");
                setNewName(row.name);
                setMessage(null);
              }}
              className="text-[12px] text-faint px-2 py-2"
            >
              annuler
            </button>
          </>
        )}
        {mode === "confirm-delete" && (
          <>
            <span className="text-[11.5px] text-neg font-medium">
              Retiré de {total} élément{total > 1 ? "s" : ""} — sûr ?
            </span>
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteLabel(row.name);
                  setMode("view");
                })
              }
              className="text-[12px] font-semibold text-white bg-neg rounded-full px-4 py-2 disabled:opacity-40"
            >
              {pending ? "…" : "Supprimer"}
            </button>
            <button onClick={() => setMode("view")} className="text-[12px] text-faint px-2 py-2">
              annuler
            </button>
          </>
        )}
      </div>
      {/* UN MESSAGE N'EST PLUS FORCÉMENT UN ÉCHEC. Tout ce qui passait ici
          était rouge, parce que tout ce qui passait ici était un refus. Le
          quatrième étoilage réussit et rend quand même une phrase — la peindre
          en rouge dirait « ça n'a pas marché » d'une action qui a marché. On
          garde donc le rouge pour ce qui a échoué, et le gris pour ce qui
          prévient. */}
      {message && (
        <p
          className={`w-full text-[11.5px] pl-12 leading-relaxed ${
            echec ? "text-neg" : "text-muted"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
