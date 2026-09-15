# Les flèches du prototype répondent en production, barre invisible

Type: bug
Status: open
Blocked by:

## Question

**Trouvé par la revue de code lancée sur le ticket 29**, qui portait sur toute
la branche. Ne vient pas de 29 : c'est le travail du prototype des notes posées
sur la courbe (commit `9bfb109`, marqué PROTOTYPE).

### Le fait

`components/prototype-switcher.tsx` promet en tête de fichier : « Invisible en
production (`NODE_ENV`) : un prototype fusionné par accident ne doit jamais
montrer sa barre à un client. »

La garde tient cette promesse pour la **barre** :

```tsx
if (process.env.NODE_ENV === "production") return null;   // l. 47
```

…mais elle est posée **après** le `useEffect` (l. 28-45), et un hook ne se saute
pas. L'écouteur `keydown` sur `window` est donc attaché en production aussi.

Conséquence sur un lien `/meta?variant=A` ouvert en production — le seul cas où
le composant est monté : appuyer sur ← ou → hors d'un champ de saisie
`router.replace` l'URL vers une autre variante. La page change sous les yeux du
client, sans barre visible pour expliquer pourquoi ni pour revenir. C'est la
promesse du fichier prise à l'envers : on a caché l'interrupteur en laissant le
courant.

### Ce qu'il faut faire

Monter la garde **au-dessus** du hook, ou la tester à l'intérieur de
`surTouche`. La première est plus sûre : elle rend impossible qu'un prochain
effet se glisse sous la garde à son tour.

À noter, sans quoi la correction se répétera : ce fichier est **à jeter**. Il
part avec les variantes le jour où l'une d'elles gagne. Le corriger est un
filet, pas un investissement — si la variante est tranchée bientôt, supprimer
le composant règle le sujet mieux que la garde.

### Comment on le verra

Tout de suite, à la lecture — en `NODE_ENV=production` seulement. Après
`npm run build` puis `npm start`, ouvrir `/meta?variant=A` et presser → :
l'URL ne doit pas bouger.

### Le piège de fichiers

`saas/web/components/prototype-switcher.tsx` seulement.
