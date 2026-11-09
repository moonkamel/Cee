# 0008 — Rapports PDF : rédaction par l'IA côté serveur, PDF composé par le web, versions conservées

- **Date** : 9 novembre 2026 (session S13)
- **Statut** : adoptée (plan validé par le porteur du projet ; point 1 ajusté pendant la session)
- **Spécification** : section 9, parties « Rapports générés », « Fabrication d'un rapport » et
  « Mise en page du PDF ».

## Décisions

1. **Rédaction dans une Edge Function** (`write-reports`), sur le modèle des notes vocales :
   file pgmq `report_generation`, appel chaque minute par pg_cron. Le plan prévoyait une route
   Next.js, mais l'appli web n'a volontairement aucune clé secrète (décision 0007) : la clé
   Anthropic reste dans les secrets des Edge Functions. Modèle : `claude-sonnet-5-5` (CLAUDE.md).
2. **Ce que reçoit l'IA** : les opérations, puis pour chaque photo l'heure, la phase, la consigne,
   la légende, le verdict du pré-contrôle, ses remarques et les données lues sur les plaques ; les
   notes transcrites. Ni nom, ni adresse, ni téléphone du client. Photos et notes y sont
   numérotées P1, N1… : l'IA ne voit aucun identifiant technique.
3. **Chaque phrase est justifiée** : l'IA renvoie un JSON (résumé, travaux, réserves, points
   d'attention) dont chaque phrase cite ses références. Une phrase sans référence existante est
   écartée et comptée (`dropped`), affiché au bureau. Les faits sûrs (preuves manquantes,
   équipements lus sur les plaques, métadonnées, empreintes) viennent des données, pas de l'IA.
4. **Versions** : `reports.series_id` regroupe les versions d'un même rapport. Le serveur ouvre
   une série (version 1) ; le bureau enregistre la version suivante, jamais une réécriture
   (trigger). Aucune suppression.
5. **PDF composé par le web** (`/rapports/[id]/pdf`, `@react-pdf/renderer`, gabarit fixe,
   police Atkinson intégrée au code), à la première demande, avec la session du bureau. Il est
   rangé dans `documents/<entreprise>/reports/` avec son empreinte SHA-256 et devient définitif
   pour cette version. Photos : vignettes de 400 px (poids et durée de la fonction).
6. **QR code** : il renvoie vers `/verifier/<id>`, page publique qui affiche la référence, la
   version, la date et l'empreinte du PDF d'origine, et compare un fichier en calculant son
   empreinte sur l'appareil (rien n'est envoyé). Le QR ne peut pas contenir l'empreinte du
   document qui le contient, d'où l'identifiant.
7. **Déclencheurs** : fin de chantier quand le statut passe à « terminé par le poseur » ; compte
   rendu du jour à 18 h, heure de Paris (pg_cron à 16 h et 17 h UTC, la fonction ne garde que
   l'heure qui tombe à 18 h à Paris), seulement s'il y a eu des photos ou des notes ce jour-là ;
   dossier de litige et nouvelle fin de chantier à la demande du bureau (`request_report`).
   Notification « rapport prêt » : dirigeant et chef d'équipe pour le compte rendu, bureau pour
   les autres.

## Reste à faire

- Préparation de contrôle (section 9) : avec les lots CEE, S15.
- PV signé dans le rapport de fin de chantier et version simplifiée pour le client : S16.
- Envoi du rapport par e-mail ou SMS : avec la page client, S16.
