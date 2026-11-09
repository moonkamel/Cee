# 0009 — Exports délégataires : un ZIP par chantier fabriqué par le web, vérification figée

- **Date** : 9 novembre 2026 (session S14)
- **Statut** : adoptée (plan validé par le porteur du projet)
- **Spécification** : section 11 (export, nommage, vérification, envoi, import CSV).

## Décisions

1. **Un ZIP par chantier, un appel par ZIP** (`POST /exports/[id]/zip`, Vercel, Paris). L'export
   groupé crée une ligne `exports` par chantier (même `batch_id`) ; la page les fabrique l'une
   après l'autre en montrant l'avancement. Le ZIP est rangé dans `documents/<entreprise>/exports/`
   avec son empreinte et devient définitif ; on le sert par lien signé (10 min pour le bureau,
   7 jours pour le délégataire). Raison : durée des fonctions et limite de 4,5 Mo des réponses.
2. **Contenu** : `synthese.pdf` (gabarit des rapports : fiche chantier, liste des preuves avec
   renvoi aux vignettes, équipements lus sur les plaques, preuves manquantes, PV à venir),
   `photos/` (copies filigranées des **preuves** : photos de la caméra rattachées à un
   emplacement applicable ; les photos libres n'entrent pas au dossier), `pieces/`,
   `metadonnees.csv` (séparateur « ; », BOM, heure de Paris) et `manifest.json` (SHA-256 et taille
   de chaque autre fichier).
3. **Filigrane** (date, heure, adresse, entreprise) sur les copies uniquement, avec `sharp`. Le
   texte est dessiné en tracés SVG depuis la police Atkinson intégrée (`fontkit`) : la fonction
   serveur n'a pas de police système. Orientation EXIF appliquée avant le bandeau.
4. **Nommage** : `{REF_CHANTIER}_{FICHE}_{ETAPE}_{N}.jpg` par défaut ; champs `{CLIENT}` et
   `{DATE}` en plus. N compte par fiche et étape, dans l'ordre de prise ; un nom en double reçoit
   un suffixe ; un modèle invalide retombe sur le modèle par défaut.
5. **Vérification avant export**, figée avec l'export (trigger) : preuves obligatoires et pièces
   exigées en rouge si absentes (export « incomplet » mais possible) ; ordre des dates offre CEE,
   devis, travaux, facture en orange seulement (règle à confirmer par délégataire) ; RGE : date de
   validité vérifiée, **domaine toujours « à vérifier »** tant que la correspondance fiche →
   domaine n'est pas fournie. Pièces exigées par défaut : devis signé, facture, attestation sur
   l'honneur, offre CEE.
6. **Pièces administratives** : nouvelle table `jobsite_documents` (type, fichier, date du
   document), réservée au bureau, à l'admin et au dirigeant ; retrait logique, fichier conservé.
7. **Envoi par e-mail** : Edge Function `send-export-link` (lit l'export avec la session de
   l'appelant, signe le lien avec la clé serveur, envoie par Brevo). Inactif tant que
   `BREVO_API_KEY` et `BREVO_EMAIL_SENDER` ne sont pas configurées.
8. **Import CSV** : modèle téléchargeable, correspondance des colonnes devinée puis modifiable,
   contrôle ligne par ligne avant import, adresses géocodées par la BAN, checklists créées comme
   à la création rapide. 200 lignes au plus par fichier.

## Reste à faire

- MaPrimeRénov' : ordre des fichiers demandé par l'Anah à obtenir.
- Correspondance fiche CEE → domaine RGE, pour vérifier le domaine.
- Agenda ICS (intégration V1 de la section 11, hors S14).
