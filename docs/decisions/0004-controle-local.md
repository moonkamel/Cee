# 0004 — Contrôle local des photos : netteté des bords au centre de l'image

- **Date** : 9 novembre 2026 (session S9)
- **Statut** : adoptée (validée par le porteur du projet)
- **Spécification** : section 8 (« Netteté, luminosité, image vide — téléphone, instantané,
  hors ligne »), critère S9 (signalée en moins de 300 ms, sans réseau).

## Décisions

1. **Mesures** (`packages/shared/src/quality`, logique pure) :
   - luminosité moyenne, part des pixels très sombres et brûlés, sur l'image réduite à 256 px ;
   - « image vide » : écart type de luminance quasi nul ;
   - **netteté** : pente des bords les plus raides rapportée au contraste, dans la pire des
     quatre directions, au centre de l'image réduite à 1024 px. Indépendante du contraste et
     de la scène ; la pire direction attrape le bougé. La variance du laplacien, essayée
     d'abord, confondait le bruit du capteur avec de la netteté sur les photos très floues.
2. **Résolution** : la vignette de 400 px cache un léger bougé qui rend une plaque illisible ;
   l'analyse se fait donc sur une version de 1024 px, décodée et réduite en natif
   (react-native-nitro-image), en parallèle de l'empreinte et de la vignette.
3. **Interface** : la photo est toujours enregistrée d'abord. L'alerte (« Photo floue,
   reprenez ») s'affiche dès le verdict, avec « Reprendre » et « Garder ». « Reprendre » retire
   la photo logiquement (`deleted_at`) : le fichier et sa fiche restent, la preuve redevient à
   prendre. Le verdict et le choix sont gardés dans `photos.local_check`.
4. **Calibrage** : seuils fixés sur un jeu généré (scènes de chantier simplifiées et leurs
   défauts), avec une marge vérifiée par test. À recalibrer sur de vraies photos de chantier :
   les déposer dans `packages/shared/fixtures/photo-quality` (voir son README).

## Limites connues

- Les 300 ms ne sont pas encore mesurées sur un téléphone : 17 ms pour l'analyse sous Node,
  mais Hermes est plus lent et le décodage de la photo de 12 Mpx s'y ajoute. Les durées sont
  journalisées (`[photo] contrôle local`) ; si le budget est dépassé, analyser la vignette
  pour la luminosité et un recadrage central plus petit pour la netteté.
- Un jeu généré ne remplace pas de vraies photos (reflets, textures, capteurs réels).
