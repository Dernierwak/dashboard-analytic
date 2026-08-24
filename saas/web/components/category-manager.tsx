"use client";

import { useState, useTransition } from "react";
import {
  createConversionCategory,
  renameConversionCategory,
  deleteConversionCategory,
} from "@/app/actions";
import type { ConversionCategoryRow } from "@/lib/channels";

// MÊME PATRON QUE `label-manager.tsx` (createLabel/renameLabel/deleteLabel),
// sur les catégories de conversions au lieu des thèmes — même geste, deux
// vocabulaires différents (aucune étoile ici : une catégorie n'a pas de
// priorité, contrairement à un thème).

export function CreateCategory() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lancer = () =>
    startTransition(async () => {
      const r = await createConversionCategory(name);
      setMessage(r.message);
      if (r.ok) setName("");
    });

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-4 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nouvelle catégorie — ex. Ventes, Contacts, Engagement…"
          className="flex-1 min-w-[180px] rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) lancer();
          }}
        />
        <button
          disabled={pending || !name.trim()}
          onClick={lancer}
          className="text-[12.5px] font-semibold text-white bg-brand rounded-lg px-4 py-2 hover:bg-brand/90 disabled:opacity-40"
        >
          {pending ? "…" : "Créer"}
        </button>
      </div>
      {message && <p className="text-[11.5px] text-muted mt-2">{message}</p>}
    </div>
  );
}

export function CategoryRow({ row }: { row: ConversionCategoryRow }) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm-delete">("view");
  const [newName, setNewName] = useState(row.name);
  const [message, setMessage] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5 flex-wrap">
      <div className="min-w-0 flex-1">
        {mode === "rename" ? (
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            className="rounded-lg border border-brand bg-canvas px-3 py-2 text-[14px] text-ink outline-none w-full max-w-[240px]"
          />
        ) : (
          <div className="text-[14px] font-semibold text-ink leading-snug truncate">
            {row.name}
          </div>
        )}
        <div className="text-[11.5px] text-faint mt-0.5">
          {row.evenements} événement{row.evenements > 1 ? "s" : ""}
          {row.evenements === 0 && <span className="ml-1.5">— jamais utilisée</span>}
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
                  const r = await renameConversionCategory(row.name, newName);
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
              Retirée de {row.evenements} événement{row.evenements > 1 ? "s" : ""} — sûr ?
            </span>
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteConversionCategory(row.name);
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
      {message && (
        <p
          className={`w-full text-[11.5px] leading-relaxed ${echec ? "text-neg" : "text-muted"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
