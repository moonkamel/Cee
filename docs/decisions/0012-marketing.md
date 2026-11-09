# 0012 — Recyclage marketing : file serveur, floutage par l'IA validé par le dirigeant

- **Date** : 9 novembre 2026 (session S17)
- **Statut** : adoptée (plan validé par le porteur du projet)
- **Spécification** : section 13 (consentement, création automatique, validation, publication V1).

## Décisions

1. **Consentement** : la case du PV reprend mot pour mot la spécification (« J'accepte que les
   photos de mes travaux, sans adresse ni visage, soient utilisées par l'entreprise. ») ; le PDF
   du PV cite la case cochée. Sans elle, la base refuse tout contenu (garde existante).
2. **« Terminé et conforme »** : chantier terminé (posé, vérifié, exporté ou contrôlé), toutes
   les preuves exigées et applicables validées (conforme, validée à la main ou dispensée), PV
   signé avec la case cochée. Règle écrite deux fois, testée des deux côtés :
   `marketingEligible` (packages/shared) et `app.marketing_eligible` (SQL). Vérifiée à chaque
   PV signé, changement d'état du chantier ou de preuve ; le chantier part alors dans la file
   `marketing_generation` (sans doublon), revérifiée au traitement.
3. **Un contenu par chantier** (index unique) : pas de nouvelle proposition après « Ignorer ».
4. **IA (modèle photo, `claude-haiku-5-5`)**, Edge Function `marketing-candidates` :
   - choix de la paire sur les vignettes (4 avant et 4 après au plus) ;
   - sur les deux photos retenues (1 500 px) : rectangles à flouter (visages, plaques,
     numéros de rue) et trois légendes (sobre, chaleureux, technique).
   L'IA ne reçoit que l'entreprise, la ville et l'intitulé des travaux, jamais l'adresse ni le
   client. Une légende qui cite la rue, le numéro, le code postal ou le nom du client est
   remplacée par une phrase neutre (`captionLeaks`). Quota IA de l'entreprise appliqué.
5. **Floutage** : zones élargies de 25 % (mieux vaut trop flouter), pixélisées puis floutées
   sur la photo redressée, avant la mise en page. Garde-fou : le dirigeant voit les visuels
   floutés avant de publier. Aucune photo d'origine n'est modifiée.
6. **Visuels** composés par le web (sharp) à la première ouverture : carré 1 080 × 1 080 (avant à
   gauche, après à droite) et vertical 1 080 × 1 920 (l'un sous l'autre), étiquettes « Avant » et
   « Après », bandeau à la couleur de l'entreprise (couleur de marque si illisible) avec logo,
   nom et ville. Rangés une fois dans `documents/<entreprise>/marketing/`.
7. **Validation** : page web « Marketing », réservée à l'admin et au dirigeant (RLS existante).
   Ton par défaut dans Réglages, changeable et légende modifiable à chaque contenu. « Publier » ou
   « Ignorer » : une seule fois, signée par la base (`reviewed_by`, `reviewed_at`). La
   proposition de l'IA (paire, zones, légendes) ne se modifie pas ; rien ne se supprime.
8. **Publication V1** : partage natif du téléphone (Web Share avec fichiers) depuis le tableau de
   bord web ouvert sur le téléphone, téléchargement des deux formats, copie de la légende.
   Pas dans l'appli du poseur, qui n'a pas ce rôle.
9. **Notification** « Contenu marketing à valider » (push) au dirigeant et aux admins, coupable
   dans les préférences d'alertes.

## Reste à faire

- Publication directe sur la fiche Google et les réseaux sociaux (V2).
- Page publique « Nos réalisations » et rappel d'entretien annuel (pistes V2).
