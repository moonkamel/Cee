// Modèle de fichier pour l'import des chantiers (section 11).
import { importTemplateCsv } from '@preuvio/shared';

export function GET() {
  return new Response(importTemplateCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modele-chantiers-preuvio.csv"',
    },
  });
}
