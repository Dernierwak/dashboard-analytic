"use client";

import { useState, useTransition } from "react";
import { setThemeEvent } from "@/app/actions";
import type { EvenementsData, ThemeEvenements } from "@/lib/channels";

// CE QUE CHAQUE THÈME COMPTE COMME CONVERSION.
//
// POURQUOI CE MODULE EST SUR /labels ET PAS DANS LE RAPPORT.
// Le rapport hebdomadaire est une LECTURE : on l'ouvre le lundi, on regarde ce
// qui a bougé, on décide. Ceci est un RÉGLAGE : on le pose une fois, on y
// revient quand le site change. Les mélanger a déjà coûté cher dans ce produit
// — c'est exactement ce qui avait fait sortir `theme-focus-card` du rapport.
// Et cette page est déjà l'endroit où un thème se configure : c'est ici qu'on
// le crée, le renomme, le supprime et qu'on lui pose son étoile. L'étoile est
// le précédent exact : un réglage par thème, qui change ce que le rapport
// calcule, et qui vit ici.
//
// LES NEUF RANGS (docs/03-grammaire-des-modules.md) :
//   1 surtitre · 2 la fraîcheur du catalogue, à droite · 3 les thèmes qui ne
//   savent pas ce qu'ils comptent · 4 le verdict · 6 UNE barre, bornes écrites ·
//   7 le détail : un thème, ses événements · 9 le pied : la limite du pont.
// Rang 5 absent : aucun historique de ce réglage n'est archivé, et un delta
// inventé vaut moins que pas de delta.
//
// LE CHIFFRE DE TÊTE NE COMPTE QUE LES THÈMES ATTRIBUABLES.
// Un thème qui ne porte aucune campagne Meta ou Google ne pourra JAMAIS se voir
// rattacher une conversion — voir le pied. L'inclure au dénominateur ferait
// afficher un manque que personne ne peut combler, et enverrait cocher des
// événements qui ne remonteraient rien. Il apparaît quand même dans la liste,
// avec son mot.
export function ThemeEvenementsModule({ d }: { d: EvenementsData }) {
  const attribuables = d.themes.filter((t) => t.attribuable);
  const sansPrincipal = attribuables.filter((t) => t.principaux.length === 0);
  const reglés = attribuables.length - sansPrincipal.length;

  // « Mesurable » veut dire : on a de quoi proposer un choix. Sans propriété
  // GA4, ou avant la première récolte, il n'y a pas de catalogue — le rang 3
  // bascule alors sur ce qu'on sait vraiment (le nombre de thèmes en attente),
  // et le module dit quoi faire. Même arbitrage que `labels-couverture` avec
  // son `mesurable: false` : deux vides, deux mots.
  const mesurable = d.ga4Connecte && d.catalogueMaj !== null && d.catalogue.length > 0;

  const verdict: { texte: string; couleur: string } = !d.ga4Connecte
    ? { texte: "Google Analytics n'est pas connecté", couleur: "#5a5d66" }
    : d.catalogueMaj === null
    ? { texte: "jamais récolté", couleur: "#5a5d66" }
    : d.catalogue.length === 0
    ? { texte: "ta propriété n'émet aucun événement", couleur: "#c0392b" }
    : d.themes.length === 0
    ? { texte: "aucun thème pour l'instant", couleur: "#5a5d66" }
    : attribuables.length === 0
    ? { texte: "aucun thème ne porte de campagne", couleur: "#5a5d66" }
    : sansPrincipal.length === 0
    ? { texte: "tous tes thèmes savent quoi compter", couleur: "#1a7a4a" }
    : { texte: `sur ${attribuables.length} thèmes rattachables`, couleur: "#b86b00" };

  const part = attribuables.length > 0 ? (reglés / attribuables.length) * 100 : 0;

  return (
    <section className="bg-white border border-line rounded-2xl shadow-card px-4 sm:px-5 py-4 mb-5">
      {/* Rang 1 + rang 2 — le surtitre, et à sa droite ce qui sort du module :
          la fraîcheur de la liste, qui dit si ce qu'on voit est à jour. */}
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="text-[10px] uppercase tracking-widest text-faint font-bold">
          Ce que tes thèmes comptent comme conversion
        </div>
        {d.catalogueMaj && (
          <div className="text-[10.5px] text-faint font-mono shrink-0">
            {d.catalogue.length} événement{d.catalogue.length > 1 ? "s" : ""} · vu le{" "}
            {d.catalogueMaj}
          </div>
        )}
      </div>

      {/* Rang 3 — LE chiffre. Aucune forme au-dessus de lui. */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {mesurable ? sansPrincipal.length : d.themes.length}
        </span>
        <span
          className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
          style={{ color: verdict.couleur, background: `${verdict.couleur}14` }}
        >
          {verdict.texte}
        </span>
      </div>

      {/* LA PHRASE SOUS LE CHIFFRE DIT CE QUE LE CHIFFRE COMPTE, et elle doit
          rester vraie dans chacun des cinq états. Écrite en une seule version,
          elle affichait « thèmes portent des campagnes mais aucun événement
          principal » sous un « 0 » dont la pastille disait « tous tes thèmes
          savent quoi compter » — deux affirmations contradictoires à trois
          centimètres l'une de l'autre. */}
      <p className="text-[12px] text-muted mt-2 leading-snug">
        {!mesurable ? (
          <>thèmes en tout, en attente d&apos;une liste d&apos;événements à te proposer.</>
        ) : d.themes.length === 0 ? (
          <>
            thème pour l&apos;instant — crée-en un plus haut, puis reviens lui désigner
            sa conversion.
          </>
        ) : attribuables.length === 0 ? (
          <>
            thème peut recevoir une conversion : aucun n&apos;est porté par une campagne
            Meta ou Google, et c&apos;est le nom de campagne qui fait le lien.
          </>
        ) : sansPrincipal.length > 0 ? (
          <>
            thèmes portent des campagnes mais aucun événement principal — leurs conseils
            se calculent sur la dépense, pas sur ce qu&apos;elle rapporte.
          </>
        ) : (
          <>
            thème rattachable sans conversion désignée : chacun sait sur quoi il doit
            être jugé.
          </>
        )}
      </p>

      {/* LA PHRASE QUI FAIT COMPRENDRE — elle appartient au chiffre, pas au
          pied. Le rang 9 porte la LIMITE du mécanisme ; ceci en explique
          l'enjeu, et ça se lit avant la forme ou ça ne se lit pas. */}
      <p className="text-[12.5px] text-ink mt-2.5 leading-relaxed">
        Google Analytics compte tout ce que ton site déclenche — une vue produit, un
        formulaire, un achat. Pulse ne sait pas lesquels comptent pour toi. En désignant{" "}
        <span className="font-semibold">un événement principal par thème</span>, tu dis
        sur quoi ce thème doit être jugé : ce chiffre-là devient sa courbe et son verdict.
        Les secondaires servent à comprendre, jamais à juger.
      </p>

      {/* L'ÉTAT DE DÉPART, QUAND IL N'Y A RIEN À COCHER. Trois vides
          différents, trois phrases différentes : « pas connecté » n'est pas
          « connecté mais jamais récolté », qui n'est pas « récolté et muet ».
          Les confondre enverrait chercher un problème qu'on n'a pas. */}
      {!mesurable && (
        <p className="text-[12.5px] mt-3 leading-relaxed rounded-xl bg-black/[0.02] px-3 py-3 text-muted">
          {!d.ga4Connecte ? (
            <>
              Aucune propriété Google Analytics n&apos;est choisie sur ce compte. Va dans{" "}
              <span className="font-semibold text-ink">Comptes → Connexions</span> pour en
              choisir une : sans elle, Pulse voit ce que tes campagnes coûtent, jamais ce
              qu&apos;elles rapportent.
            </>
          ) : d.catalogueMaj === null ? (
            <>
              La propriété est choisie, mais aucune récolte n&apos;a encore lu la liste de
              tes événements. Lance{" "}
              <span className="font-semibold text-ink">↻ Rafraîchir maintenant</span> dans
              la barre latérale — la liste apparaîtra ici.
            </>
          ) : (
            <>
              La récolte du {d.catalogueMaj} n&apos;a trouvé aucun événement sur les 90
              derniers jours. Soit le tag Google Analytics ne collecte plus, soit la
              propriété sélectionnée n&apos;est pas celle de ton site. GA4 → Temps réel
              tranche en trente secondes.
            </>
          )}
        </p>
      )}

      {/* Rang 6 — UNE forme, et ses deux bornes écrites. Elle ne s'affiche pas
          sur un dénominateur nul : une barre à 0 % sur zéro thème est du décor. */}
      {mesurable && attribuables.length > 0 && (
        <div className="mt-4">
          <div className="h-2.5 rounded-full bg-black/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${part.toFixed(1)}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between gap-3 mt-1.5">
            <span className="text-[11px] font-semibold text-brand">
              {reglés > 1
                ? `${reglés} thèmes savent ce qu'ils comptent`
                : `${reglés} thème sait ce qu'il compte`}
            </span>
            <span className="text-[11px] text-faint font-mono">
              sur {attribuables.length} rattachable{attribuables.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* CE QUI A DISPARU DU SITE. On ne décoche jamais tout seul un réglage
          qu'on n'a pas posé — on le signale, et David tranche. */}
      {d.disparus.length > 0 && (
        <p className="text-[11.5px] text-warn mt-3 leading-relaxed">
          Coché{d.disparus.length > 1 ? "s" : ""} mais plus émis depuis 90 jours :{" "}
          <span className="font-mono font-semibold">{d.disparus.join(", ")}</span>. Ces
          événements resteront cochés — ils ne remonteront simplement aucun chiffre tant
          que ton site ne les déclenchera pas.
        </p>
      )}

      {/* Rang 7 — le détail : un thème, ses événements. Replié : ce n'est pas
          ce qu'on vient chercher, et quinze thèmes dépliés font un couloir. */}
      {mesurable && d.themes.length > 0 && (
        <div className="mt-4 rounded-xl border border-line divide-y divide-line defile max-h-[60vh] overflow-y-auto">
          {d.themes.map((t) => (
            <LigneTheme key={t.label} t={t} d={d} />
          ))}
        </div>
      )}

      {/* Rang 9 — le pied, un seul, deux lignes : la limite sans laquelle tout
          ce module se lit de travers. */}
      <p className="text-[10.5px] text-faint/90 mt-3 leading-relaxed">
        Un événement se rattache à un thème par le nom de campagne de son lien
        (utm_campaign), et par rien d&apos;autre : il faut donc que ce nom soit celui de
        la campagne dans Meta ou Google Ads. Une publication Instagram organique n&apos;a
        pas de lien tagué —{" "}
        <span className="font-semibold">
          un thème purement organique ne portera jamais de conversion
        </span>
        , quel que soit l&apos;événement coché.
      </p>
    </section>
  );
}

// UNE LIGNE PAR THÈME. Le repli garde le nom et le choix courant visibles :
// c'est ce qu'on vient vérifier, et l'ouvrir quinze fois pour le lire serait
// quinze clics pour une information qui tient sur une ligne.
function LigneTheme({ t, d }: { t: ThemeEvenements; d: EvenementsData }) {
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choisi = (nom: string): "principal" | "secondaire" | null =>
    t.principaux.includes(nom) ? "principal" : t.secondaires.includes(nom) ? "secondaire" : null;

  const poser = (nom: string, rang: "principal" | "secondaire" | null) =>
    startTransition(async () => {
      const r = await setThemeEvent(t.label, nom, rang);
      setMessage(r.ok ? null : r.message ?? null);
    });

  // Un thème purement organique se nomme AVANT qu'on lui propose des cases à
  // cocher — sinon on l'envoie configurer quelque chose qui ne produira rien.
  // Il garde ses cases : il peut recevoir une campagne demain, et un réglage
  // posé d'avance vaut mieux qu'un blocage à expliquer.
  const organique = !t.attribuable && t.posts > 0;

  return (
    <div className="px-3 sm:px-4 py-2.5">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-[11px] text-faint w-3 shrink-0">{ouvert ? "▾" : "▸"}</span>
        <span className="text-[14px] font-semibold text-ink truncate">{t.label}</span>
        <span className="ml-auto text-[11.5px] text-right min-w-0 truncate">
          {t.principaux.length > 0 ? (
            <span className="font-mono text-ink">
              ★ {t.principaux.join(", ")}
              {t.secondaires.length > 0 && (
                <span className="text-faint"> +{t.secondaires.length}</span>
              )}
            </span>
          ) : organique ? (
            <span className="text-faint">organique — aucune conversion possible</span>
          ) : !t.attribuable ? (
            <span className="text-faint">aucune campagne</span>
          ) : (
            <span className="text-warn font-semibold">rien de choisi</span>
          )}
        </span>
      </button>

      {ouvert && (
        <div className="mt-2.5 pl-5">
          {organique && (
            <p className="text-[11.5px] text-muted mb-2.5 leading-relaxed">
              Ce thème ne porte que des publications Instagram ({t.posts}). Une publication
              organique n&apos;a pas de lien tagué : rien ne relie ses visiteurs à ce
              thème dans Google Analytics.{" "}
              <span className="font-semibold text-ink">
                Ce que tu coches ici ne remontera aucun chiffre
              </span>{" "}
              tant qu&apos;aucune campagne Meta ou Google ne porte ce thème — ce
              n&apos;est pas un réglage manquant, c&apos;est une mesure impossible.
            </p>
          )}
          {!t.attribuable && !organique && (
            <p className="text-[11.5px] text-muted mb-2.5 leading-relaxed">
              Aucune campagne Meta ou Google ne porte ce thème pour l&apos;instant. Coche
              ce que tu veux : les chiffres arriveront le jour où une campagne le portera.
            </p>
          )}
          {t.principaux.length === 0 && t.attribuable && (
            <p className="text-[11.5px] text-muted mb-2.5 leading-relaxed">
              Aucun événement principal : les conseils de ce thème se calculent sur sa
              dépense et sa portée, et sa courbe suit la dépense. Aucun verdict de retour
              sur investissement ne sera rendu — Pulse préfère se taire que d&apos;estimer.
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {d.catalogue.map((e) => {
              const etat = choisi(e.nom);
              return (
                <div
                  key={e.nom}
                  className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-1 ${
                    etat === "principal"
                      ? "border-brand bg-brand/[0.06]"
                      : etat === "secondaire"
                      ? "border-line bg-black/[0.03]"
                      : "border-line"
                  }`}
                >
                  <button
                    disabled={pending}
                    title={
                      etat
                        ? "Retirer de ce thème"
                        : "Rattacher à ce thème (secondaire)"
                    }
                    onClick={() => poser(e.nom, etat ? null : "secondaire")}
                    className="text-[11.5px] font-mono text-ink disabled:opacity-40"
                  >
                    {e.nom}
                    <span className="text-faint ml-1">{e.volume.toLocaleString("fr-CH")}</span>
                    {/* La marque de GA4, et seulement quand on a pu la lire :
                        `cle === null` veut dire « on n'a pas posé la question »,
                        ce qui ne se dessine pas comme « non ». */}
                    {e.cle === true && (
                      <span className="text-brand ml-1" title="Événement clé dans GA4">
                        ◆
                      </span>
                    )}
                  </button>
                  {etat !== null && (
                    <button
                      disabled={pending}
                      title={
                        etat === "principal"
                          ? "Repasser en secondaire"
                          : "Faire porter le verdict et la courbe par cet événement"
                      }
                      onClick={() =>
                        poser(e.nom, etat === "principal" ? "secondaire" : "principal")
                      }
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-[13px] leading-none disabled:opacity-40 ${
                        etat === "principal" ? "text-warn" : "text-line hover:text-warn/60"
                      }`}
                    >
                      {etat === "principal" ? "★" : "☆"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {message && <p className="text-[11.5px] text-neg mt-2">{message}</p>}
        </div>
      )}
    </div>
  );
}
