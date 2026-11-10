# Parcours du poseur (Maestro)

Parcours de bout en bout de la section 17, sur un téléphone Android (de préférence le téléphone
de référence) avec un build de développement branché sur le **Supabase local**
(`.env.local`, données de `supabase/seed.sql` : Jean Poseur, 06 39 98 00 03, code 123456).

```bash
maestro test .maestro/poseur-en-ligne.yaml
```

```bash
maestro test .maestro/poseur-hors-ligne.yaml
```

Le parcours hors ligne coupe le réseau (mode avion), prend les photos, puis rétablit le
réseau et vérifie que plus aucune photo n'attend. Le mode avion n'est piloté que sur Android.
