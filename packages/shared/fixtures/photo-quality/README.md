# Photos de calibrage du contrôle local (S9)

Déposez ici de vraies photos de chantier, en JPEG, réduites à environ 1024 px de côté.
Le nom commence par le verdict attendu :

- `ok-…` : photo correcte (nette, exposée correctement, même en pénombre lisible) ;
- `blurry-…` : floue ou bougée ;
- `dark-…` : trop sombre ;
- `overexposed-…` : surexposée ;
- `empty-…` : image vide (objectif masqué, photo de la poche).

`pnpm --filter @preuvio/shared test` vérifie chaque photo. Si un verdict est faux, ajustez
`QUALITY_THRESHOLDS` dans `src/quality/analyze.ts` jusqu'à ce que tout le jeu passe.
Aucune photo de client identifiable (visage, plaque d'immatriculation) dans ce dossier.
