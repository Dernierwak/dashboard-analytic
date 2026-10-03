# 04: Le journal des changements s'élargit

Type: task
Status: ready-for-agent
Blocked by: 03

**What to build:** le journal couvre ce que le client fait vraiment dans Ads
Manager, et chaque changement d'un groupe d'annonces ou d'une annonce sait à
quelle campagne il appartient. Spec : § « Le journal des changements » ; user
stories 25, 27. Décision d'origine : ticket 08 de la carte.

Seam de test : « réponse `/activities` → lignes à écrire ». Le ticket **écrit son
harnais**.

- [ ] La récolte garde aussi les enchères (`update_ad_set_bidding`,
      `update_ad_set_bid_strategy`, `update_ad_bid_info`…), le statut des annonces
      (`update_ad_run_status`) et les créations (`create_campaign_group`,
      `create_ad_set`, `create_ad`). La revue de Meta n'est pas retenue
- [ ] Chaque nouveau type a sa phrase, rédigée à partir d'un `extra_data` **réel** ;
      un type dont on n'a pas vu d'exemple n'a pas de phrase inventée (testé : un
      type connu rend sa phrase, un type inconnu ne rend rien)
- [ ] La campagne parente d'un changement de groupe ou d'annonce se retrouve
      **par l'ID**, grâce à la hiérarchie que la récolte voit dans `/insights` ;
      absente quand l'ID est inconnu (testé)
- [ ] `python3.12 -m py_compile` sur ce qui a été touché
- [ ] **Après un passage du worker** (`weekly-fetch.yml` lancé à la main) : des
      changements de groupe ou d'annonce portent leur campagne en base ; les
      `extra_data` des nouveaux types sont recopiés ici
