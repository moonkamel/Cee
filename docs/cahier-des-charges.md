# Cahier des charges — Preuvio, l'appli de preuve de pose pour entreprises RGE

2026-11-08 · Tarik

## 1. Vision et principes produit

Preuvio permet à un poseur RGE de documenter un chantier conforme en moins de 2 minutes de manipulation, sans taper un seul mot. Le dirigeant récupère un dossier complet, prêt pour le délégataire CEE ou un contrôle COFRAC.

**Le problème.** Les contrôles CEE se durcissent : le taux de malfaçons toléré par lot passe à 14 % en 2026, 12 % en 2027 et 10 % en 2028, et les PAC air/eau seront contrôlées à 100 % sur site au 1er janvier 2028 ([source](https://selectra.info/energie/actualites/renovation-energetique/controles-cee-non-conformite-fraude-arrete-juillet-2026)). Un seul chantier mal documenté peut bloquer les primes d'un lot entier. Aujourd'hui, les photos dorment dans les téléphones des poseurs, mal cadrées, sans contexte, et les dossiers partent incomplets.

**La cible.** Entreprises RGE de 1 à 20 salariés : chauffagistes et installateurs PAC, isolation, menuiserie, ventilation, photovoltaïque. Le payeur est le dirigeant ; l'utilisateur quotidien est le poseur sur le chantier.

**Les trois promesses.**

- Zéro photo manquante : l'appli guide le poseur photo par photo et vérifie chaque cliché avant qu'il quitte le chantier.
- Dossier prêt en un clic : l'export délégataire est généré, nommé et ordonné automatiquement.
- Preuve en cas de litige ou de contrôle : historique horodaté, géolocalisé et infalsifiable de chaque intervention.

**Principes non négociables (UX terrain).** Chaque écran doit passer ces huit règles avant d'être considéré comme terminé.

1. Une main, des gants, plein soleil : cibles tactiles de 56 px minimum, contraste renforcé sur toutes les actions.
2. Zéro clavier sur le chantier : tout passe par une photo, la voix ou un tap.
3. Ouvrir l'appli, c'est être prêt à photographier : le chantier du jour est deviné par GPS et par le planning.
4. L'appli dit toujours quoi faire ensuite : « Prochaine photo : plaque signalétique de l'unité extérieure ».
5. Hors ligne par défaut : aucun écran de chargement bloquant, aucune photo perdue.
6. La réglementation reste invisible : les fiches CEE sont traduites en consignes simples, dans le vocabulaire du métier.
7. Trois taps maximum entre l'ouverture de l'appli et la première photo.
8. L'IA conseille, l'humain décide : l'IA ne bloque jamais une action, elle signale.

**Test de référence.** Un poseur de 55 ans, peu à l'aise avec le numérique, doit documenter son premier chantier sans formation ni aide.

**Hors périmètre V1.** Devis, facturation, planning détaillé et comptabilité : ils viendront par intégration avec les logiciels existants (section 11).

## 2. Utilisateurs et parcours clés

Cinq profils utilisent Preuvio, mais l'appli mobile est conçue d'abord pour le poseur : s'il ne l'adopte pas, aucune autre fonction ne sert.

| Profil | Où et quand | Ce qu'il veut | Surface |
|---|---|---|---|
| Poseur / technicien | Sur chantier, gants, réseau faible, téléphone perso ou pro | Finir vite, ne rien oublier, ne pas être dérangé | Appli mobile, mode Poseur |
| Chef d'équipe | Sur chantier et dans le véhicule | Voir ce qui manque sur ses chantiers, valider avant de partir | Appli mobile, mode Chef |
| Dirigeant | Véhicule, bureau, le soir | Ne plus perdre de primes, repérer les chantiers à risque | Appli mobile et web |
| Assistante administrative | Bureau, ordinateur | Monter les dossiers sans relancer les poseurs | Web |
| Client particulier | Chez lui, via un lien SMS | Voir ses travaux, signer le PV de réception | Page web, sans compte |

**Parcours 1 — Le poseur documente un chantier PAC de A à Z.**

1. Il ouvre l'appli : le chantier du jour s'affiche en plein écran avec un bouton géant « Commencer ».
2. L'écran caméra affiche la consigne de la photo attendue, avec un pictogramme d'exemple : « Photo 1 sur 9 : chaudière existante avant dépose ».
3. Il déclenche : l'IA vérifie la photo en quelques secondes et affiche une pastille verte, ou orange avec une consigne courte (« Plaque illisible, rapproche-toi »).
4. À tout moment, il peut prendre une photo libre : elle est classée automatiquement dans le chantier.
5. Pour ajouter un commentaire, il garde le doigt sur le micro, parle, puis relâche : la note est transcrite et rattachée.
6. En fin de chantier, l'écran récapitulatif affiche « 9 preuves sur 9 » ou la liste des manques, chacun avec un bouton qui ouvre directement la caméra.
7. Le client signe le PV de réception sur l'écran du téléphone, ou reçoit un lien par SMS.
8. Tout se synchronise seul dès que le réseau revient.

**Parcours 2 — Le dirigeant fait le point le soir.**

1. Il reçoit une notification de récapitulatif quotidien : « 6 chantiers terminés, 1 à risque ».
2. Il ouvre la liste des chantiers à risque, triée par gravité.
3. Sur un chantier, il voit la preuve manquante et appuie sur « Demander au poseur ».
4. Le poseur reçoit une notification qui ouvre directement la caméra sur la bonne consigne.

**Parcours 3 — L'assistante prépare les dossiers.**

1. Sur le web, elle filtre les chantiers « Prêts à exporter » par délégataire CEE.
2. Elle sélectionne plusieurs chantiers et lance l'export groupé.
3. Elle télécharge un ZIP par chantier (PDF de synthèse et photos nommées), puis marque les dossiers comme envoyés.

**Parcours 4 — Le client final.**

1. Il reçoit un SMS au nom de l'entreprise avec un lien vers ses travaux.
2. Il consulte la galerie avant/après et le résumé de l'intervention.
3. Il signe le PV de réception, puis se voit proposer de laisser un avis Google.

## 3. Design system et règles d'interface

L'interface est conçue pour être lue en plein soleil et utilisée avec des gants : peu d'éléments par écran, très gros, très contrastés. Le ton visuel est celui d'un artisan sérieux et rassurant, pas d'une startup.

**Couleurs.** Tous les écrans utilisent ces jetons, jamais de couleur codée en dur. Chaque statut combine toujours une icône, un mot et une couleur, pour rester lisible par les daltoniens.

| Jeton | Usage | Mode clair | Mode sombre | Contraste maximal |
|---|---|---|---|---|
| `action` | Bouton principal, déclencheur photo | #9A3412 (orange brûlé) | #FB923C | #FDBA74 |
| `on-action` | Texte et icônes posés sur `action` | #FFFFFF | #0B1220 | #000000 |
| `brand` | En-têtes, liens, éléments de marque | #1F3A5F (bleu ardoise) | #93C5FD | #BFDBFE |
| `ok` | Preuve validée, chantier conforme | #15803D | #4ADE80 | #86EFAC |
| `warn` | Preuve à reprendre, chantier à risque | #A16207 | #FACC15 | #FDE047 |
| `ko` | Preuve manquante, erreur | #B91C1C | #F87171 | #FCA5A5 |
| `bg` | Fond d'écran | #F8FAFC | #0B1220 | #000000 |
| `surface` | Cartes, feuilles | #FFFFFF | #111A2E | #121212 |
| `border` | Bordures, séparateurs | #CBD5E1 | #334155 | #FFFFFF |
| `text` | Texte principal | #0F172A | #F1F5F9 | #FFFFFF |
| `text-muted` | Texte secondaire | #475569 | #94A3B8 | #E5E5E5 |

**Contrastes vérifiés.** L'orange d'origine #EA580C n'offrait que 3,56:1 avec un texte blanc ; #9A3412 atteint 7,31:1. Un test automatique contrôle chaque paire texte/fond dans les trois modes : 7:1 pour les actions et le texte principal, 4,5:1 minimum pour les statuts (7:1 en contraste maximal).

**Typographie.** Atkinson Hyperlegible, conçue pour la lisibilité, avec Inter en secours. Corps 18, boutons 20 en semi-gras, titres 24 et 32. Aucun texte sous 16. Les tailles suivent le réglage d'accessibilité du téléphone.

**Composants de base** (à construire en premier, dans une bibliothèque partagée) :

- `BigButton` : 64 px de haut, pleine largeur, un seul par écran en couleur `action`.
- `ShutterButton` : déclencheur photo de 88 px, retour haptique fort.
- `ProofCard` : vignette de la photo, consigne, statut (validée, à reprendre, manquante).
- `StatusPill` : icône + mot + couleur, jamais la couleur seule.
- `ChecklistRow` : une preuve attendue, son pictogramme, son état, un tap pour photographier.
- `VoiceButton` : appui long pour enregistrer, vibration au début et à la fin, onde sonore visible.
- `ProgressRing` : « 7 sur 9 preuves », visible en permanence pendant le mode guidé.
- `Toast` : message non bloquant en bas d'écran, avec bouton « Annuler » pendant 5 secondes.
- `EmptyState` : illustration simple et une seule action proposée.

**Règles d'interaction.**

- Navigation en trois onglets maximum en mode Poseur : Aujourd'hui, Chantiers, Moi. Le bouton caméra reste accessible partout.
- Aucun geste caché : chaque balayage a un bouton équivalent.
- Annuler plutôt que confirmer : pas de boîte « Êtes-vous sûr ? », un bouton « Annuler » pendant 5 secondes.
- Retour haptique à chaque photo prise, chaque preuve validée et chaque erreur.
- Vocabulaire du métier, phrases de 8 mots maximum dans les consignes, vouvoiement par défaut.
- Mode « contraste maximal » activable en un tap depuis l'écran caméra, pour le plein soleil.
- Interface traduisible dès le départ (fichiers de traduction), consignes doublées de pictogrammes. Langues supplémentaires envisagées en V2 : portugais, roumain, turc.

**Accessibilité.** WCAG 2.2 niveau AA au minimum, contraste de 7:1 sur les actions principales, compatibilité avec les lecteurs d'écran du téléphone.

**Web.** L'interface bureau (dirigeant, assistante) reprend les mêmes jetons avec une densité plus forte : tableaux, filtres, actions groupées.

## 4. Architecture technique et stack

L'appli mobile fonctionne entièrement hors ligne et se synchronise dès que le réseau revient ; le serveur Supabase stocke, vérifie par IA et assemble les dossiers. Aucune clé d'API n'est jamais embarquée dans l'appli mobile : tout appel externe passe par une fonction serveur.

*[Schéma : architecture · 3 surfaces, 1 backend, 5 services externes]*

Le poseur ne dépend jamais du réseau ; l'IA, les PDF et les SMS tournent côté serveur, en tâche de fond.

| Couche | Choix | Pourquoi |
|---|---|---|
| Appli mobile | Expo (React Native), TypeScript, Expo Router, react-native-vision-camera | Une seule base de code iOS et Android, caméra rapide |
| Données hors ligne | SQLite local + PowerSync, synchronisé avec Postgres | Synchro bidirectionnelle hors ligne sans la coder soi-même |
| Envoi des photos | File locale + envoi reprenable (protocole TUS) vers Supabase Storage | Aucune photo perdue en cas de coupure |
| Backend | Supabase : Postgres, Auth, Storage, Edge Functions, RLS, région UE | Tout-en-un, peu coûteux au démarrage, données en Europe |
| Traitements de fond | File de tâches Postgres (pgmq) + Edge Functions | IA, PDF et notifications sans bloquer l'appli |
| IA vision et texte | API Claude : Haiku pour chaque photo, Sonnet pour les rapports, derrière une couche d'abstraction | Rapide et économique par photo, fournisseur interchangeable |
| Transcription vocale | API de transcription (Whisper ou équivalent hébergé en UE) | Notes vocales en français de chantier |
| Web | Next.js (App Router), Tailwind, shadcn/ui, hébergé sur Vercel | Tableau de bord, exports, page client |
| PDF | @react-pdf/renderer dans une fonction serveur Node | Rapports et dossiers au format fixe |
| SMS et e-mails | Brevo | Prestataire français, SMS et e-mails transactionnels |
| Paiement | Stripe Billing | Abonnements, essai gratuit, factures |
| Adresses | API Adresse (Base Adresse Nationale) | Gratuite, géocodage des chantiers |
| Suivi | Sentry (erreurs), PostHog hébergé en UE (usage) | Voir où les poseurs bloquent |

**Organisation du code.** Un monorepo pnpm + Turborepo, pour que Claude Code voie tout le projet d'un coup :

```
preuvio/
  apps/mobile          # appli Expo
  apps/web             # Next.js : tableau de bord, exports, page client
  packages/ui-tokens   # couleurs, typographie, espacements partagés
  packages/shared      # types, schémas zod, logique métier pure et testée
  packages/templates   # modèles de checklists en JSON versionné
  supabase/migrations  # schéma SQL et politiques RLS
  supabase/functions   # analyse IA, PDF, notifications, webhooks Stripe
```

**Règles techniques.**

- Toute la logique métier (calcul de conformité, nommage des fichiers, règles des checklists) vit dans `packages/shared`, sans dépendance à l'interface, et elle est testée.
- Chaque table porte un `company_id` et une politique RLS : une entreprise ne voit jamais les données d'une autre.
- Plan B si PowerSync ne convient pas : expo-sqlite et une file de modifications maison (pattern « outbox »).

## 5. Modèle de données

Le modèle tourne autour du chantier : chaque chantier porte une ou plusieurs opérations (une fiche CEE ou un geste), chaque opération génère des emplacements de preuve, et chaque photo vient remplir un emplacement. Toutes les tables portent un `company_id` protégé par RLS.

| Table | Rôle | Champs clés |
|---|---|---|
| `companies` | L'entreprise cliente | nom, SIRET, qualifications RGE (organisme, numéro, domaines, date de fin), logo, couleurs, offre, fin d'essai |
| `profiles` | Utilisateurs | lien Auth, rôle (`owner`, `admin`, `office`, `lead`, `installer`), nom, téléphone, langue |
| `clients` | Particuliers ou bailleurs | nom, téléphone, e-mail, adresse BAN, coordonnées GPS, consentement marketing |
| `jobsites` | Chantiers | client, adresse, GPS, rayon de géorepérage (m), dates prévues, statut, poseurs affectés, délégataire, référence du devis |
| `jobsite_operations` | Opérations d'un chantier | code (ex. BAR-TH-171), modèle utilisé et sa version, libellé métier |
| `checklist_templates` | Modèles de checklists | code, métier, version, titre, éléments (JSON), dates de validité, entreprise propriétaire ou modèle global |
| `proof_slots` | Emplacements de preuve attendus | opération, clé de l'élément, consigne, phase (avant, pendant, après), obligatoire, nombre minimal de photos, statut, motif de dispense |
| `photos` | Chaque photo | chantier, emplacement, auteur, heure appareil et heure serveur, GPS et précision, cap, empreinte SHA-256, chemins original et vignette, EXIF, statut d'envoi, statut et résultat IA, légende, annotations, visible client |
| `voice_notes` | Notes vocales | chantier, photo liée, auteur, fichier audio, durée, transcription, statut |
| `photo_requests` | Demandes de reprise | chantier, emplacement, demandeur, destinataire, message, statut |
| `reports` | Rapports générés | chantier, type (journalier, fin de chantier, dossier), PDF, version, contenu structuré |
| `signatures` | PV de réception signés | signataire, date, image de signature, empreinte du document, réserves, jeton d'horodatage |
| `delegataires` | Délégataires CEE | nom, règles de nommage des fichiers, pièces exigées |
| `cee_batches` | Lots déclarés | délégataire, code d'opération, période, chantiers inclus, statut |
| `inspections` | Contrôles subis | chantier, type (sur site, par contact), organisme, date, résultat (satisfaisant, non satisfaisant, non vérifiable), constats, date de correction |
| `exports` | Exports de dossiers | chantiers, délégataire, fichier ZIP, auteur, statut, date d'envoi |
| `share_links` | Liens client | chantier, jeton (stocké haché), expiration, périmètre |
| `marketing_assets` | Contenus marketing | photo avant, photo après, texte généré, statut de validation |
| `subscriptions` | Abonnement | identifiants Stripe, offre, nombre de poseurs, statut |
| `notifications` | Notifications | destinataire, type, contenu, lu le |
| `audit_log` | Journal d'audit | auteur, action, objet, date, différence avant/après |

**Statuts.**

- Chantier : planifié → en cours → terminé par le poseur → vérifié par le bureau → exporté → contrôlé (satisfaisant, non satisfaisant, corrigé).
- Emplacement de preuve : manquant → capturé → en analyse → conforme ou à reprendre → validé manuellement ou dispensé (motif obligatoire).

**Règles d'intégrité.**

- Une photo n'est jamais modifiée ni écrasée : une annotation crée un calque séparé, une suppression est logique et tracée dans le journal d'audit.
- Un chantier garde la version du modèle de checklist utilisée à sa création, même si le modèle évolue ensuite.
- L'empreinte SHA-256 est calculée sur le téléphone au moment de la prise de vue, puis vérifiée par le serveur à la réception.

## 6. Module 1 — Chantiers et fil photo

C'est le cœur de l'appli : un tap ouvre la caméra sur le bon chantier, et chaque photo est horodatée, géolocalisée, scellée par empreinte et mise en file d'envoi en moins d'une seconde.

**Écran « Aujourd'hui ».**

- Affiche les chantiers du jour issus du planning, le plus proche (GPS) en tête.
- Chaque carte montre l'adresse, le client, l'opération, la progression (« 4 preuves sur 9 ») et un bouton « Commencer ».
- Si le téléphone est dans le rayon d'un chantier, celui-ci s'ouvre directement en grand.
- Sans chantier prévu : un bouton « Nouveau chantier ».

**Création rapide d'un chantier sur le terrain (3 étapes, sans clavier).**

1. Adresse : la position actuelle est proposée, convertie en adresse via l'API Adresse ; sinon recherche par dictée.
2. Type de travaux : grosses tuiles avec pictogrammes (PAC air/eau, isolation des combles, isolation des murs, VMC, chaudière biomasse, menuiseries, photovoltaïque…). Plusieurs choix possibles.
3. Client : nom et téléphone dictés, ou choisis dans les contacts du téléphone.

Au bureau, le web permet aussi la saisie classique et l'import d'un fichier CSV de chantiers.

**Caméra.**

- Ouverture en moins d'une seconde, déclencheur de 88 px, flash automatique, zoom par pincement et boutons ×1 et ×2.
- En mode guidé, un bandeau en haut affiche la consigne et une vignette d'exemple, agrandie au tap.
- Prises en rafale sans quitter la caméra : la dernière vignette s'affiche en bas à gauche avec sa pastille IA.
- Pas d'écran de validation après chaque photo : on enchaîne.
- Une photo libre est rangée automatiquement : l'IA propose l'emplacement correspondant, sinon elle va dans « Divers ».
- Vidéo courte (30 secondes maximum) prévue en V2.

**Métadonnées et valeur de preuve.**

- Capturées à chaque photo : heure de l'appareil, GPS et précision, cap de la boussole, modèle du téléphone, version de l'appli, auteur, empreinte SHA-256. L'heure serveur est ajoutée à la réception.
- Un écart de plus de 10 minutes entre l'heure de l'appareil et l'heure serveur est signalé.
- Une photo prise hors du rayon du chantier reçoit un badge « hors chantier », sans blocage.
- Les emplacements de preuve n'acceptent que des photos prises dans l'appli. Une image importée depuis la galerie est marquée « importée » et ne compte pas comme preuve.
- Le filigrane (date, heure, adresse, entreprise) est appliqué sur les copies d'export, jamais sur l'original.

**Hors ligne et envoi.**

- Enregistrement local immédiat, puis création d'une vignette de 400 px ; l'original est conservé jusqu'à 4 000 px de côté.
- File d'envoi reprenable : une photo n'est effacée du téléphone qu'après accusé de réception du serveur et vérification de l'empreinte.
- Indicateur discret en haut d'écran : nuage et nombre de photos en attente. Option « envoyer uniquement en Wi-Fi ».
- Sous 15 % de batterie, l'envoi se met en pause, sauf si le téléphone est en charge.

**Fil du chantier.**

- Chronologie des photos par jour et par phase (avant, pendant, après), filtrable par poseur.
- Annotations sur un calque séparé : flèche, cercle, texte dicté.
- Plein écran avec zoom, comparaison avant/après côte à côte, photo de couverture du chantier.

**Fil de l'entreprise** (chef d'équipe et dirigeant) : toutes les photos du jour, toutes équipes confondues, et la carte des chantiers en cours.

## 7. Module 2 — Checklists de preuves

Les checklists traduisent chaque fiche CEE et chaque geste en une suite de photos simples à prendre. Elles sont décrites en JSON versionné et mises à jour à distance, sans nouvelle version de l'appli.

**Origine du contenu.** Les modèles s'appuient sur les fiches d'autocontrôle et de réception publiées gratuitement par le programme PROFEEL ([Check'Réno, AQC, FFB, CAPEB](https://www.ffbatiment.fr/actualites-batiment/actualite/check-reno-appli-gratuite-autocontrole-et-reception-travaux)), sur les référentiels de contrôle CEE et sur les textes des fiches d'opérations standardisées. Chaque modèle doit être relu par un professionnel du métier avant publication : Preuvio n'invente aucune exigence réglementaire.

**Fonctionnement.**

- À la création d'une opération, le moteur génère les emplacements de preuve à partir du modèle et de sa version.
- Ordre conseillé (avant, pendant, après), mais le poseur peut remplir les emplacements dans n'importe quel ordre.
- Questions rapides en gros boutons pour adapter la liste : « Ancienne chaudière déposée ? Oui / Non », « Nombre d'unités intérieures : − 2 + ».
- Un emplacement impossible à remplir peut être marqué « Impossible », avec un motif choisi dans une liste et une note vocale. Le bureau le voit immédiatement.
- L'IA peut extraire des données des photos (marque, modèle, numéro de série sur une plaque) pour pré-remplir le dossier.
- Un chantier conserve la version du modèle utilisée à sa création.

**Modèles globaux et personnalisés.** Preuvio maintient les modèles globaux. Chaque entreprise peut les dupliquer et ajouter ses propres points (photo du chantier nettoyé, du compteur, de l'étiquette énergie).

**Éditeur de modèles (web).** Glisser-déposer des éléments, aperçu en temps réel de l'écran mobile, gestion des versions, bouton « Publier ». Réservé aux rôles `owner` et `admin`, plus l'équipe Preuvio pour les modèles globaux.

**Format d'un modèle.** Exemple illustratif, contenu à valider par un professionnel :

```json
{
  "code": "PAC_AIR_EAU",
  "version": "1.0.0",
  "trade": "chauffage",
  "cee_operation": "BAR-TH-171",
  "title": "Pompe à chaleur air/eau",
  "questions": [
    { "key": "old_boiler_removed", "label": "Ancienne chaudière déposée ?", "type": "yes_no" }
  ],
  "items": [
    {
      "key": "old_boiler",
      "phase": "avant",
      "label": "Ancienne chaudière avant dépose",
      "hint": "Toute la chaudière, de face",
      "required": true,
      "show_if": { "old_boiler_removed": true },
      "min_photos": 1,
      "example_image": "pac/old_boiler.jpg",
      "ai_checks": ["subject:boiler", "sharp", "well_lit"]
    },
    {
      "key": "outdoor_unit_plate",
      "phase": "apres",
      "label": "Plaque de l'unité extérieure",
      "hint": "Rapprochez-vous : la plaque doit être lisible",
      "required": true,
      "min_photos": 1,
      "ai_checks": ["plate_readable"],
      "extract": ["brand", "model", "serial_number"]
    }
  ]
}
```

**Bibliothèque V1.** Ordre de priorité à caler sur les métiers les plus présents dans la base de prospection : PAC air/eau, chauffe-eau thermodynamique, isolation des combles perdus, isolation des murs (intérieur et extérieur), chaudière biomasse, VMC double flux, système solaire combiné, puis rénovation d'ampleur (plusieurs gestes sur un même chantier).

## 8. Module 3 — Pré-contrôle IA

Chaque photo de preuve est vérifiée en deux temps : instantanément sur le téléphone, puis par l'IA sur le serveur dès que le réseau le permet. Le poseur sait avant de partir s'il manque quelque chose ; l'IA signale, elle ne bloque jamais.

*[Schéma : pré-contrôle d'une photo · 2 vérifications, 3 issues]*

Une photo floue est signalée tout de suite, même sans réseau ; une preuve douteuse passe en orange et c'est le bureau qui tranche, jamais l'IA seule.

| Contrôle | Où | Quand | Message type |
|---|---|---|---|
| Netteté, luminosité, image vide | Téléphone | Instantané, hors ligne | « Photo floue, reprenez » |
| Sujet attendu visible | Serveur, IA vision | Dès réception | « On ne voit pas l'unité extérieure » |
| Plaque ou étiquette lisible, extraction des données | Serveur, IA vision | Dès réception | « Plaque illisible, rapprochez-vous » |
| Cohérence entre photos du chantier | Serveur, IA vision | À la fin du chantier | « Le modèle diffère de la photo de pose » |
| Photo réutilisée d'un autre chantier | Serveur, empreinte perceptuelle | Dès réception | Alerte visible du bureau uniquement |

**Contrat de sortie de l'IA.** L'appel est fait avec la consigne de l'emplacement et la liste `ai_checks` du modèle. La réponse est un JSON strict, validé par un schéma zod avant enregistrement :

```json
{
  "status": "ok | warn | fail",
  "checks": [
    { "id": "plate_readable", "pass": false, "confidence": 0.62, "reason": "reflet sur la plaque" }
  ],
  "extracted": { "brand": "", "model": "", "serial_number": "" },
  "user_message": "Plaque illisible, rapprochez-vous"
}
```

**Règles d'affichage.**

- Vert : preuve conforme, l'emplacement est coché avec une vibration courte.
- Orange : message de 8 mots maximum et deux boutons, « Reprendre » et « Garder quand même ».
- Confiance faible : la photo est envoyée au bureau en « à vérifier », sans déranger le poseur.
- IA indisponible : statut « analyse en attente », nouvel essai automatique, aucune action bloquée.

**Amélioration continue.** Quand le bureau corrige un verdict, la correction est enregistrée. Un tableau interne suit le taux de fausses alertes par contrôle et par modèle, pour ajuster les consignes envoyées à l'IA.

**Maîtrise des coûts.**

- Image redimensionnée (environ 1 500 px de long côté) avant envoi à l'IA.
- Un seul appel par photo de preuve ; les photos libres sont classées par un appel groupé moins coûteux.
- Modèle rapide et économique pour les photos, modèle plus puissant réservé aux rapports.
- Quota journalier par entreprise et alerte interne en cas de dépassement.

**Garde-fous.**

- Aucune reconnaissance faciale. Les visages et plaques d'immatriculation sont floutés sur les copies destinées au client et au marketing.
- Les données envoyées au fournisseur d'IA ne servent pas à entraîner ses modèles (conditions commerciales de l'API, à vérifier et à mentionner dans la politique de confidentialité).
- L'IA ne déclare jamais un chantier conforme à la place d'un humain : elle prépare, le bureau valide.

## 9. Module 4 — Notes vocales, annotations et rapports

Le poseur parle, l'appli écrit : chaque note vocale est transcrite et rangée, et les rapports de chantier se génèrent seuls à partir des photos et des notes. Le bureau relit avant tout envoi.

**Notes vocales.**

- Appui long sur le micro, depuis la caméra, une photo ou la fiche du chantier ; relâcher termine l'enregistrement. Durée maximale : 2 minutes.
- Hors ligne, l'audio est stocké sur le téléphone et transcrit à la synchronisation.
- Le texte transcrit est nettoyé par l'IA (ponctuation, vocabulaire du métier : PAC, R32, calorifuge, pare-vapeur…). L'audio d'origine est toujours conservé.
- Si la note signale un problème (« il manque un raccord », « client absent »), une alerte est créée pour le bureau. Si elle mentionne du matériel, il est ajouté à une liste « À commander ». L'IA signale, elle n'agit pas seule.

**Annotations.** Flèche, cercle, rectangle et texte dicté, sur un calque séparé de la photo d'origine.

**Rapports générés.**

| Rapport | Déclencheur | Contenu | Destinataire |
|---|---|---|---|
| Compte rendu du jour | 18 h, s'il y a eu de l'activité | Photos du jour, notes résumées, preuves manquantes | Dirigeant, chef d'équipe |
| Fin de chantier | Le poseur appuie sur « Terminer le chantier » | Travaux réalisés, avant/après, équipements posés (données extraites des plaques), réserves, PV signé | Bureau ; version simplifiée pour le client |
| Dossier de litige | Sélection de photos puis « Créer un rapport » | Photos horodatées, métadonnées, notes, empreintes | Client, assureur, expert |
| Préparation de contrôle | Avant un contrôle annoncé | Toutes les preuves classées dans l'ordre du référentiel de contrôle | Bureau |

**Fabrication d'un rapport.**

1. L'IA reçoit uniquement les transcriptions, les légendes et les résultats d'analyse des photos du chantier.
2. Elle produit un JSON structuré : résumé, travaux réalisés, réserves, points d'attention. Chaque phrase renvoie aux photos ou notes qui la justifient.
3. Le PDF est composé à partir d'un gabarit fixe aux couleurs de l'entreprise : jamais de mise en page laissée à l'IA.
4. Le bureau peut modifier le texte avant envoi ; chaque version est conservée.

**Mise en page du PDF.** En-tête avec logo et numéros RGE ; bloc chantier (client, adresse, dates, opérations) ; grille de photos de 2 × 3 avec légende, date, heure et position ; annexe des métadonnées et empreintes ; QR code renvoyant vers une page qui vérifie l'intégrité du document.

## 10. Module 5 — Score de conformité, lots et alertes

Chaque chantier affiche un score de complétude de ses preuves, et chaque lot CEE affiche son taux de non-conformité observé face au seuil réglementaire, pour corriger avant qu'un lot soit bloqué.

**Score d'un chantier.** Il compte les preuves obligatoires conformes ou validées à la main :

```latex
\text{Score} = \frac{\text{preuves obligatoires conformes ou validées}}{\text{preuves obligatoires attendues}} \times 100
```

Trois états lisibles d'un coup d'œil, toujours avec icône et mot :

- Complet : 100 %, toutes les preuves sont vertes ou validées.
- À compléter : au moins une preuve obligatoire manque.
- À risque : une preuve orange n'a pas été tranchée, ou une dispense est en attente de validation.

**Suivi des lots CEE.**

- L'entreprise regroupe ses chantiers en lots (délégataire, fiche d'opération, période), ou les importe depuis un fichier fourni par le délégataire.
- Pour chaque contrôle subi, le bureau saisit le résultat : satisfaisant, non satisfaisant ou non vérifiable, avec les constats.
- Taux observé du lot = contrôles non satisfaisants ÷ contrôles réalisés.
- Les seuils sont stockés dans une table de configuration par année, jamais codés en dur. Valeurs initiales : 14 % en 2026, 12 % en 2027, 10 % à partir de 2028 ([source](https://selectra.info/energie/actualites/renovation-energetique/controles-cee-non-conformite-fraude-arrete-juillet-2026)).
- Projection simple : « Si 2 chantiers de plus sont jugés non satisfaisants, ce lot dépasse le seuil. »
- Liste « À corriger en priorité » : chantiers non satisfaisants pas encore repris, avec un bouton « Planifier la reprise » qui crée de nouveaux emplacements de preuve « après correction ».

Ce taux est un indicateur interne : il ne remplace ni le contrôle officiel ni le calcul du délégataire.

**Alertes.**

| Événement | Destinataires | Canal |
|---|---|---|
| Chantier terminé avec des preuves manquantes | Chef d'équipe, dirigeant | Notification immédiate |
| Photo orange non tranchée depuis 48 h | Bureau | Récapitulatif quotidien |
| Lot à moins de 2 points du seuil, ou au-dessus | Dirigeant | Notification et e-mail |
| Contrôle non satisfaisant enregistré | Dirigeant, chef d'équipe | Notification immédiate |
| Qualification RGE expirant dans moins de 60 jours | Dirigeant | E-mail |

Chaque utilisateur peut couper les alertes non critiques ; les alertes de seuil et de contrôle restent actives pour le dirigeant.

## 11. Module 6 — Export des dossiers et intégrations

Un clic produit le dossier complet d'un chantier, nommé et ordonné selon les règles du délégataire choisi, prêt à être déposé. L'export groupé traite plusieurs chantiers d'un coup.

**Contenu d'un export (un ZIP par chantier).**

- `synthese.pdf` : fiche chantier, liste des preuves avec vignettes, équipements extraits des plaques, PV de réception signé.
- `photos/` : copies filigranées des originaux, nommées selon la règle du délégataire.
- `pieces/` : documents ajoutés par le bureau (devis signé, facture, attestations signées, offre CEE).
- `metadonnees.csv` : pour chaque photo, date, heure, position, précision, auteur, empreinte.
- `manifest.json` : empreintes de tous les fichiers du ZIP, pour prouver qu'aucun n'a été modifié.

**Règles de nommage.** Chaque délégataire a un modèle de nom configurable sur le web, par exemple `{REF_CHANTIER}_{FICHE}_{ETAPE}_{N}.jpg`. Un modèle par défaut s'applique si aucun délégataire n'est choisi.

**Vérification avant export.** L'écran d'export liste ce qui manque, en vert ou en rouge :

- Preuves photo obligatoires complètes.
- Pièces administratives présentes (devis, facture, attestations, offre CEE).
- Cohérence des dates : acceptation de l'offre CEE, puis signature du devis, puis travaux, puis facture. Règle à confirmer avec chaque délégataire.
- Qualification RGE de l'entreprise valide à la date des travaux, pour le bon domaine.

Un export reste possible avec des manques, mais il est alors marqué « incomplet » dans l'historique.

**MaPrimeRénov'.** Pas de dépôt automatique : l'export prépare des fichiers prêts à téléverser sur la plateforme de l'Anah, dans l'ordre demandé.

**Envoi.** Téléchargement direct, ou lien sécurisé à durée limitée envoyé par e-mail au délégataire. Connexion directe aux plateformes des délégataires envisagée en V2, sous forme de partenariats.

**Intégrations.**

| Intégration | Version | Contenu |
|---|---|---|
| Import CSV de chantiers et de clients | V1 | Modèle de fichier téléchargeable, correspondance des colonnes à l'écran |
| Agenda (fichier ICS Google ou Outlook) | V1 | Chantiers du jour alimentés par l'agenda de l'entreprise |
| Logiciels de devis et facturation du bâtiment | V2 | Création automatique des chantiers à la signature d'un devis, sous réserve des API disponibles |
| Webhooks sortants | V2 | Événements « chantier terminé », « export prêt », « contrôle non satisfaisant » |
| API publique REST | V2 | Pour les entreprises plus grosses et les délégataires partenaires |

## 12. Module 7 — Portail client et PV de réception

Le client reçoit un lien par SMS, voit ses travaux en photos et signe son PV de réception, sans compte ni appli à installer. Pour l'entreprise, c'est un argument commercial et une preuve de plus.

**Page client (web, pensée pour le téléphone, aux couleurs de l'entreprise).**

- En-tête : logo, nom de l'entreprise, mention de la qualification RGE.
- Galeries « Avant », « Pendant », « Après ». Par défaut, les photos de preuve sont visibles et les photos « Divers » masquées ; le bureau peut ajuster photo par photo.
- Résumé des travaux en langage simple et liste des équipements posés.
- Boutons « Appeler » et « Envoyer un SMS » vers l'entreprise.
- Documents utiles : PV signé, rapport de fin de chantier ; notices et guide d'entretien en V2.

**Signature du PV de réception.**

1. Le client lit le PV, généré à partir d'un gabarit.
2. Il choisit « Sans réserve » ou « Avec réserves » ; les réserves se dictent ou se tapent.
3. Il signe au doigt ; son nom et la date sont remplis automatiquement.
4. En option, un code reçu par SMS confirme son identité avant la signature.
5. Le PV signé est envoyé par e-mail ou SMS au client et rangé dans le chantier.

Le même parcours existe dans l'appli du poseur, en « mode client » : grand écran épuré, le poseur tend son téléphone.

**Après la signature.** Si le PV est signé sans réserve, la page propose de laisser un avis Google sur la fiche de l'entreprise. Aucune contrepartie n'est jamais proposée en échange d'un avis.

**Sécurité du lien.**

- Jeton aléatoire de 32 octets, stocké haché, valable 90 jours et prolongeable par le bureau.
- Page exclue des moteurs de recherche, nombre de tentatives limité.
- À la signature, on enregistre le nom, l'horodatage, l'adresse IP, le navigateur et l'empreinte SHA-256 du document.

**Valeur juridique.** Il s'agit d'une signature électronique simple au sens d'eIDAS. Une signature avancée via un prestataire spécialisé pourra être proposée en V2 pour les chantiers à forts enjeux.

## 13. Module 8 — Recyclage marketing des photos

Les photos avant/après deviennent des contenus prêts à publier, que le dirigeant valide en un tap. C'est la fonction qui transforme une obligation de conformité en outil commercial.

**Consentement d'abord.** Le PV de réception contient une case : « J'accepte que les photos de mes travaux, sans adresse ni visage, soient utilisées par l'entreprise. » Sans cette case cochée, aucun contenu n'est créé pour ce chantier.

**Création automatique.**

- Pour chaque chantier terminé et conforme, l'IA choisit la meilleure paire avant/après : même cadrage, bonne lumière.
- Visuels générés en carré (1 080 × 1 080) et en vertical (1 080 × 1 920), avec le logo et le nom de la ville, jamais l'adresse.
- Floutage automatique des visages, plaques d'immatriculation et numéros de rue.
- Légende courte rédigée par l'IA pour la fiche Google de l'entreprise, Facebook, Instagram ou LinkedIn, avec un ton réglable (sobre, chaleureux, technique).

**Validation.** Rien n'est jamais publié automatiquement. Les contenus attendent dans une file « À valider » ; le dirigeant appuie sur « Publier » ou « Ignorer ».

**Publication.**

- V1 : partage natif du téléphone vers n'importe quelle appli, et téléchargement.
- V2 : publication directe sur la fiche Google et sur les réseaux sociaux, via leurs API.

**Pistes V2.**

- Page « Nos réalisations » publique pour chaque entreprise, avec galerie, carte par ville et lien vers les avis Google, utile pour le référencement local.
- Rappel d'entretien annuel envoyé au client par SMS, au nom de l'entreprise, pour générer du chiffre d'affaires récurrent.

## 14. Module 9 — Tableau de bord, équipe et notifications

Le dirigeant voit sur un seul écran ce qui risque de lui coûter des primes, et gère son équipe sans formation. Les poseurs se connectent sans mot de passe.

**Tableau de bord (web, avec une version résumée sur mobile).**

- Quatre tuiles : chantiers en cours, chantiers à risque, photos à trancher, lots proches du seuil. Un tap ouvre la liste filtrée.
- Liste « À traiter » triée par gravité, avec l'action directe sur chaque ligne (trancher, demander une reprise, exporter).
- Carte des chantiers du jour, avec une épingle colorée par état.
- Taux de preuves complètes du premier coup par poseur, visible du dirigeant uniquement, pour accompagner et non pour sanctionner.
- Évolution hebdomadaire du taux de complétude de l'entreprise.

**Rôles et droits.**

| Action | Poseur | Chef d'équipe | Bureau | Admin | Dirigeant |
|---|---|---|---|---|---|
| Photographier ses chantiers | Oui | Oui | Non | Oui | Oui |
| Voir les chantiers | Les siens | Son équipe | Tous | Tous | Tous |
| Créer un chantier | Oui | Oui | Oui | Oui | Oui |
| Trancher une photo orange, valider une dispense | Non | Oui | Oui | Oui | Oui |
| Exporter un dossier | Non | Non | Oui | Oui | Oui |
| Modifier les modèles de checklists | Non | Non | Non | Oui | Oui |
| Voir les indicateurs par poseur | Non | Son équipe | Non | Oui | Oui |
| Gérer les utilisateurs et l'abonnement | Non | Non | Non | Oui | Oui |

**Gestion de l'équipe.**

- Invitation d'un poseur par SMS : il touche le lien, l'appli s'installe et il est connecté. Aucune adresse e-mail exigée.
- Connexion par code SMS ou lien magique, session de 90 jours sur le téléphone.
- Téléphone partagé : changement d'utilisateur en touchant sa photo de profil, puis un code à 4 chiffres.
- Départ d'un salarié : désactivation en un clic, ses photos et notes restent dans l'entreprise.

**Notifications.**

- Notifications push pour l'urgent, récapitulatif e-mail pour le reste.
- Récapitulatif du dirigeant chaque soir à 18 h 30.
- Heures calmes entre 20 h et 7 h : seules les alertes de seuil et de contrôle passent.
- Chaque notification ouvre directement l'écran utile (caméra sur la bonne consigne, photo à trancher, lot concerné).

## 15. Onboarding, essai et abonnements

Une entreprise doit pouvoir s'inscrire, inviter un poseur et documenter son premier chantier en moins de 10 minutes, sans parler à un commercial.

**Inscription du dirigeant.**

1. Téléphone ou e-mail, puis code de confirmation.
2. SIRET : nom et adresse remplis automatiquement via l'API publique de recherche d'entreprises.
3. Qualifications RGE : organisme et numéro. Vérification envisagée via le jeu de données ouvert des entreprises RGE publié par l'ADEME (à confirmer).
4. Métiers exercés, en tuiles : les modèles de checklists correspondants sont activés.
5. Logo et couleur de l'entreprise (étape facultative).
6. Invitation des poseurs par numéro de téléphone ou depuis les contacts.
7. Un chantier de démonstration, déjà rempli de photos d'exemple, permet de découvrir l'appli sans risque.

**Premier lancement du poseur (3 écrans au maximum).**

1. Bienvenue, avec une vidéo de 30 secondes facultative.
2. Autorisations demandées au moment où elles servent, chacune expliquée en une phrase : caméra, position, micro, notifications.
3. Son premier chantier, prêt à démarrer.

**Essai gratuit.** 30 jours ou 10 chantiers, sans carte bancaire. À la fin, les données restent consultables 90 jours.

**Offres.** Prix indicatifs, hypothèses à tester pendant le pilote :

| Offre | Pour qui | Contenu | Prix HT |
|---|---|---|---|
| Solo | 1 à 2 utilisateurs | Photos, checklists, pré-contrôle IA, exports, portail client | 39 € par mois |
| Équipe | Jusqu'à 10 utilisateurs | Solo + tableau de bord, suivi des lots CEE, rôles, marketing | 99 € par mois |
| Entreprise | Plus de 10 utilisateurs | Équipe + modèles personnalisés illimités, accompagnement, API en V2 | Sur devis |

Abonnement annuel avec deux mois offerts. Stockage des photos et analyses IA inclus, avec un usage raisonnable surveillé en interne.

**Facturation.** Stripe Checkout et portail client Stripe : carte bancaire et prélèvement SEPA, factures avec TVA française, changement d'offre et résiliation en libre-service. Prévoir la conformité à la facturation électronique obligatoire entre entreprises (calendrier à vérifier pour la taille de Preuvio).

**Résiliation.** En un clic, avec export complet des données de l'entreprise (photos, PDF, CSV). Savoir qu'on peut partir facilement rassure à l'inscription.

## 16. Sécurité, RGPD et valeur probante

Les photos de chantier sont à la fois des données personnelles (le domicile du client, parfois des visages) et des preuves. Preuvio les héberge en Europe, les scelle dès la prise de vue et les conserve assez longtemps pour couvrir contrôles et litiges.

**RGPD.**

- L'entreprise cliente est responsable du traitement des données de ses clients ; Preuvio est son sous-traitant. Un accord de sous-traitance (article 28 du RGPD) est annexé aux conditions générales.
- Preuvio est responsable de traitement pour les comptes utilisateurs et la facturation.
- Registre des traitements et liste publique des sous-traitants ultérieurs (Supabase, fournisseur d'IA, Brevo, Stripe, Sentry, PostHog, Vercel), avec leur localisation et les garanties en cas de transfert hors UE.
- Minimisation : l'appli ne demande jamais de photographier des personnes ; floutage automatique sur les copies client et marketing.
- Géolocalisation des salariés : la position est relevée uniquement au moment d'une photo, jamais en continu. Un modèle de note d'information des salariés est fourni au dirigeant.
- Modèle de mention d'information pour les clients finaux, à intégrer au devis ou au PV.
- Droits d'accès et de suppression traités via le bureau de l'entreprise ; quand une obligation de conservation s'applique, les données sont conservées mais leur accès est restreint.
- Analyse d'impact (AIPD) : nécessité à évaluer avant le lancement commercial.

**Conservation.**

- Durée par défaut de 10 ans, alignée sur la garantie décennale, réglable par entreprise. Durées minimales réglementaires (CEE, Anah) à faire valider par un juriste.
- Les originaux de plus de 12 mois passent sur un stockage d'archive moins coûteux (par exemple Cloudflare R2), les vignettes restent immédiatement accessibles.

**Valeur probante.**

- Empreinte SHA-256 calculée à la prise de vue, vérifiée à la réception, reprise dans chaque export.
- Journal d'audit en ajout seul : aucune ligne ne peut être modifiée ni supprimée.
- Horodatage qualifié eIDAS par un prestataire de confiance : en option V1 pour les PV et les exports, à chiffrer pour chaque photo en V2.
- Formulation honnête dans l'appli et le contrat : Preuvio fournit des éléments de preuve, il ne garantit pas leur acceptation par un contrôleur ou un juge.

**Sécurité technique.**

- Politiques RLS sur toutes les tables, avec des tests automatisés qui vérifient qu'un utilisateur de l'entreprise A ne lit rien de l'entreprise B.
- Stockage privé, accès aux fichiers uniquement par URL signée valable 5 minutes.
- Chiffrement en transit (TLS) et au repos ; secrets uniquement côté serveur, avec rotation des clés.
- Sauvegardes quotidiennes avec restauration à un instant donné, test de restauration chaque trimestre.
- Limitation du nombre d'appels sur les fonctions, protection contre l'abus d'envoi de SMS (coût direct).
- Test d'intrusion léger avant le lancement commercial.

## 17. Exigences non fonctionnelles

L'appli doit rester rapide sur un téléphone Android d'entrée de gamme de 3 ans, en zone mal couverte : c'est l'appareil de référence pour tous les tests de performance.

| Exigence | Cible | Mesure |
|---|---|---|
| Ouverture à froid jusqu'à la caméra prête | Moins de 2 s | Téléphone de référence, suivi de performance Sentry |
| Déclenchement jusqu'à la photo enregistrée | Moins de 1 s | Test instrumenté |
| Contrôle local de netteté | Moins de 300 ms | Test instrumenté |
| Verdict IA après réception par le serveur | Moins de 10 s pour 95 % des photos | Journaux des fonctions |
| Photos perdues | Aucune | Tests de coupure réseau, fermeture forcée, batterie faible |
| Actions terrain hors ligne | Toutes : photo, voix, checklist, signature | Tests en mode avion |
| Systèmes compatibles | iOS 16 et plus, Android 10 et plus | Matrice de tests |
| Disponibilité du serveur | 99,5 % par mois | Supervision externe |
| Tableau de bord web | Score Lighthouse supérieur à 90 en performance et accessibilité | Lighthouse en CI |

**Tests.**

- Unitaires : toute la logique de `packages/shared` (score, nommage, conditions des checklists), couverture supérieure à 80 %.
- Sécurité des données : tests SQL des politiques RLS, entreprise par entreprise.
- Bout en bout mobile avec Maestro : parcours complet du poseur, en ligne puis en mode avion.
- Bout en bout web avec Playwright : export, tableau de bord, page client, signature.
- Évaluation de l'IA : un jeu de photos annotées (bonnes et mauvaises) par modèle de checklist, rejoué avant chaque changement de consigne pour mesurer les fausses alertes et les oublis.
- Terrain : sessions observées avec des artisans pilotes, sans aide, chronomètre en main.

**Suivi en production.**

- Sentry pour les plantages et la performance, mobile et web.
- PostHog (hébergé en UE) avec des événements nommés : `app_open`, `jobsite_started`, `photo_taken`, `ai_verdict`, `slot_completed`, `jobsite_completed`, `export_created`, `pv_signed`.
- Alerte si la file d'analyse IA dépasse 5 minutes de retard.

**Livraison.**

- GitHub Actions : lint, vérification des types et tests à chaque modification.
- EAS Build pour les versions des stores, EAS Update pour les corrections rapides sans passer par les stores.
- Prévisualisation Vercel pour chaque branche web, migrations Supabase versionnées et appliquées par la CLI.

## 18. Plan de développement avec Claude Code

Le développement se découpe en 19 sessions réparties en 5 phases, avec deux jalons de validation sur le terrain. Une session correspond à une fonctionnalité complète et testée ; elle peut s'étaler sur plusieurs conversations Claude Code.

*[Schéma : feuille de route · 5 phases, 19 sessions, 2 jalons]*

Le cœur terrain est testé par de vrais poseurs avant d'ajouter l'IA ; la vente ne démarre qu'après le pilote.

**Règles de travail avec Claude Code.**

1. Exporter ce cahier des charges en Markdown et le placer dans le dépôt sous `docs/cahier-des-charges.md`, avec le fichier `CLAUDE.md` de l'annexe à la racine.
2. Une session = une fonctionnalité. Toujours commencer par demander un plan, le relire, puis lancer l'implémentation.
3. Tester sur un vrai téléphone (build de développement Expo) à la fin de chaque session touchant le mobile.
4. Terminer chaque session par lint, vérification des types, tests, puis un commit.
5. Ne jamais passer à la session suivante si un test échoue.

**Prompt type, à adapter à chaque session.**

```text
Lis CLAUDE.md puis docs/cahier-des-charges.md, section {N}.
Objectif de cette session : {objectif}.
1. Propose d'abord un plan court (fichiers à créer ou modifier, risques) et attends ma validation.
2. Implémente par petites étapes, avec des tests.
3. Termine par lint, typecheck et tests, puis résume ce qui reste à faire.
```

### Phase 0 — Fondations

**S1 — Monorepo et outillage.** Terminée quand `pnpm dev` lance le mobile et le web, et que la CI passe.

```text
Section 4 et 17. Crée le monorepo pnpm + Turborepo décrit : apps/mobile (Expo, Expo Router, TypeScript strict, build de développement), apps/web (Next.js App Router, Tailwind, shadcn/ui), packages/ui-tokens, packages/shared, packages/templates, dossier supabase/. Ajoute ESLint, Prettier, Vitest et un workflow GitHub Actions (lint, typecheck, tests).
```

**S2 — Design system.** Terminée quand un écran « Catalogue » affiche tous les composants en clair, sombre et contraste maximal.

```text
Section 3. Crée packages/ui-tokens avec les jetons de couleur, typographie (Atkinson Hyperlegible) et espacements. Dans apps/mobile, crée les composants BigButton, ShutterButton, ProofCard, StatusPill, ChecklistRow, VoiceButton, ProgressRing, Toast, EmptyState, avec retour haptique, cibles de 56 px minimum et libellés d'accessibilité. Ajoute un écran Catalogue caché (mode développeur).
```

**S3 — Base de données et sécurité.** Terminée quand les tests RLS prouvent l'isolement entre deux entreprises.

```text
Sections 5 et 16. Écris les migrations Supabase de toutes les tables, les statuts, les index, les politiques RLS par company_id et le journal d'audit en ajout seul. Ajoute des tests SQL qui vérifient qu'un utilisateur de l'entreprise A ne lit ni n'écrit rien de l'entreprise B. Ajoute un jeu de données de démo (une entreprise, 3 utilisateurs, 2 chantiers) et l'authentification par code SMS.
```

### Phase 1 — Cœur terrain

**S4 — Connexion et écran « Aujourd'hui ».** Terminée quand un poseur invité voit ses chantiers du jour en trois taps maximum.

```text
Sections 2, 6 et 14. Implémente la connexion par code SMS, l'onboarding poseur en 3 écrans, la navigation en 3 onglets (Aujourd'hui, Chantiers, Moi) et l'écran Aujourd'hui (chantier le plus proche en tête, ouverture directe si dans le rayon). Respecte les 8 principes de la section 1.
```

**S5 — Hors ligne et synchronisation.** Terminée quand on peut créer un chantier en mode avion et le retrouver sur le serveur après reconnexion.

```text
Section 4. Mets en place la base locale SQLite et la synchronisation avec PowerSync (ou, si tu juges PowerSync inadapté, une file de modifications maison : explique ton choix avant). Couvre chantiers, opérations, emplacements de preuve et photos (métadonnées). Ajoute la création rapide de chantier en 3 étapes avec l'API Adresse.
```

**S6 — Caméra guidée.** Terminée quand une photo est enregistrée en moins d'une seconde avec toutes ses métadonnées et son empreinte.

```text
Section 6. Implémente l'écran caméra avec react-native-vision-camera : bandeau de consigne, vignette d'exemple, rafale, zoom, flash, contraste maximal. À chaque photo, calcule le SHA-256, enregistre l'heure, le GPS, la précision, le cap, l'auteur, crée une vignette de 400 px et rattache la photo à l'emplacement actif. Refuse l'import depuis la galerie pour les emplacements de preuve.
```

**S7 — File d'envoi.** Terminée quand aucun test de coupure (mode avion, fermeture forcée, batterie faible) ne perd de photo.

```text
Section 6, partie « Hors ligne et envoi ». Implémente la file d'envoi reprenable (TUS) vers Supabase Storage, la vérification d'empreinte côté serveur avant suppression locale, l'indicateur discret, l'option Wi-Fi uniquement et la pause sous 15 % de batterie. Écris les tests correspondants.
```

**S8 — Moteur de checklists.** Terminée quand un chantier PAC air/eau se documente de bout en bout avec l'écran récapitulatif.

```text
Section 7. Crée le schéma zod des modèles dans packages/shared, deux modèles d'exemple dans packages/templates (PAC air/eau, isolation des combles), le générateur d'emplacements de preuve, les questions oui/non et numériques, les conditions show_if, la dispense avec motif et l'écran de fin de chantier. Logique métier testée à plus de 80 %.
```

**Jalon — Test terrain.** Deux poseurs documentent de vrais chantiers sans aide, pendant au moins une semaine. On corrige l'ergonomie avant d'ajouter l'IA.

### Phase 2 — Intelligence

**S9 — Contrôle local.** Terminée quand une photo floue ou trop sombre est signalée en moins de 300 ms, sans réseau.

```text
Section 8. Ajoute sur le téléphone un contrôle de netteté et de luminosité sur une version réduite de l'image, avec message immédiat et boutons Reprendre / Garder. Calibre les seuils sur un petit jeu de photos de test.
```

**S10 — Pré-contrôle IA.** Terminée quand les pastilles verte et orange s'affichent dans l'appli et que le jeu d'évaluation est en place.

```text
Section 8. Crée la file pgmq et l'Edge Function d'analyse : image redimensionnée, appel IA vision derrière une interface remplaçable, sortie JSON validée par zod, nouvel essai en cas d'erreur, quota par entreprise. Remonte le verdict dans l'appli. Ajoute un script d'évaluation qui rejoue un dossier de photos annotées et calcule fausses alertes et oublis.
```

**S11 — Notes vocales.** Terminée quand une note dictée hors ligne apparaît transcrite après synchronisation.

```text
Section 9, partie « Notes vocales ». Implémente l'enregistrement par appui long, le stockage hors ligne, la transcription côté serveur, le nettoyage par l'IA avec le vocabulaire du métier, la détection des problèmes et du matériel à commander, et les annotations sur calque séparé.
```

### Phase 3 — Bureau

**S12 — Tableau de bord web.** Terminée quand le dirigeant tranche une photo orange et que le poseur reçoit la demande de reprise.

```text
Sections 10 et 14. Dans apps/web : connexion, tableau de bord (4 tuiles, liste À traiter, carte), fil photo des chantiers, décision sur les photos orange, demandes de reprise envoyées en notification push, gestion des rôles selon la matrice.
```

**S13 — Rapports PDF.** Terminée quand le rapport de fin de chantier sort aux couleurs de l'entreprise, avec QR code de vérification.

```text
Section 9, parties « Rapports ». Génère le JSON structuré par l'IA uniquement à partir des données du chantier, puis le PDF avec @react-pdf/renderer selon la mise en page décrite. Compte rendu du jour à 18 h, fin de chantier, dossier de litige. Versions conservées, texte modifiable par le bureau avant envoi.
```

**S14 — Exports délégataires.** Terminée quand un export groupé produit des ZIP conformes aux règles de nommage, avec manifeste d'empreintes.

```text
Section 11. Implémente l'écran de vérification avant export, les règles de nommage par délégataire, le ZIP (synthese.pdf, photos filigranées, pieces, metadonnees.csv, manifest.json), l'export groupé, le lien de téléchargement à durée limitée et l'historique. Ajoute l'import CSV des chantiers.
```

**S15 — Lots CEE et alertes.** Terminée quand un lot proche du seuil déclenche l'alerte du dirigeant.

```text
Section 10. Implémente le score de chantier, les lots, la saisie des contrôles, le taux observé, la table des seuils par année, la projection, la liste À corriger en priorité et toutes les alertes du tableau, avec heures calmes.
```

### Phase 4 — Client et vente

**S16 — Page client et PV.** Terminée quand un client signe son PV depuis un lien SMS et le reçoit en PDF.

```text
Section 12. Crée la page client (Next.js, aux couleurs de l'entreprise), les liens sécurisés, la signature au doigt avec réserves, le code SMS facultatif, l'envoi par Brevo, le mode client dans l'appli et la case de consentement marketing.
```

**S17 — Marketing.** Terminée quand un visuel avant/après flouté et sa légende attendent la validation du dirigeant.

```text
Section 13. Choix automatique de la paire avant/après, visuels carré et vertical avec logo et ville, floutage des visages, plaques et numéros, légende par l'IA, file À valider et partage natif. Rien sans consentement du client.
```

**S18 — Inscription et abonnements.** Terminée quand une entreprise s'inscrit, invite un poseur et paie, sans aide.

```text
Section 15. Parcours d'inscription du dirigeant (SIRET, RGE, métiers, logo, invitations), chantier de démonstration, essai gratuit, Stripe Checkout et portail client, offres, résiliation avec export complet des données.
```

**S19 — Finitions avant pilote.** Terminée quand toutes les cibles de la section 17 sont atteintes sur le téléphone de référence.

```text
Sections 16 et 17. Mesure et optimise les performances sur un Android d'entrée de gamme, audit d'accessibilité, Sentry et PostHog avec les événements listés, export et suppression des données, pages légales, tests Maestro et Playwright des parcours complets.
```

**Jalon — Pilote.** Dix entreprises de la base de prospection utilisent Preuvio sur leurs vrais chantiers ; on mesure les critères de la section 19 avant d'ouvrir la vente.

## 19. Critères de recette et indicateurs du pilote

La vente ne démarre que si le pilote prouve deux choses : les poseurs utilisent l'appli sans aide, et les dirigeants sont prêts à payer. Les cibles ci-dessous sont des hypothèses à confirmer pendant le pilote.

| Indicateur | Cible | Mesure |
|---|---|---|
| Poseurs qui documentent leur premier chantier sans aide | Au moins 8 sur 10 | Sessions observées |
| Temps de manipulation par chantier | Moins de 2 minutes | Événements PostHog |
| Chantiers complets du premier coup, sans reprise demandée | Plus de 80 % | Données de l'appli |
| Pastilles orange contestées par le bureau | Moins de 10 % | Corrections enregistrées |
| Chantiers des entreprises pilotes passés par Preuvio | Plus de 80 % | Comparaison avec leur planning |
| Temps de préparation d'un dossier délégataire | Divisé par deux | Entretien avant et après |
| Sessions avec plantage | Moins de 0,5 % | Sentry |
| Entreprises prêtes à payer à la fin du pilote | Au moins 7 sur 10 | Proposition commerciale réelle |

**Recette fonctionnelle avant le pilote.**

- Parcours complet du poseur en mode avion, synchronisation au retour du réseau, aucune photo perdue.
- Photo floue signalée sans réseau, en moins de 300 ms.
- Pastille orange tranchée par le bureau, demande de reprise reçue par le poseur sur la bonne consigne.
- Rapport de fin de chantier aux couleurs de l'entreprise, avec QR code de vérification fonctionnel.
- Export ZIP conforme aux règles de nommage de deux délégataires différents, manifeste d'empreintes vérifié.
- Alerte reçue par le dirigeant quand un lot approche du seuil.
- PV signé par le client depuis un lien SMS, PDF reçu par e-mail.
- Aucun contenu marketing créé sans consentement du client.
- Isolement entre entreprises prouvé par les tests RLS.
- Inscription, invitation d'un poseur et paiement réalisés sans aide.
- Toutes les cibles de performance de la section 17 atteintes sur le téléphone de référence.

## 20. Annexes

### Fichier CLAUDE.md à placer à la racine du dépôt

```markdown
# Preuvio — consignes pour Claude Code

## Le produit
Appli de preuve de pose pour entreprises RGE.
Spécification complète : docs/cahier-des-charges.md.
En cas de doute, la spécification fait foi : pose la question plutôt que d'inventer.

## Utilisateur principal
Poseur sur chantier : gants, plein soleil, réseau faible, peu à l'aise avec le numérique.
Chaque écran mobile respecte les 8 principes de la section 1.

## Stack
- Monorepo pnpm + Turborepo
- apps/mobile : Expo, Expo Router, TypeScript strict, react-native-vision-camera
- apps/web : Next.js App Router, Tailwind, shadcn/ui
- supabase/ : Postgres, RLS, Storage, Edge Functions, pgmq
- packages/shared : logique métier pure, schémas zod, tests Vitest

## Règles
- Aucune clé d'API dans apps/mobile : tout appel externe passe par une Edge Function.
- Toute table a un company_id et une politique RLS testée.
- Une photo n'est jamais modifiée ni supprimée physiquement.
- Couleurs et tailles uniquement via packages/ui-tokens.
- Textes d'interface en français, via les fichiers de traduction ; consignes de 8 mots maximum.
- Appels IA via packages/shared/ai (interface remplaçable) :
  claude-haiku-5-5 pour les photos, claude-sonnet-5-5 pour les rapports.
- Logique métier dans packages/shared, couverte à plus de 80 %.

## Méthode
1. Lire la section concernée, proposer un plan, attendre la validation.
2. Avancer par petites étapes, avec des tests.
3. Fin de session : pnpm lint, pnpm typecheck, pnpm test, puis résumé.

## Commandes
pnpm dev · pnpm test · pnpm lint · pnpm typecheck · supabase start · supabase db reset
```

### Glossaire

| Terme | Définition |
|---|---|
| CEE | Certificats d'économies d'énergie : primes financées par les fournisseurs d'énergie |
| RGE | Reconnu garant de l'environnement : qualification exigée pour ouvrir droit aux aides |
| Délégataire | Organisme qui gère et finance les dossiers CEE pour le compte des fournisseurs d'énergie |
| Fiche d'opération standardisée | Fiche officielle qui définit une opération CEE et ses conditions (ex. BAR-TH-171) |
| COFRAC | Instance qui accrédite les organismes réalisant les contrôles sur site |
| Lot | Ensemble de dossiers CEE déposés ensemble pour une même fiche |
| PV de réception | Document signé par le client qui marque la fin des travaux, avec ou sans réserves |
| RLS | Sécurité au niveau des lignes : règle de base de données qui isole chaque entreprise |
| Empreinte SHA-256 | Code unique calculé à partir d'un fichier : la moindre modification le change |

### Points à valider avant ou pendant le développement

- Contenu de chaque modèle de checklist, relu par un professionnel du métier.
- Règles de nommage et pièces exigées par les principaux délégataires.
- Durées légales de conservation (CEE, Anah), avec un juriste.
- Conditions du fournisseur d'IA sur la non-réutilisation des données envoyées.
- Faisabilité de la vérification RGE via les données ouvertes de l'ADEME.
- Choix entre PowerSync et une file de modifications maison, après un prototype.
- Prix des offres, testés pendant le pilote.
- Nom « Preuvio » : disponibilité de la marque à l'INPI et du nom de domaine.
- Calendrier de facturation électronique applicable à Preuvio.

### Sources

- [Arrêté du 27 juillet 2026 sur les contrôles CEE, analyse Selectra](https://selectra.info/energie/actualites/renovation-energetique/controles-cee-non-conformite-fraude-arrete-juillet-2026) : seuils de malfaçons, taux de contrôle, transmission des sanctions à l'Anah.
- [Check'Réno, application d'autocontrôle de l'AQC, de la FFB et de la CAPEB](https://www.ffbatiment.fr/actualites-batiment/actualite/check-reno-appli-gratuite-autocontrole-et-reception-travaux) : fiches d'autocontrôle et de réception utilisables pour les modèles.
- [CompanyCam, référence américaine valorisée 2 milliards de dollars](https://startlandnews.com/2026/02/companycam-unicorn-valuation/).
