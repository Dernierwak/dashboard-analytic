import type { Config } from "tailwindcss";
import { COULEURS as C } from "./lib/couleurs";

// Les NOMS de tokens (brand, ink, muted, faint, line, canvas…) sont gardés tels
// quels : 700 usages dans le code les portent, et c'est ce qui permet de
// repeindre toute l'application en changeant leur valeur ici. Les valeurs, elles,
// viennent de `lib/couleurs.ts` — voir sa tête de fichier pour le parti pris.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: C.encre,
        ink: C.graphite,
        muted: C.gris,
        faint: C.grisClair,
        line: "rgba(27, 29, 36, 0.09)",
        canvas: C.papier,
        pos: C.pos,
        neg: C.neg,
        warn: C.warn,
        ig: C.instagram,
        surligneur: C.surligneur,
        alerte: C.alerte,
      },
      fontFamily: {
        sans: ["var(--font-instrument)", "system-ui", "sans-serif"],
        // `font-mono` porte les chiffres dans tout le code (91 usages). Il
        // pointait sur DM Mono : des chiffres de terminal, qui faisaient
        // lire un rapport comme une console. Il pointe maintenant sur la même
        // famille que le texte, en chiffres tabulaires (`globals.css`) — les
        // colonnes restent alignées, ce qui était la seule vraie raison du mono.
        mono: ["var(--font-instrument)", "system-ui", "sans-serif"],
        // Les titres et la voix « écrite » du rapport. Georgia était la police
        // système par défaut, pas un choix.
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
        // L'annotation manuscrite — marginale, jamais un chiffre ni un titre.
        main: ["var(--font-caveat)", "cursive"],
      },
      borderRadius: { xl: "12px", "2xl": "16px" },
      boxShadow: {
        // Une feuille posée sur le papier : un filet de contact net, et une
        // ombre portée très large et très pâle — pas le gris uniforme d'un kit.
        card: "0 0 0 1px rgba(27, 29, 36, 0.02), 0 1px 2px rgba(27, 29, 36, 0.04), 0 8px 24px -12px rgba(27, 29, 36, 0.08)",
        levee: "0 0 0 1px rgba(27, 29, 36, 0.03), 0 2px 4px rgba(27, 29, 36, 0.05), 0 16px 40px -16px rgba(27, 29, 36, 0.16)",
      },
    },
  },
  plugins: [],
};
export default config;
