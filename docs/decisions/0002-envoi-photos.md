# 0002 — Envoi des photos : envoi simple avec reprise par photo, plutôt que TUS

- **Date** : 9 novembre 2026 (session S7)
- **Statut** : adoptée (validée par le porteur du projet)
- **Spécification** : section 4 (« File locale + envoi reprenable (protocole TUS) vers Supabase
  Storage — aucune photo perdue en cas de coupure ») et section 6 (empreinte SHA-256).

## Décision

Chaque photo part en **un seul envoi** (`storage.upload`, sans écrasement) depuis une file locale.
Une coupure fait échouer l'envoi en cours, qui recommence en entier plus tard (attente croissante
de 5 s à 10 min). Le protocole TUS est gardé pour la vidéo (V2).

Après l'envoi, l'Edge Function `verify-photo` télécharge le fichier, recalcule son SHA-256 et le
compare à l'empreinte calculée sur le téléphone au déclenchement :

- même empreinte : la fiche passe `upload_status = 'verified'` (seule la clé serveur le peut :
  migration `photo_upload_guard`) et **alors seulement** l'original est supprimé du téléphone ;
- empreinte différente : le fichier abîmé est retiré du stockage et le téléphone le renvoie
  depuis son original intact ;
- une photo déjà vérifiée n'est jamais retéléchargée ni retirée.

Code : `packages/shared/src/upload` (file d'envoi, testée), `supabase/functions/verify-photo`,
`apps/mobile/src/data/upload-runner.ts` (réseau, batterie, fichiers).

## Raisons

1. **L'objectif de la spécification est tenu autrement** : « aucune photo perdue » vient de
   l'original gardé jusqu'au contrôle de l'empreinte, pas de la reprise au milieu d'un fichier.
2. **TUS n'apporte presque rien ici** : Supabase découpe les envois TUS en morceaux de 6 Mo ; une
   photo de 2 à 5 Mo tient en un seul morceau, donc une coupure fait de toute façon tout repartir.
3. **Moins de pièces** : pas de client TUS dans l'appli, pas de stockage de l'état de reprise.
4. **Contrôle plus fort** : l'empreinte serveur prouve que le fichier stocké est celui pris sur le
   chantier, ce qu'un envoi reprenable ne garantit pas à lui seul.

## Règles d'envoi

- Une photo part après sa fiche (la ligne `photos` doit être arrivée au serveur).
- La plus ancienne d'abord ; un seul passage à la fois.
- Pas d'envoi hors ligne, ni sous 15 % de batterie hors charge. Branchement : envoi immédiat.
- Réglage « Photos en Wi-Fi uniquement » dans « Moi », **désactivé par défaut**.
- L'état d'envoi (`_upload`, `_uploadAttempts`, `_uploadNextAt`) reste sur le téléphone : une
  appli tuée reprend là où elle en était.
- La vignette reste sur le téléphone pour l'affichage.
- Déconnexion avec des photos non envoyées : un second tap est demandé, avec l'avertissement.

## À revoir si

- Les photos dépassent régulièrement 6 Mo (HEIC désactivé, capteurs 200 Mpx) : passer à TUS.
- La vidéo arrive (V2) : TUS obligatoire.
