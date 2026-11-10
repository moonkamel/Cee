# 0014 — Finitions avant pilote : suivi sans SDK, données personnelles, tests de bout en bout

- **Date** : 10 novembre 2026 (session S19)
- **Statut** : adoptée (plan validé par le porteur du projet)
- **Spécification** : sections 16 et 17.

## Décisions

1. **Suivi en production sans SDK** : événements PostHog (hébergement UE) et erreurs Sentry
   (région UE) envoyés par simple appel HTTP depuis une logique partagée testée
   (`packages/shared/src/telemetry`). Pas de module natif, donc pas de nouveau build EAS ; rien
   ne part sans clé. Les 8 événements de la section 17 plus `perf_metric` ; propriétés filtrées
   (jamais de nom, d'adresse, de téléphone, de texte libre) ; identifiant pseudonyme ; pas de
   profil de personne, pas d'enregistrement de session. Erreurs : gestionnaire global de
   l'appli, `onRequestError` de Next.js et écouteurs du navigateur ; les jetons des liens client
   sont masqués dans les chemins.
2. **Santé** : Edge Function `health` (publique, compteurs seulement) : 503 si la base ne
   répond pas ou si l'analyse IA a plus de 5 minutes de retard. À brancher sur une supervision
   externe (disponibilité 99,5 %).
3. **Performance** : mesures dans l'appli (ouverture à froid jusqu'à la caméra prête, hors
   temps de décision du poseur ; déclenchement jusqu'à la photo enregistrée ; contrôle local),
   envoyées à PostHog et lisibles sur l'écran caché « Mesures » (appui long sur la version).
   Les cibles se vérifient sur le téléphone de référence.
4. **SMS** : plafond quotidien par entreprise (60 par défaut, réglé par Preuvio), compté par
   la base avant chaque envoi (invitations, liens et codes client).
5. **Liens signés de 5 minutes** sur la page client ; vignettes chargées tout de suite.
6. **Données personnelles** : conservation réglable (5 à 30 ans, 10 par défaut) ; effacement
   d'un client à sa demande (sans chantier : tout est effacé ; avec chantier : coordonnées
   effacées, preuve conservée, liens révoqués) ; le journal d'audit reste en ajout seul, avec
   une seule exception contrôlée : le masquage des données effacées.
7. **Pages légales** (mentions, confidentialité, CGU avec accord de sous-traitance, liste des
   sous-traitants) et **modèles** (note aux salariés, mention client) : textes complets avec
   des champs à compléter, à faire relire par un juriste.
8. **Copies client floutées** : le pré-contrôle IA renvoie aussi les zones de visages et de
   plaques d'immatriculation (même appel) ; la page client sert une copie floutée.
9. **Accueil du poseur** : vidéo facultative (adresse configurable), phrase d'explication du
   micro ajoutée (iOS), indication « premier chantier prêt » montrée une fois.
10. **Tests** : parcours web Playwright avec audit axe (WCAG 2.1 AA) sur chaque page, Lighthouse
    en CI (performance et accessibilité ≥ 90, 100 mesurés), parcours Maestro du poseur en ligne
    et en mode avion (à lancer sur téléphone), test mobile des noms et tailles de boutons.
    La connexion par SMS de test est activée en local et en CI (faux identifiants Twilio).

## Reste à faire

- Mesurer les cibles de la section 17 sur le téléphone de référence (écran « Mesures »).
- Compléter les informations légales de l'éditeur ; relecture juridique ; AIPD.
- Brancher une supervision externe sur la fonction `health`.
- Archivage des originaux de plus de 12 mois (reporté : aucune donnée n'a cet âge).
- Nouveau build EAS pour la phrase d'explication du micro (configuration native).
