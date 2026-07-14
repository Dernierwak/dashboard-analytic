"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Identifiants incorrects.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
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
            Connecte-toi avec ton compte habituel — même login que le dashboard.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
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
              autoComplete="current-password"
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
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-[11.5px] text-faint mt-5">
          Pas encore de compte ? Crée-le dans le dashboard actuel — il marche ici aussi.
        </p>
      </div>
    </main>
  );
}
