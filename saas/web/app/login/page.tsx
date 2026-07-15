"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("Identifiants incorrects.");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    // Inscription : Supabase envoie un email de confirmation.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      setError(error.message.includes("already registered")
        ? "Un compte existe déjà avec cet email — connecte-toi."
        : "Impossible de créer le compte. Vérifie l'email et un mot de passe d'au moins 6 caractères.");
      return;
    }
    if (data.session) {
      // Confirmation email désactivée côté Supabase → connecté direct.
      router.push("/");
      router.refresh();
      return;
    }
    if (data.user && data.user.identities?.length === 0) {
      setError("Un compte existe déjà avec cet email — connecte-toi.");
      setMode("login");
      return;
    }
    setPendingEmail(email);
  }

  if (pendingEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-[15px] font-bold tracking-tight text-ink">Pulse</div>
          <div className="bg-white border border-line rounded-xl shadow-card p-6 mt-6">
            <p className="text-[14px] text-ink font-medium">Confirme ton email</p>
            <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
              Un lien de confirmation a été envoyé à <strong>{pendingEmail}</strong>.
              Clique dessus, puis reviens te connecter ici.
            </p>
            <button
              onClick={() => {
                setPendingEmail(null);
                setMode("login");
              }}
              className="mt-4 text-[12.5px] font-semibold text-brand"
            >
              J&apos;ai confirmé — me connecter
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[15px] font-bold tracking-tight text-ink">Pulse</div>
          <h1 className="font-serif text-[26px] text-ink mt-3 leading-tight">
            Ta semaine en bref.
          </h1>
          <p className="text-[13px] text-muted mt-2">
            {mode === "login"
              ? "Connecte-toi avec ton compte habituel."
              : "Crée ton compte — c'est le même partout."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-line rounded-xl shadow-card p-6 space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-[12px] font-semibold text-ink mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-[12px] font-semibold text-ink mb-1.5">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </div>

          {error && (
            <p className="text-[12.5px] text-neg bg-neg/[0.06] border border-neg/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand text-white text-[14px] font-semibold py-2.5 hover:bg-brand/90 disabled:opacity-60 transition-colors"
          >
            {loading
              ? "Un instant…"
              : mode === "login"
                ? "Se connecter"
                : "Créer mon compte"}
          </button>
        </form>

        <p className="text-center text-[12px] text-muted mt-5">
          {mode === "login" ? (
            <>
              Pas encore de compte ?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="font-semibold text-brand"
              >
                Crée-le ici
              </button>
            </>
          ) : (
            <>
              Déjà un compte ?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="font-semibold text-brand"
              >
                Connecte-toi
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
