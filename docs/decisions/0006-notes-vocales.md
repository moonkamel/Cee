# 0006 — Notes vocales : Mistral Voxtral pour la transcription, Claude pour le nettoyage

- **Date** : 9 novembre 2026 (session S11)
- **Statut** : adoptée (validée par le porteur du projet)
- **Spécification** : section 9 (« Notes vocales », « Annotations »).

## Décisions

1. **Transcription : Mistral Voxtral** (`voxtral-mini-latest`, API européenne
   `api.eu.mistral.ai`). Claude ne transcrit pas l'audio. Voxtral est français, traite les
   données dans l'UE et coûte environ 0,1 centime la minute. Il est derrière l'interface
   remplaçable `Transcriber` (`packages/shared/src/ai/transcriber.ts`) et reçoit le
   vocabulaire du métier pour mieux l'écrire.
2. **Nettoyage : Claude** (`claude-haiku-5-5`, sortie structurée validée par zod) : texte
   ponctué, termes du métier corrigés, **problèmes** pour le bureau et **matériel** « À
   commander » (table `note_items`). L'IA liste, elle ne commande ni n'envoie rien. Sans clé
   Anthropic ou en cas de refus, la transcription brute est gardée.
3. **Hors ligne d'abord** : la note (`voice_notes`) et l'audio sont rangés sur le téléphone,
   envoyés par la même file que les photos (mêmes conditions réseau et batterie). L'audio local
   n'est supprimé qu'une fois la transcription revenue ; l'original reste sur le serveur.
4. **File** : la note entre dans la file pgmq `voice_transcription` quand le téléphone signale
   l'audio envoyé ; pg_cron appelle `transcribe-notes` chaque minute si la file n'est pas vide.
   Une note compte pour une analyse dans le quota IA du jour. Transcription et éléments repérés
   sont écrits par le serveur seul ; le bureau marque un élément traité, sans pouvoir le réécrire.
5. **Annotations** : flèche, cercle, rectangle et texte, en coordonnées relatives dans
   `photos.annotations` (calque séparé, validé par zod). La photo d'origine n'est jamais modifiée.

## Limites connues

- L'enregistrement (`expo-audio`) n'a pas encore tourné sur un téléphone : il demande un build.
- Le vrai modèle Voxtral n'a pas été appelé (pas de clé dans ce dépôt) ; la CI utilise des
  services factices.
- Le texte d'une annotation se tape (la dictée du clavier du téléphone fonctionne).
