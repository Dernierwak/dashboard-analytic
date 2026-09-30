"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { FeuilleRelevee } from "@/components/illustrations";
import { IconeAttention, IconeFleche } from "@/components/icones";

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
      <main className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex justify-center">
            <Logo />
          </div>
          <div className="bg-white rounded-2xl shadow-levee p-7 mt-8">
            <h1 className="font-serif text-[26px] leading-tight text-ink">Confirme ton email.</h1>
            <p className="text-[14px] text-muted mt-3 leading-relaxed">
              Un lien de confirmation a été envoyé à{" "}
              <strong className="font-semibold text-ink">{pendingEmail}</strong>. Clique dessus,
              puis reviens te connecter ici.
            </p>
            <button
              onClick={() => {
                setPendingEmail(null);
                setMode("login");
              }}
              className="mt-6 w-full rounded-xl bg-brand text-white text-[14.5px] font-semibold py-3 hover:bg-brand/90 transition-colors"
            >
              J&apos;ai confirmé, me connecter
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* LA COLONNE DU FORMULAIRE — posée sur le papier, comme tout le reste. */}
      <section className="flex flex-col px-6 sm:px-10 py-8 min-w-0">
        <Logo anime />

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-[380px]">
            {/* Sur téléphone, l'illustration passe au-dessus, en réduction :
                c'est elle qui dit ce qu'est Pulse avant qu'on ait lu un mot. */}
            <FeuilleRelevee id="fr-mobile" className="lg:hidden w-[240px] mx-auto -mt-4 mb-2" />

            <h1 className="font-serif text-[38px] sm:text-[44px] leading-[1.02] tracking-[-0.025em] text-ink">
              Ta semaine en bref.
            </h1>
            <p className="text-[15px] text-muted mt-3 leading-relaxed">
              {mode === "login"
                ? "Ce qui a bougé sur tes publicités et ton Instagram, relevé chaque semaine."
                : "Crée ton compte : le même email servira pour toute ton équipe."}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-ink mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] text-ink shadow-card outline-none transition-[border-color,box-shadow] focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-[13px] font-medium text-ink mb-1.5">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] text-ink shadow-card outline-none transition-[border-color,box-shadow] focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="flex gap-2 items-start text-[13px] text-neg bg-neg/[0.06] border border-neg/20 rounded-xl px-3.5 py-2.5"
                >
                  <IconeAttention taille={16} className="shrink-0 mt-px" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group w-full flex items-center justify-center gap-2 rounded-xl bg-brand text-white text-[15px] font-semibold py-3 shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_8px_20px_-8px_rgba(47,68,208,0.55)] hover:bg-brand/90 disabled:opacity-60 transition-colors"
              >
                {loading
                  ? "Un instant…"
                  : mode === "login"
                    ? "Se connecter"
                    : "Créer mon compte"}
                {!loading && (
                  <IconeFleche
                    taille={17}
                    className="transition-transform duration-150 group-hover:translate-x-0.5"
                  />
                )}
              </button>
            </form>

            <p className="text-[13.5px] text-muted mt-6">
              {mode === "login" ? (
                <>
                  Pas encore de compte ?{" "}
                  <button
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                    className="font-semibold text-brand hover:underline underline-offset-4"
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
                    className="font-semibold text-brand hover:underline underline-offset-4"
                  >
                    Connecte-toi
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* La seule page publique du produit est celle-ci : c'est donc d'ici
            qu'un reviewer Google ou Meta doit atteindre les documents légaux
            sans compte. Les trois sont exigés par les deux dossiers
            (`saas/web/legal/GOOGLE_VERIFICATION.md`, `META_APP_REVIEW.md`). */}
        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-faint">
          <Link href="/privacy" className="hover:text-ink transition-colors">Confidentialité</Link>
          <Link href="/terms" className="hover:text-ink transition-colors">CGU</Link>
          <Link href="/suppression" className="hover:text-ink transition-colors">Suppression des données</Link>
        </nav>
      </section>

      {/* LA COLONNE DU DESSIN — une feuille relevée et annotée, sur une
          feuille blanche qui déborde du papier. Rien d'autre : pas de liste
          d'arguments, la page sert à se connecter. */}
      <aside className="hidden lg:flex items-center justify-center p-10 min-w-0">
        <div className="relative w-full h-full rounded-[28px] bg-brand/[0.06] border border-brand/10 flex items-center justify-center overflow-hidden">
          <FeuilleRelevee className="w-full max-w-[560px] px-8" />
        </div>
      </aside>
    </main>
  );
}
