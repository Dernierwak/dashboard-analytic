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

export type Compte = { id: string; label: string; role: Role };

export type CompteActif = {
  uid: string; // le compte regardé
  moi: string; // mon propre identifiant
  email: string;
  role: Role;
  peutEditer: boolean;
  comptes: Compte[]; // tous ceux auxquels j'ai accès (le mien en premier)
};

export const COOKIE_COMPTE = "pulse_compte";

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

  const comptes: Compte[] = [
    { id: moi, label: "Mon compte", role: "owner" },
    ...membres.map((m) => ({
      id: m.owner_id,
      label: m.owner_email || "Compte partagé",
      role: (m.role === "viewer" ? "viewer" : "editor") as Role,
    })),
  ];

  const choisi = cookies().get(COOKIE_COMPTE)?.value;
  const actif = comptes.find((c) => c.id === choisi) ?? comptes[0];

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
