# Chantier d'exemple de référence

Cas réaliste qui sert de base commune au développement, aux démonstrations et aux tests à la
main. Quand une fonction a besoin d'un exemple (écran, rapport, export, IA), partir de lui.

## Le cas

M. et Mme Guérin habitent un pavillon de 1975 à Rezé, chauffé au fioul, aux combles perdus peu
isolés. L'entreprise remplace la chaudière fioul par une pompe à chaleur air/eau et isole les
combles par soufflage, en trois jours.

La visite technique a donné les réponses aux questions rapides (section 7). Le poseur peut les
changer sur place : les preuves suivent (masquées, jamais supprimées).

| Opération | Modèle | Réponses | Preuves |
|---|---|---|---|
| BAR-TH-171, pompe à chaleur air/eau | `PAC_AIR_EAU` 1.0.0 | chaudière déposée : oui ; unités intérieures : 1 | 11, dont la fiche de mise en service (facultative) |
| BAR-EN-101, isolation des combles perdus | `COMBLES_PERDUS` 1.0.0 | zones : 2 (maison et extension) ; trappe dans le logement : oui | 11, dont combles avant, après et épaisseur par zone |

Soit 22 preuves, dont 21 obligatoires, toutes « manquantes » au départ. Elles sont celles de
`planSlots(modèle, réponses)` (`packages/shared/src/checklists`), ce que vérifie
`packages/templates/src/sql.test.ts`.

## Où il se trouve

Mêmes identifiants partout ; seuls l'entreprise, les personnes et les dates changent.

| | Projet hébergé (`preuvio`) | Local (`supabase db reset`) |
|---|---|---|
| Entreprise | Proofeo | Thermi Rénov (démo) |
| Référence | CH-2026-001 | CH-2026-003 (001 et 002 sont pris par les chantiers de démo) |
| Dates prévues | 9 au 11 novembre 2026 | du jour à J+2 |
| Créé par | Tarik (dirigeant) | Claire Dirigeante |
| Poseur affecté | Tarik | Jean Poseur (06 39 98 00 03, code 123456) |
| Statut | planifié | planifié |

Commun aux deux :

| Élément | Valeur |
|---|---|
| Chantier | `7b382223-6e79-4bb9-9341-e2c164a215ed` |
| Client | `4308a777-bc85-4560-8858-2ad021c284ee`, M. et Mme Guérin, +33 6 39 98 01 10, guerin.demo@example.com |
| Adresse | 14 Rue des Ajoncs 44400 Rezé (BAN `44143_0050_00014`, 47.161961, -1.540204), rayon de 150 m |
| Devis | DEV-2026-0147 |
| Opération PAC | `bd6b702e-e194-4ce9-ad3b-95a03005de21` |
| Opération combles | `7c37abef-c22b-4467-95e8-7d5cb9aad697` |

Le client est fictif : numéro de la plage réservée à la fiction par l'ARCEP, e-mail en
`example.com`. L'adresse est une vraie adresse de la BAN, pour le géocodage, la carte et le
géorepérage : une photo prise ailleurs reçoit le badge « hors chantier », sans blocage.

## Volontairement absent

- **Délégataire CEE** : aucun en base. Ses règles de nommage et ses pièces exigées viendront
  d'un vrai délégataire, pas d'une invention.
- **Photos** : prises avec l'appli. Une photo n'est jamais supprimée : pas de photo factice.
- **SIRET, adresse et qualifications RGE de l'entreprise** : à saisir par le dirigeant.

## Si un modèle change

Un chantier garde la version du modèle de sa création (section 5) : celui-ci reste en 1.0.0.
Si une nouvelle version d'un modèle global est publiée, le test de `packages/templates` échoue :
décider alors s'il reste en 1.0.0 (adapter le test) ou s'il passe à la nouvelle version (seed,
projet hébergé et cette fiche).
