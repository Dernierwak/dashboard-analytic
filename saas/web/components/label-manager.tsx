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

export function LabelRow({ row, priority }: { row: LabelRowData; priority: boolean }) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm-delete">("view");
  const [newName, setNewName] = useState(row.name);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = row.meta + row.google + row.instagram;

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
      {/* ★ Prioritaire (max 3) — le moteur concentre ses conseils dessus */}
      <button
        disabled={pending}
        title={priority ? "Retirer des priorités" : "Marquer prioritaire (3 max)"}
        onClick={() =>
          startTransition(async () => {
            const r = await togglePriorityLabel(row.name, priority);
            setMessage(r.ok ? null : r.message ?? null);
          })
        }
        className={`text-[16px] leading-none transition-colors disabled:opacity-50 ${
          priority ? "text-warn" : "text-line hover:text-warn/60"
        }`}
      >
        {priority ? "★" : "☆"}
      </button>
      {mode === "rename" ? (
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          autoFocus
          className="rounded-lg border border-brand bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none w-44"
        />
      ) : (
        <span className="text-[13.5px] font-semibold text-ink">{row.name}</span>
      )}

      <span className="text-[11.5px] text-faint">
        <span style={{ color: "#1a56ff" }}>▣</span> {row.meta} ·{" "}
        <span style={{ color: "#1a7a4a" }}>◆</span> {row.google} ·{" "}
        <span style={{ color: "#7b4fff" }}>◎</span> {row.instagram}
        {total === 0 && <span className="ml-1.5">— jamais utilisé</span>}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {mode === "view" && (
          <>
            <button
              onClick={() => setMode("rename")}
              className="text-[11px] font-semibold text-muted border border-line rounded-full px-2.5 py-1 hover:bg-black/[0.03]"
            >
              Renommer
            </button>
            <button
              onClick={() => setMode("confirm-delete")}
              className="text-[11px] font-semibold text-muted border border-line rounded-full px-2.5 py-1 hover:bg-black/[0.03]"
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
                  if (r.ok) setMode("view");
                })
              }
              className="text-[11px] font-semibold text-white bg-brand rounded-full px-3 py-1 disabled:opacity-40"
            >
              {pending ? "…" : "OK"}
            </button>
            <button
              onClick={() => {
                setMode("view");
                setNewName(row.name);
                setMessage(null);
              }}
              className="text-[11px] text-faint"
            >
              annuler
            </button>
          </>
        )}
        {mode === "confirm-delete" && (
          <>
            <span className="text-[11px] text-neg font-medium">
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
              className="text-[11px] font-semibold text-white bg-neg rounded-full px-3 py-1 disabled:opacity-40"
            >
              {pending ? "…" : "Supprimer"}
            </button>
            <button onClick={() => setMode("view")} className="text-[11px] text-faint">
              annuler
            </button>
          </>
        )}
      </div>
      {message && <p className="w-full text-[11px] text-neg">{message}</p>}
    </div>
  );
}
