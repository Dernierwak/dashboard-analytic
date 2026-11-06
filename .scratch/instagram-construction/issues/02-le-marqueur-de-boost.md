# 02: Le marqueur de boost

**What to build:** à chaque relevé d'un post, Pulse sait s'il a été boosté —
au moins une annonce hors `error` listée par Instagram — et le garde pour
toujours (`booste_vu_le`), sans aucun chiffre payant.

Spec : § La récolte — Ce qui s'ajoute, « Le marqueur de boost » ; vocabulaire
« Boosté » ; § Testing Decisions, seam 1.

**Blocked by:** 01, 04 (mêmes fichiers de récolte que 04 — en série)

**Status:** ready-for-agent

- [ ] `boost_ads_list` lu au même appel que les métriques, aucune relecture
      de plus ; dédoublonné par `ad_id`, statuts en minuscules.
- [ ] Boosté = au moins une annonce hors `error` ; le booléen du moment va
      dans le relevé ; `booste_vu_le` prend la date la première fois et ne se
      vide jamais.
- [ ] Harnais : une annonce `error` seule ne marque pas ; `booste_vu_le`
      jamais vidé par un relevé sans annonce.
