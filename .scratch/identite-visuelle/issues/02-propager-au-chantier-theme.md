# 02 — Propager l'identité aux fichiers du chantier « thème »

Type: task
Status: open
Blocked by: le commit du retrait du thème (checkout principal, 2026-09-30)

## Question

Le socle (01) n'a pas touché les fichiers modifiés par le retrait du thème,
pour ne pas créer de conflit : `app/page.tsx`, `app/{meta,google,instagram,
conversions}/page.tsx`, `channel-dash`, `bandeau-commandes`,
`conversions-catalogue`, `couts-modules`, `frise-semaine`, `setup-wizard`,
`lib/{budgets,channels,commandes,couts,liens}.ts`.

Une fois ce chantier commité et cette branche fusionnée :

1. **Couleurs en dur** — remplacer `#1a56ff`, `#1a7a4a`, `#c0392b`, `#b86b00`,
   `#7b4fff`, `#d8d8de`, `#8b8e98`, `#5a5d66` par `COULEURS.*`
   (`grep -rn '#[0-9a-fA-F]\{6\}' saas/web/app saas/web/components`).
2. **Capitales espacées** — rejouer le script ci-dessous sur ces fichiers.
3. **Glyphes de source** (▣ ◆ ◎ ◇ dans `etat-action.tsx` `SOURCE`) → icônes de
   `components/icones.tsx` à 12 px.
4. **Le rapport** : verdict (le ▼ de 48 px est plus lourd que le chiffre),
   boussole, frise — un passage écran par écran avec `vision-ux`.

Script (depuis `saas/web`, `python3.12 casse.py fichier…`) : il retire
`uppercase` et `tracking-wide*` des `className` qui portent les deux, monte la
taille d'un cran (9,5/10/10,5 → 11/12/12 px, 11 → 12,5 px) et passe `font-bold`
en `font-semibold`.

```python
import re, sys
TAILLE = {"9px": "11px", "9.5px": "11px", "10px": "12px", "10.5px": "12px", "11px": "12.5px"}
def adoucir(cls):
    if "uppercase" not in cls or "tracking-" not in cls:
        return cls
    out = []
    for m in cls.split(" "):
        if m == "uppercase" or re.fullmatch(r"tracking-(wide|wider|widest)", m):
            continue
        t = re.fullmatch(r"text-\[(\d+(?:\.\d+)?px)\]", m)
        if t and t.group(1) in TAILLE:
            m = f"text-[{TAILLE[t.group(1)]}]"
        out.append("font-semibold" if m == "font-bold" else m)
    return " ".join(out)
for p in sys.argv[1:]:
    s = open(p).read()
    s = re.sub(r'(className=\{?[`"])([^`"]*)([`"])', lambda mo: mo.group(1) + adoucir(mo.group(2)) + mo.group(3), s)
    open(p, "w").write(s)
```
