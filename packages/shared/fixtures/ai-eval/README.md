# Jeu d'évaluation du pré-contrôle IA (S10)

Photos de preuve **annotées par un humain**, pour mesurer les fausses alertes (bonne photo
signalée en orange) et les oublis (mauvaise photo laissée en vert), par contrôle et par modèle.

## Ajouter une photo

1. Déposez le JPEG ici, réduit à environ 1 500 px de côté (comme en production).
2. Ajoutez une entrée dans `manifest.json` :

```json
{
  "file": "pac-plaque-reflet.jpg",
  "template": "PAC_AIR_EAU",
  "instruction": "Plaque de l'unité extérieure",
  "checks": ["plate_readable"],
  "extract": ["brand", "model", "serial_number"],
  "expected": "plate_readable"
}
```

`expected` vaut `"ok"` si la photo prouve bien le point, sinon l'identifiant du contrôle en
défaut. `instruction` et `checks` sont ceux du modèle de checklist (`packages/templates`).

## Lancer

```bash
pnpm --filter @preuvio/shared eval:ai fixtures/ai-eval --fake   # à blanc, vérifie le manifest
ANTHROPIC_API_KEY=… pnpm --filter @preuvio/shared eval:ai fixtures/ai-eval
```

Chaque photo coûte un appel au modèle. Le détail est écrit dans `report.json` (non versionné).
Aucune photo de client identifiable (visage, plaque d'immatriculation) dans ce dossier.
Objectif de départ, à confirmer pendant le pilote : moins de 10 % de fausses alertes.
