import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Le compte SUR LEQUEL on travaille — le sien, ou celui de quelqu'un qui nous
// a invité. Toutes les couches de données passent par ici plutôt que par
// user.id : c'est le seul endroit qui décide « de qui sont ces chiffres ».
//
// La règle d'accès elle-même vit dans Postgres (fonctions a_acces /
// peut_editer). Ce fichier ne fait que choisir le compte actif et exposer le
// rôle pour que l'interface parle juste — jamais pour autoriser quoi que ce
// soit : un « viewer » qui trafique son cookie se fera refuser par la base.

export type Role = "owner" | "editor" | "viewer";

export type Compte = {
  id: string;
  label: string;
  role: Role;
  /**
   * Vrai uniquement pour MON compte, quand je n'ai jamais rien branché : il
   * existe, il est à moi, et il n'a rien à montrer. Le sélecteur le dit avec
   * des mots plutôt que de laisser croire à un dashboard cassé.
   */
  vide?: boolean;
};

export type CompteActif = {
  uid: string; // le compte regardé
  moi: string; // mon propre identifiant
  email: string;
  role: Role;
  peutEditer: boolean;
  comptes: Compte[]; // tous ceux auxquels j'ai accès (le mien en premier)
};

export const COOKIE_COMPTE = "pulse_compte";

// « Est-ce que MON compte a quelque chose à montrer ? »
//
// La question ne se pose que pour quelqu'un qui a reçu une invitation — lui
// seul risque d'ouvrir Pulse sur un dashboard à zéro et de croire que c'est
// cassé. Deux traces valent réponse, on prend la première qui dit oui :
//
//  · une ligne dans connected_accounts — j'ai branché une régie un jour.
//    Cette ligne survit à une déconnexion faite depuis Pulse (les jetons
//    passent à NULL, la ligne reste : app/comptes/actions.ts → deconnecter).
//    Elle dit donc « j'ai été propriétaire », pas « je le suis à l'instant » —
//    et c'est bien ce qu'on veut : un propriétaire entre deux régies doit
//    continuer d'atterrir chez lui.
//  · un weekly_reports à mon nom — un rapport a déjà été produit pour moi.
//    Filet pour les comptes de l'époque Streamlit, où se déconnecter
//    SUPPRIMAIT la ligne connected_accounts (components/account_tab.py) :
//    sans ce second signal, un ancien propriétaire serait renvoyé chez
//    quelqu'un d'autre alors que son historique est intact.
//
// Deux comptages sans corps de réponse (head), lancés ensemble, et seulement
// quand une invitation existe. `cache` les rend uniques par requête :
// getCompteActif est appelée une bonne dizaine de fois par page.
//
// connected_accounts n'est JAMAIS lue ici pour quelqu'un d'autre — uniquement
// pour `moi`, et on ne demande que `id`, jamais un jeton.
const aQuelqueChoseAMoi = cache(async (moi: string): Promise<boolean> => {
  const supabase = createClient();
  try {
    const signaux = await Promise.all([
      supabase
        .from("connected_accounts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", moi),
      supabase
        .from("weekly_reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", moi),
    ]);
    const lisibles = signaux.filter((s) => !s.error);
    // Aucun des deux signaux n'a répondu : on ne déplace personne sur un doute.
    if (lisibles.length === 0) return true;
    return lisibles.some((s) => (s.count ?? 0) > 0);
  } catch {
    return true;
  }
});

export async function getCompteActif(): Promise<CompteActif> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const moi = user!.id;
  const email = user?.email ?? "";

  let membres: { owner_id: string; owner_email: string | null; role: string }[] = [];
  try {
    // Une invitation posée sur mon e-mail avant que je crée mon compte se
    // rattache ici, à ma première visite.
    if (email) {
      await supabase
        .from("dashboard_members")
        .update({ member_id: moi, accepted_at: new Date().toISOString() })
        .is("member_id", null)
        .ilike("member_email", email);
    }
    const r = await supabase
      .from("dashboard_members")
      .select("owner_id, owner_email, role")
      .eq("member_id", moi);
    membres = r.data ?? [];
  } catch {
    membres = []; // table absente → on reste sur son propre compte
  }

  const partages: Compte[] = membres.map((m) => ({
    id: m.owner_id,
    label: m.owner_email || "Compte partagé",
    role: (m.role === "viewer" ? "viewer" : "editor") as Role,
  }));

  // Sans invitation, la question ne se pose pas : mon compte est le seul, plein
  // ou vide. On s'épargne ainsi les deux comptages sur l'immense majorité des
  // visites — celles où personne n'a rien partagé avec moi.
  const vide = partages.length > 0 && !(await aQuelqueChoseAMoi(moi));

  const mien: Compte = { id: moi, label: "Mon compte", role: "owner", vide };
  const comptes: Compte[] = [mien, ...partages];

  // Le compte par défaut n'est plus « le mien quoi qu'il arrive ».
  //
  // Quelqu'un qu'on invite arrive sans cookie. Le tomber sur son propre compte
  // — techniquement le sien, factuellement vide — lui montrait un dashboard à
  // zéro sur toutes les pages, sans rien lui dire de la bascule à faire. Il
  // n'avait aucune raison de deviner que les chiffres étaient à un menu de là.
  //
  // Donc : si mon compte n'a rien et qu'on m'a invité quelque part, la première
  // visite ouvre sur ce à quoi on m'a invité. Le cookie prime toujours dès
  // qu'un choix a été fait — y compris pour revenir sur mon compte vide, par
  // exemple pour y brancher enfin mes propres régies.
  const parDefaut = vide ? partages[0] : mien;

  const choisi = cookies().get(COOKIE_COMPTE)?.value;
  const actif = comptes.find((c) => c.id === choisi) ?? parDefaut;

  return {
    uid: actif.id,
    moi,
    email,
    role: actif.role,
    peutEditer: actif.role !== "viewer",
    comptes,
  };
}

// Variante tolérante pour la mise en page : /login n'a pas de session, et le
// gabarit racine s'applique aussi à elle.
export async function getCompteActifOuNull(): Promise<CompteActif | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getCompteActif();
}

// Ce que la barre latérale affiche en permanence : ce qu'il reste à faire, et
// jusqu'à quand les données sont fraîches.
export async function getInfosNav(uid: string): Promise<{
  aFaire: number;
  fraicheur: string | null;
}> {
  const supabase = createClient();
  const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
  try {
    const [act, meta] = await Promise.all([
      supabase
        .from("suivi_actions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("status", "running"),
      supabase
        .from("meta_ads_insights")
        .select("date_start")
        .eq("user_id", uid)
        .order("date_start", { ascending: false })
        .limit(1),
    ]);
    const d = meta.data?.[0]?.date_start as string | undefined;
    let fraicheur: string | null = null;
    if (d) {
      const dt = new Date(String(d).slice(0, 10) + "T00:00:00");
      if (!isNaN(dt.getTime())) fraicheur = `données au ${dt.getDate()} ${MOIS[dt.getMonth()]}`;
    }
    return { aFaire: act.count ?? 0, fraicheur };
  } catch {
    return { aFaire: 0, fraicheur: null };
  }
}
