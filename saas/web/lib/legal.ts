import { readFile } from "node:fs/promises";
import path from "node:path";

// Les documents légaux sont des `.md` dans `legal/`, et ils le restent : c'est
// ce que David édite, ce qu'un avocat relit, et ce que le dossier de
// vérification cite. La page les LIT, elle ne les recopie pas — un document
// juridique tenu en deux exemplaires finit par en avoir deux versions, et c'est
// celle qu'on n'a pas relue qui est publiée.

export type Segment =
  | { t: "texte"; v: string }
  // Gras et italique portent des SEGMENTS, pas du texte : la politique écrit
  // « **no `userId`, no `clientId` …** », et un contenu traité comme du texte
  // brut y afficherait les accents graves.
  | { t: "gras"; contenu: Segment[] }
  | { t: "italique"; contenu: Segment[] }
  | { t: "code"; v: string }
  | { t: "lien"; v: string; href: string };

export type Bloc =
  | { t: "titre"; niveau: 1 | 2 | 3; contenu: Segment[] }
  | { t: "paragraphe"; contenu: Segment[] }
  | { t: "liste"; items: Segment[][] }
  | { t: "tableau"; entetes: Segment[][]; lignes: Segment[][][] }
  | { t: "separateur" };

export type SlugLegal = "privacy" | "terms" | "suppression";

export const DOCUMENTS_LEGAUX: Record<
  SlugLegal,
  { fichier: string; titre: string; description: string }
> = {
  privacy: {
    fichier: "PRIVACY_POLICY.md",
    titre: "Politique de confidentialité",
    description: "Ce que Pulse collecte, pourquoi, et avec qui.",
  },
  terms: {
    fichier: "TERMS_OF_SERVICE.md",
    titre: "Conditions générales d'utilisation",
    description: "Les règles du service.",
  },
  suppression: {
    fichier: "DATA_DELETION.md",
    titre: "Suppression de tes données",
    description: "Comment arrêter la récolte, et comment faire effacer.",
  },
};

export type DocumentLegal =
  | { pret: true; blocs: Bloc[] }
  | { pret: false; bloquants: string[] };

// Deux choses rendent un document INPUBLIABLE, et les deux existent déjà en
// clair dans les `.md` — on ne crée pas une convention de plus :
//
//  - un `<PLACEHOLDER>` restant : publier « operated by <COMPANY_NAME> », c'est
//    publier une politique dont l'exploitant n'est pas nommé ;
//  - un commentaire « À VÉRIFIER AVANT PUBLICATION » : il marque une phrase
//    qu'on ne peut pas encore affirmer — le palier payant de l'API Gemini
//    (ticket 26), les DPA signés. `CLAUDE.md` §7 interdit de l'affirmer quand
//    même, et la consigne de repli du ticket 26 le dit mot pour mot.
//
// La page refuse alors de servir le document plutôt que de servir un texte faux.
const MARQUEUR_A_VERIFIER = "À VÉRIFIER AVANT PUBLICATION";
const COMMENTAIRE = /<!--[\s\S]*?-->/g;
const PLACEHOLDER = /<[A-Z][A-Z0-9_]*[^>\n]*>/g;

export async function chargerDocumentLegal(slug: SlugLegal): Promise<DocumentLegal> {
  const brut = await readFile(
    path.join(process.cwd(), "legal", DOCUMENTS_LEGAUX[slug].fichier),
    "utf8"
  );

  const bloquants: string[] = [];
  for (const commentaire of brut.match(COMMENTAIRE) ?? []) {
    if (commentaire.includes(MARQUEUR_A_VERIFIER)) {
      bloquants.push(`affirmation non vérifiée : ${resume(commentaire)}`);
    }
  }

  const texte = brut.replace(COMMENTAIRE, "");
  const restants = [...new Set(texte.match(PLACEHOLDER) ?? [])];
  if (restants.length > 0) bloquants.push(`placeholders à remplir : ${restants.join(", ")}`);

  if (bloquants.length > 0) return { pret: false, bloquants };
  return { pret: true, blocs: decouper(texte) };
}

function resume(commentaire: string): string {
  const ligne = commentaire
    .replace(/<!--|-->/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)[0];
  return ligne ?? "(sans détail)";
}

function decouper(markdown: string): Bloc[] {
  const lignes = markdown.split("\n");
  const blocs: Bloc[] = [];
  let paragraphe: string[] = [];

  const viderParagraphe = () => {
    if (paragraphe.length === 0) return;
    blocs.push({ t: "paragraphe", contenu: enSegments(paragraphe.join(" ")) });
    paragraphe = [];
  };

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];

    if (ligne.trim() === "") {
      viderParagraphe();
      continue;
    }

    const titre = /^(#{1,3}) +(.*)$/.exec(ligne);
    if (titre) {
      viderParagraphe();
      blocs.push({
        t: "titre",
        niveau: titre[1].length as 1 | 2 | 3,
        contenu: enSegments(titre[2]),
      });
      continue;
    }

    if (/^-{3,}$/.test(ligne.trim())) {
      viderParagraphe();
      blocs.push({ t: "separateur" });
      continue;
    }

    if (ligne.startsWith("|")) {
      viderParagraphe();
      const brutes: string[] = [];
      while (i < lignes.length && lignes[i].startsWith("|")) brutes.push(lignes[i++]);
      i--;
      const cellules = brutes.map(decouperRangee);
      // La deuxième rangée d'un tableau GFM est le trait `|---|` : elle porte
      // l'alignement, jamais du contenu.
      const [entetes, , ...corps] = cellules;
      blocs.push({
        t: "tableau",
        entetes: entetes.map(enSegments),
        lignes: corps.map((r) => r.map(enSegments)),
      });
      continue;
    }

    if (/^[-*] +/.test(ligne)) {
      viderParagraphe();
      const items: Segment[][] = [];
      while (i < lignes.length && /^[-*] +/.test(lignes[i])) {
        items.push(enSegments(lignes[i++].replace(/^[-*] +/, "")));
      }
      i--;
      blocs.push({ t: "liste", items });
      continue;
    }

    paragraphe.push(ligne.trim());
  }

  viderParagraphe();
  return blocs;
}

function decouperRangee(ligne: string): string[] {
  return ligne
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

// Le `_italique_` exige une frontière de mot des deux côtés : sans elle,
// « <PRIVACY_EMAIL> … <COMPANY_ADDRESS> » sur une même ligne se lit comme un
// passage en italique qui commence au milieu d'un placeholder.
const INLINE =
  /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\)|(?<![A-Za-z0-9_])_(.+?)_(?![A-Za-z0-9_])/g;

function enSegments(source: string): Segment[] {
  const segments: Segment[] = [];
  let curseur = 0;

  for (const m of source.matchAll(INLINE)) {
    const debut = m.index ?? 0;
    if (debut > curseur) segments.push({ t: "texte", v: source.slice(curseur, debut) });
    if (m[1] !== undefined) segments.push({ t: "gras", contenu: enSegments(m[1]) });
    else if (m[2] !== undefined) segments.push({ t: "code", v: m[2] });
    else if (m[3] !== undefined) segments.push({ t: "lien", v: m[3], href: m[4] });
    else if (m[5] !== undefined) segments.push({ t: "italique", contenu: enSegments(m[5]) });
    curseur = debut + m[0].length;
  }

  if (curseur < source.length) segments.push({ t: "texte", v: source.slice(curseur) });
  return segments;
}
