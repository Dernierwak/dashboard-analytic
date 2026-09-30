# L'identité visuelle de Pulse — « le relevé »

Pulse mesure et ne conseille pas. Son matériau n'est donc pas la plaquette
commerciale mais **le carnet de relevés** : un papier millimétré, une encre
bleue de stylo, le stylo rouge de celui qui relit, et un surligneur pour la
seule chose qu'on doit lire en premier. Tout ce qui suit en découle.

Posée le 2026-09-30 (`.scratch/identite-visuelle/map.md`).

## Les tokens

La source unique est `saas/web/lib/couleurs.ts`, lue par `tailwind.config.ts`
et par les graphiques SVG. **Ne jamais écrire un hex dans un composant** :
importer `COULEURS` ou utiliser la classe Tailwind.

| Rôle | Token Tailwind | Valeur | Emploi |
|---|---|---|---|
| Papier | `canvas` | `#f4f5f1` + quadrillage 24 px | le fond de page, jamais sous un chiffre |
| Feuille | `white` | `#ffffff` | tout ce qui se lit — cartes, tableaux |
| Graphite | `ink` | `#1b1d24` | texte courant |
| Gris | `muted` / `faint` | `#555a66` / `#8a8f9a` | texte secondaire / légendes (faint : jamais un chiffre, 3,2:1) |
| Encre | `brand` | `#2f44d0` | liens, trait des courbes, onglet actif |
| Surligneur | `surligneur`, `.surligne` | `#ffe36e` | UN mot ou chiffre par écran, et la sélection de texte |
| Vert / rouge / ambre | `pos` / `neg` / `warn` | `#177a55` / `#c63b2b` / `#a8650a` | le sens d'un écart ; l'ambre pour une donnée qui manque |
| Fond d'alerte | `alerte` | `#fdf8ef` | le bandeau « ce qu'on n'a pas pu lire » |

Ombres : `shadow-card` (une feuille posée) et `shadow-levee` (une feuille qu'on
tient — modale, formulaire de connexion).

## La typographie

- **Instrument Sans** (`font-sans`) — l'interface. `font-mono` pointe sur la
  même famille en **chiffres tabulaires** : les colonnes s'alignent sans
  police de terminal.
- **Newsreader** (`font-serif`) — les titres de page et la voix écrite du
  rapport. Titre de page : `font-serif text-[36px] sm:text-[42px]
  leading-[1.05] tracking-[-0.02em]`.
- **Caveat** (`font-main`) — l'annotation manuscrite, en marge d'un dessin.
  Jamais un chiffre, jamais un titre.

## Les règles

1. **Pas de capitales espacées.** Une étiquette est en casse de phrase,
   `text-[12px] text-faint font-semibold`. Le script de conversion est dans
   `.scratch/identite-visuelle/issues/02-propager-au-chantier-theme.md`.
2. **Pas de surtitre au-dessus d'un titre de page.** Le titre suffit.
3. **Une icône = `components/icones.tsx`.** Trait 1,6 en `currentColor`, une
   surface à 16 %. Pas de glyphe Unicode (▣ ◆ ◎) dans du neuf, pas de
   bibliothèque d'icônes.
4. **Un dessin = `components/illustrations.tsx`**, et aucun chiffre dedans : un
   nombre sur une feuille qui ressemble à un rapport se lit comme une donnée
   (`CLAUDE.md` §7). Deux dessins sur une page → deux `id` différents.
5. **Un seul mouvement non demandé** : le pouls du logo qui s'écrit sur
   `/login`. Tout le reste ne bouge qu'en réponse à un geste.
6. **Un lien qui mène à une page la nomme comme la navigation la nomme**
   (`/comptes` s'appelle « Connexions »).
