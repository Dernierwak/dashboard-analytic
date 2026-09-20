// Un faux Supabase, juste assez pour `fetchCanauxMuets` — ni base, ni secret,
// ni réseau (`CLAUDE.md` §9). Il rejoue la seule forme de requête que le module
// écrit : `.from(table).select(cols).eq(col, val)[.order(...)][.limit(n)]`,
// attendue comme une promesse.
//
// IL N'IMITE PAS POSTGREST, il imite ce qu'on lui demande. Un faux qui en fait
// plus se met à valider des requêtes que le vrai refuserait.

export type LigneProgress = {
  canal: string;
  run_id: string;
  etat: string;
  mot_de_fin: string | null;
};

export type Base = {
  /** `null` = la table ne répond pas (migration pas jouée, RLS, réseau). */
  fetch_progress: LigneProgress[] | null;
  meta_ads_insights: { date_start: string }[];
  google_ads_insights: { date_start: string }[];
};

type Ligne = Record<string, unknown>;

class Requete implements PromiseLike<{ data: Ligne[] | null; error: unknown }> {
  lignes: Ligne[] | null;
  erreur: unknown;

  constructor(lignes: Ligne[] | null, erreur: unknown = null) {
    this.lignes = lignes;
    this.erreur = erreur;
  }

  eq(): this {
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    if (this.lignes) {
      const sens = opts?.ascending === false ? -1 : 1;
      this.lignes = [...this.lignes].sort((a, b) =>
        String(a[col]) < String(b[col]) ? -sens : String(a[col]) > String(b[col]) ? sens : 0
      );
    }
    return this;
  }

  limit(n: number): this {
    if (this.lignes) this.lignes = this.lignes.slice(0, n);
    return this;
  }

  then<R1, R2 = never>(
    ok?: ((v: { data: Ligne[] | null; error: unknown }) => R1 | PromiseLike<R1>) | null,
    ko?: ((r: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve({ data: this.lignes, error: this.erreur }).then(ok, ko);
  }
}

export function fauxSupabase(base: Base) {
  return {
    from(table: string) {
      return {
        select() {
          if (table === "fetch_progress" && base.fetch_progress === null) {
            return new Requete(null, { message: "relation inexistante" });
          }
          const lignes = (base as unknown as Record<string, Ligne[] | null>)[table] ?? [];
          return new Requete([...(lignes as Ligne[])]);
        },
      };
    },
  };
}
