"use client";

import { useState, useTransition } from "react";
import { inviterMembre, changerRoleMembre, revoquerMembre, type Membre } from "@/app/actions";

const ROLES: { v: "editor" | "viewer"; label: string; aide: string }[] = [
  { v: "editor", label: "Peut agir", aide: "coche les actions, reclasse les campagnes, choisit les priorités" },
  { v: "viewer", label: "Lecture seule", aide: "voit tout, ne modifie rien" },
];

export function EquipeManager({ membres }: { membres: Membre[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const inviter = () =>
    startTransition(async () => {
      const r = await inviterMembre(email, role);
      setMsg({ ok: r.ok, texte: r.message });
      if (r.ok) setEmail("");
    });

  return (
    <>
      {/* Inviter */}
      <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-6">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-3">
          Donner l&apos;accès à quelqu&apos;un
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setMsg(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && email && inviter()}
            placeholder="son adresse e-mail"
            className="flex-1 min-w-[220px] rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand"
          />
          <button
            disabled={pending || !email}
            onClick={inviter}
            className="text-[13px] font-semibold text-white bg-brand rounded-lg px-4 py-2.5 hover:bg-brand/90 disabled:opacity-40"
          >
            {pending ? "…" : "Inviter"}
          </button>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {ROLES.map((r) => (
            <button
              key={r.v}
              onClick={() => setRole(r.v)}
              className={`text-left rounded-lg border px-3.5 py-2.5 transition-colors flex-1 min-w-[190px] ${
                role === r.v
                  ? "border-brand bg-brand/[0.05]"
                  : "border-line hover:bg-black/[0.02] bg-white"
              }`}
            >
              <div className={`text-[13px] font-semibold ${role === r.v ? "text-brand" : "text-ink"}`}>
                {role === r.v ? "● " : "○ "}
                {r.label}
              </div>
              <div className="text-[11.5px] text-faint mt-0.5 leading-snug">{r.aide}</div>
            </button>
          ))}
        </div>

        {msg && (
          <p
            className={`text-[12.5px] leading-relaxed mt-3 ${msg.ok ? "text-pos" : "text-neg"}`}
          >
            {msg.ok ? "✓ " : "✕ "}
            {msg.texte}
          </p>
        )}
      </div>

      {/* Qui a accès */}
      <h2 className="text-[11px] uppercase tracking-widest text-faint font-bold mb-2.5">
        Qui a accès ({membres.length})
      </h2>
      {membres.length === 0 ? (
        <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
          <p className="text-[13.5px] text-ink font-medium">Tu es seul sur ce dashboard.</p>
          <p className="text-[12.5px] text-muted mt-1.5 leading-relaxed">
            Invite quelqu&apos;un ci-dessus : il verra tes données et ton rapport dès sa
            prochaine connexion, sans que tu aies rien d&apos;autre à faire.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-xl shadow-card divide-y divide-line">
          {membres.map((m) => (
            <LigneMembre key={m.id} m={m} />
          ))}
        </div>
      )}
    </>
  );
}

function LigneMembre({ m }: { m: Membre }) {
  const [pending, startTransition] = useTransition();
  const [confirme, setConfirme] = useState(false);

  return (
    <div className="px-5 py-3.5 flex items-center gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-ink truncate">{m.member_email}</div>
        <div className="text-[11.5px] text-faint mt-0.5">
          {m.accepted_at ? (
            <span className="text-pos font-semibold">● connecté</span>
          ) : (
            <span className="text-warn font-semibold">◷ pas encore connecté</span>
          )}
          {" · "}
          {m.role === "viewer" ? "lecture seule" : "peut agir"}
        </div>
      </div>

      <select
        disabled={pending}
        value={m.role}
        onChange={(e) =>
          startTransition(async () => {
            await changerRoleMembre(m.id, e.target.value as "viewer" | "editor");
          })
        }
        className="text-[12.5px] rounded-lg border border-line bg-white px-2.5 py-2 text-ink outline-none focus:border-brand"
      >
        <option value="editor">Peut agir</option>
        <option value="viewer">Lecture seule</option>
      </select>

      {confirme ? (
        <div className="flex items-center gap-2">
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await revoquerMembre(m.id); })}
            className="text-[12px] font-semibold text-white bg-neg rounded-full px-3.5 py-2 disabled:opacity-50"
          >
            {pending ? "…" : "Confirmer"}
          </button>
          <button
            onClick={() => setConfirme(false)}
            className="text-[12px] text-faint hover:text-muted px-2 py-2"
          >
            annuler
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirme(true)}
          className="text-[12px] font-semibold text-faint hover:text-neg px-3 py-2"
        >
          Retirer l&apos;accès
        </button>
      )}
    </div>
  );
}
