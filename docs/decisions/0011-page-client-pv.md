# 0011 — Page client et PV : jeton haché vérifié par le serveur, PV composé par le serveur

- **Date** : 9 novembre 2026 (session S16)
- **Statut** : adoptée (plan validé par le porteur du projet)
- **Spécification** : section 12 (page client, signature du PV, sécurité du lien, valeur juridique).

## Décisions

1. **Lien client** : jeton de 32 octets aléatoires (base64url) montré une seule fois au bureau ;
   seule son empreinte SHA-256 est stockée (`share_links.token_hash`). Valable 90 jours,
   prolongeable, révocable. Page `/c/<jeton>` exclue des moteurs (`noindex`, `X-Robots-Tag`) et
   publique (le proxy laisse passer).
2. **Aucun accès direct du navigateur à la base** : la page appelle, depuis le serveur web,
   l'Edge Function `client-portal`, qui vérifie le jeton par des fonctions SQL réservées à la clé
   de service (`client_portal`, `client_code_set`, `client_sign`, `client_store_pv`) et signe
   les liens des photos et documents (1 h).
3. **Photos montrées** : preuves visibles sauf si le bureau les masque (`photos.client_hidden`) ;
   photos « Divers » masquées sauf si le bureau les montre (`client_visible`) ; preuves écartées
   par une réponse jamais montrées.
4. **Signature** : sans ou avec réserves (tapées ou dictées par le clavier), nom prérempli,
   signature au doigt (PNG), case de consentement marketing, code SMS facultatif (choisi par le
   bureau à la création du lien ; 10 minutes, 5 essais au plus, puis lien bloqué). Un seul PV par
   chantier. Sont enregistrés : nom, horodatage, adresse IP, navigateur, contenu du PV figé et son
   empreinte SHA-256.
5. **PDF du PV composé par la fonction serveur** (`pdf-lib`, gabarit fixe) au moment de la
   signature, et non par le web : sans clé, le web ne pourrait pas prouver qu'il en est l'auteur,
   et un détenteur du lien aurait pu déposer un faux PDF. Rangé une fois (`signatures.pdf_path`),
   puis envoyé au client par SMS ou e-mail (Brevo) sous forme de lien vers sa page.
6. **Après un PV sans réserve**, la page propose un avis Google si l'entreprise a renseigné le
   lien de sa fiche (Réglages). Aucune contrepartie.
7. **Mode client dans l'appli** : le poseur affecté obtient du serveur un lien d'un jour
   (`client_mode_link`) et la page client s'ouvre en grand ; réseau requis. Le PV n'est pas
   envoyé automatiquement au client dans ce mode (le lien expire le lendemain) : le bureau lui
   envoie un lien client.
8. **Rapports et exports** : le rapport de fin de chantier mentionne le PV signé (date,
   signataire, réserves) ; l'export joint `pieces/pv_reception.pdf`.

## Reste à faire

- Signature électronique avancée via un prestataire (V2, section 12).
- Notices et guide d'entretien sur la page client (V2).
