# 0010 — Lots CEE et alertes : niveau du lot en base, reprise par nouvelles preuves, e-mail facultatif

- **Date** : 9 novembre 2026 (session S15)
- **Statut** : adoptée (plan et trois propositions validés par le porteur du projet)
- **Spécification** : section 10 (score, lots, alertes) et section 14 (notifications, heures calmes).

## Décisions

1. **Niveau d'alerte du lot calculé en base** (`app.refresh_batch_level`) à chaque contrôle
   enregistré : au-dessus du seuil, à moins de 2 points, ou normal. Le seuil vient de
   `cee_thresholds` (année en cours, sinon la dernière connue). Le dirigeant n'est prévenu que si
   le niveau s'aggrave ; une amélioration ne renvoie rien.
2. **Alertes du tableau de la section 10**, toutes créées par la base (`app.notify`) :
   chantier terminé incomplet (chef et dirigeant, push), contrôle non satisfaisant (dirigeant et
   chef, push, critique), lot proche ou au-dessus du seuil (dirigeant, push et e-mail, critique),
   photos orange depuis 48 h (bureau, récapitulatif à 8 h), RGE expirant sous 60 jours
   (dirigeant, e-mail, une fois par qualification).
3. **Préférences** : chacun coupe les alertes qu'il veut, sauf le dirigeant pour les alertes
   critiques (seuil, contrôle). Les heures calmes (20 h – 7 h) existaient déjà dans `send-push`.
4. **E-mail facultatif** sur le profil (« aucune adresse exigée ») : sans adresse, une alerte
   prévue par e-mail part en notification. Envoi par `send-emails` (Brevo, toutes les 5 min).
5. **« Planifier la reprise »** (`plan_correction`) : le bureau coche les preuves concernées ; chacune
   devient une nouvelle preuve « (après correction) » (`item_key` suffixé `~reprise-N`). Les
   anciennes preuves et leurs photos restent. Le chantier repasse « en cours », le poseur est
   prévenu. Le moteur de checklists ignore ces preuves quand les réponses changent.
6. **Import d'un lot** : CSV du délégataire ; la colonne des références (chantier ou devis) est
   reconnue d'elle-même ; les références introuvables sont listées.

## Hors périmètre

- Récapitulatif du dirigeant à 18 h 30 (section 14) : recoupe le compte rendu du jour (S13).
- Taux de preuves complètes du premier coup par poseur (section 14).
