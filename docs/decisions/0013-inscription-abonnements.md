# 0013 — Inscription et abonnements : la base fait foi, Stripe sans SDK côté serveur

- **Date** : 10 novembre 2026 (session S18)
- **Statut** : adoptée (plan validé par le porteur du projet)
- **Spécification** : section 15 (inscription, essai, offres, facturation, résiliation).

## Décisions

1. **Inscription sur le web** (`/inscription`) : portable ou e-mail, code de confirmation
   (compte Supabase créé à cette étape), puis l'assistant en 5 étapes : SIRET (nom et adresse
   via l'API publique Recherche d'entreprises), qualifications RGE (pré-remplies depuis la liste
   ADEME quand le SIRET y figure ; vérification non bloquante), métiers en tuiles, logo et
   couleur (facultatif), votre nom. Puis invitation des poseurs par SMS (fonction existante).
   L'appli mobile renvoie vers cette page (« Créer mon entreprise ») ; elle reste l'outil des
   poseurs invités.
2. **Création en base** par `create_company` (compte confirmé sans profil, une seule fois) :
   entreprise en essai et profil dirigeant. Les gardes faites pour les utilisateurs sont passées
   en effaçant les identifiants de session le temps des écritures (`app.act_as_server`), puis en
   les rétablissant.
3. **Métiers** : `companies.work_types` ; ils passent en tête des tuiles à la création d'un
   chantier dans l'appli (les modèles restent tous disponibles).
4. **Essai** : 30 jours ou 10 chantiers, sans carte. Ensuite (ou après une résiliation) : lecture
   seule 90 jours, puis accès fermé. Règle écrite deux fois et testée des deux côtés :
   `companyAccess` (packages/shared) et `app.company_access` (SQL), qui fait foi : création de
   chantier et invitation refusées par la base (`P0002`, message lisible), bandeau en haut du
   tableau de bord.
5. **Offres** : Solo 2 utilisateurs, Équipe 10, Entreprise sur devis ; sièges vérifiés par la base
   à l'invitation et à la réactivation. Pages « Lots CEE » et « Marketing » réservées à l'offre
   Équipe (ouvertes pendant l'essai). Le reste est ouvert à toutes les offres pendant le pilote.
6. **Offre, essai et client Stripe** jamais modifiables depuis le navigateur (garde sur
   `companies`) ; `subscriptions` écrite par le webhook seulement.
7. **Stripe sans SDK** : appels REST et vérification de la signature des webhooks (HMAC SHA-256,
   5 minutes de tolérance) en logique partagée testée (`billing/stripe.ts`, copiée pour Deno).
   - Edge Function `billing` (admin, dirigeant) : client Stripe créé une fois, session Checkout
     (prix retrouvé par sa clé `solo_month`, `team_year`…, TVA 20 % par taux de taxe, numéro de
     TVA demandé) ou portail client (factures, moyen de paiement, changement d'offre,
     résiliation en fin de période).
   - Edge Function `stripe-webhook` : abonnement créé, modifié ou résilié → `subscriptions` et
     `companies.plan` ; un ancien abonnement résilié n'écrase pas un nouveau.
   - `scripts/stripe-setup.sh` crée produits, 4 prix (annuel = 10 mois), taux de TVA, portail et
     webhook, et affiche les secrets à enregistrer.
8. **Chantier de démonstration** : le chantier d'exemple (Rezé, PAC et combles), une photo
   d'illustration marquée « Exemple » par preuve, preuves conformes, jamais envoyé au
   pré-contrôle IA. Un seul par entreprise ; hors essai, lots et exports.
9. **Export complet** (avant de partir) : un dossier ZIP par chantier, fabriqué au premier
   téléchargement par l'export de la S14 (photos, pièces, PV, synthèse, CSV, manifeste), sans
   changer le statut des chantiers ; plus la liste des chantiers en CSV.

## Reste à faire

- Facturation électronique obligatoire entre entreprises : calendrier à vérifier pour la taille
  de Preuvio (réception dès septembre 2026, émission des PME prévue à partir de septembre 2027).
- Formats des réponses de l'API Recherche d'entreprises et de la liste RGE de l'ADEME à vérifier
  en ligne (non joignables depuis l'environnement de développement) ; lecture tolérante.
- Code de connexion par e-mail : le modèle d'e-mail Supabase doit contenir `{{ .Token }}`.
- Écran d'accueil du poseur (vidéo, autorisations au moment utile) : S19.
