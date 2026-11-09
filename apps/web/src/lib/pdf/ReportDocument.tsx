/* eslint-disable jsx-a11y/alt-text -- Image de react-pdf : élément PDF, pas un <img> HTML. */
// Gabarit fixe du rapport PDF (section 9) : jamais de mise en page laissée à l'IA.
// En-tête (logo, RGE), bloc chantier, texte relu, grille de photos 2 × 3, annexe des
// métadonnées et empreintes, QR code de vérification de l'intégrité du document.
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { chunk, type Equipment, formatParis } from '@preuvio/shared';
import { palette, spacing } from '@preuvio/ui-tokens';
import { ATKINSON_400, ATKINSON_700 } from './fonts';

Font.register({
  family: 'Atkinson',
  fonts: [
    { src: ATKINSON_400, fontWeight: 400 },
    { src: ATKINSON_700, fontWeight: 700 },
  ],
});
// Pas de césure automatique : un mot coupé gêne la lecture.
Font.registerHyphenationCallback((word) => [word]);

export type PdfImage = { data: Buffer; format: 'jpg' | 'png' };

export type PdfPhoto = {
  n: number;
  label: string;
  takenAt: string;
  receivedAt: string | null;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  sha256: string;
  outsideGeofence: boolean;
  image: PdfImage | null;
};

export type PdfNote = { n: number; recordedAt: string; text: string };

export type PdfSentence = { text: string; photos: number[]; notes: number[] };

/** Ligne de la liste des preuves (synthèse d'un dossier d'export). */
export type PdfProof = { label: string; status: string; ok: boolean; photos: number[] };

export type ReportPdfData = {
  title: string;
  version: number;
  period: string | null;
  issuedAt: string;
  company: {
    name: string;
    siret: string | null;
    address: string | null;
    rge: string[];
    color: string;
    logo: PdfImage | null;
  };
  jobsite: {
    reference: string | null;
    client: string | null;
    address: string;
    dates: string;
    operations: string[];
    quote: string | null;
  };
  sections: { title: string; sentences: PdfSentence[] }[];
  equipment: Equipment[];
  /** Null : rubrique sans objet pour ce type de rapport. */
  missing: string[] | null;
  /** Mention du PV de réception (fin de chantier). */
  pv: string | null;
  /** Liste des preuves avec renvoi aux vignettes (synthèse d'export) ; absente d'un rapport. */
  proofs?: PdfProof[];
  photos: PdfPhoto[];
  notes: PdfNote[];
  verifyUrl: string;
  qrDataUrl: string;
};

const ink = palette('light');

const s = StyleSheet.create({
  page: {
    fontFamily: 'Atkinson',
    fontSize: 10,
    color: ink.text,
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
  },
  logo: { width: 64, height: 40, objectFit: 'contain' },
  company: { fontSize: 14, fontWeight: 700 },
  muted: { color: ink['text-muted'] },
  title: { fontSize: 20, fontWeight: 700, marginTop: spacing.lg },
  block: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: ink.border,
    borderRadius: 4,
    gap: 2,
  },
  h2: { fontSize: 13, fontWeight: 700, marginTop: spacing.lg, marginBottom: spacing.xs },
  sentence: { marginBottom: 3 },
  refs: { color: ink['text-muted'], fontSize: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cell: { width: '48.5%', height: 228, marginBottom: spacing.sm },
  photo: { width: '100%', height: 168, objectFit: 'cover', backgroundColor: ink.border },
  noPhoto: {
    width: '100%',
    height: 168,
    backgroundColor: ink.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { fontSize: 9, marginTop: 3 },
  meta: { fontSize: 8, color: ink['text-muted'] },
  warn: { fontSize: 8, color: ink.warn, fontWeight: 700 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: ink.border,
    paddingVertical: 2,
  },
  mono: { fontFamily: 'Courier', fontSize: 7 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: ink['text-muted'],
  },
  verify: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  qr: { width: 72, height: 72 },
  // Largeur utile moins le QR code : un texte « flex » déborde de la marge dans react-pdf.
  verifyText: { width: 420 },
});

function refsText(sentence: PdfSentence): string {
  const parts = [
    sentence.photos.length
      ? `photo${sentence.photos.length > 1 ? 's' : ''} ${sentence.photos.join(', ')}`
      : '',
    sentence.notes.length
      ? `note${sentence.notes.length > 1 ? 's' : ''} ${sentence.notes.join(', ')}`
      : '',
  ].filter(Boolean);
  return parts.length ? ` (${parts.join(' · ')})` : ' (ajout du bureau)';
}

function position(p: PdfPhoto): string {
  if (p.lat === null || p.lng === null) return 'Position inconnue';
  const acc = p.accuracyM !== null ? ` (± ${Math.round(p.accuracyM)} m)` : '';
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}${acc}`;
}

function Footer({ data }: { data: ReportPdfData }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {data.company.name} · {data.title} v{data.version} · {data.jobsite.reference ?? ''}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function ReportDocument({ data }: { data: ReportPdfData }) {
  const pages = chunk(data.photos);
  return (
    <Document title={`${data.title} ${data.jobsite.reference ?? ''}`} author={data.company.name}>
      <Page size="A4" style={s.page}>
        <View style={[s.header, { borderBottomColor: data.company.color }]}>
          {data.company.logo ? <Image style={s.logo} src={data.company.logo} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={[s.company, { color: data.company.color }]}>{data.company.name}</Text>
            <Text style={s.muted}>
              {[data.company.siret ? `SIRET ${data.company.siret}` : null, data.company.address]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {data.company.rge.length ? (
              <Text style={s.muted}>RGE : {data.company.rge.join(' · ')}</Text>
            ) : null}
          </View>
        </View>

        <Text style={s.title}>{data.title}</Text>
        <Text style={s.muted}>
          Version {data.version} · émis le {formatParis(data.issuedAt)}
          {data.period ? ` · journée du ${formatParis(`${data.period}T12:00:00Z`, false)}` : ''}
        </Text>

        <View style={s.block}>
          <Text style={{ fontWeight: 700 }}>
            Chantier {data.jobsite.reference ?? ''}
            {data.jobsite.client ? ` · ${data.jobsite.client}` : ''}
          </Text>
          <Text>{data.jobsite.address}</Text>
          <Text>Dates prévues : {data.jobsite.dates}</Text>
          {data.jobsite.operations.map((o) => (
            <Text key={o}>Opération : {o}</Text>
          ))}
          {data.jobsite.quote ? <Text>Devis : {data.jobsite.quote}</Text> : null}
        </View>

        {data.sections.map((section) => (
          <View key={section.title} wrap={false}>
            <Text style={s.h2}>{section.title}</Text>
            {section.sentences.length === 0 ? <Text style={s.muted}>Rien à signaler.</Text> : null}
            {section.sentences.map((sentence, i) => (
              <Text key={i} style={s.sentence}>
                {sentence.text}
                <Text style={s.refs}>{refsText(sentence)}</Text>
              </Text>
            ))}
          </View>
        ))}

        {data.equipment.length ? (
          <View wrap={false}>
            <Text style={s.h2}>Équipements posés (lus sur les plaques)</Text>
            {data.equipment.map((e, i) => (
              <Text key={i}>
                {e.label} : {[e.brand, e.model].filter(Boolean).join(' ')}
                {e.serialNumber ? ` · n° de série ${e.serialNumber}` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        {data.proofs ? (
          <View>
            <Text style={s.h2}>Preuves</Text>
            {data.proofs.map((p, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={{ flex: 1 }}>{p.label}</Text>
                <Text style={{ width: 110, color: p.ok ? ink.ok : ink.ko }}>{p.status}</Text>
                <Text style={[s.refs, { width: 80 }]}>
                  {p.photos.length
                    ? `photo${p.photos.length > 1 ? 's' : ''} ${p.photos.join(', ')}`
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.missing ? (
          <View wrap={false}>
            <Text style={s.h2}>Preuves obligatoires manquantes</Text>
            {data.missing.length === 0 ? (
              <Text style={{ color: ink.ok }}>Toutes les preuves obligatoires sont prises.</Text>
            ) : (
              data.missing.map((m) => (
                <Text key={m} style={{ color: ink.ko }}>
                  • {m}
                </Text>
              ))
            )}
          </View>
        ) : null}

        {data.pv ? (
          <View wrap={false}>
            <Text style={s.h2}>PV de réception</Text>
            <Text>{data.pv}</Text>
          </View>
        ) : null}

        {data.qrDataUrl ? (
          <View style={s.verify} wrap={false}>
            <Image style={s.qr} src={data.qrDataUrl} />
            <View style={s.verifyText}>
              <Text style={{ fontWeight: 700 }}>Vérifier ce document</Text>
              <Text style={s.muted}>
                Scannez le code ou ouvrez {data.verifyUrl} : la page indique l’empreinte du document
                d’origine et permet de comparer ce fichier.
              </Text>
            </View>
          </View>
        ) : null}
        <Footer data={data} />
      </Page>

      {pages.map((page, i) => (
        <Page key={`photos-${i}`} size="A4" style={s.page}>
          <Text style={[s.h2, { marginTop: 0 }]}>
            Photos {page[0]!.n} à {page[page.length - 1]!.n}
          </Text>
          <View style={s.grid}>
            {page.map((p) => (
              <View key={p.n} style={s.cell}>
                {p.image ? (
                  <Image style={s.photo} src={p.image} />
                ) : (
                  <View style={s.noPhoto}>
                    <Text style={s.muted}>Image non disponible</Text>
                  </View>
                )}
                <Text style={s.caption}>
                  <Text style={{ fontWeight: 700 }}>{p.n}. </Text>
                  {p.label}
                </Text>
                <Text style={s.meta}>
                  {formatParis(p.takenAt)} · {position(p)}
                </Text>
                {p.outsideGeofence ? <Text style={s.warn}>Prise hors du chantier</Text> : null}
              </View>
            ))}
          </View>
          <Footer data={data} />
        </Page>
      ))}

      <Page size="A4" style={s.page}>
        <Text style={[s.h2, { marginTop: 0 }]}>Annexe : métadonnées et empreintes</Text>
        <Text style={[s.muted, { marginBottom: spacing.sm }]}>
          Heure de l’appareil et heure de réception par le serveur ; empreinte SHA-256 de la photo
          d’origine, calculée sur le téléphone à la prise de vue et vérifiée à la réception.
        </Text>
        {data.photos.length === 0 ? <Text style={s.muted}>Aucune photo.</Text> : null}
        {data.photos.map((p) => (
          <View key={p.n} style={s.row} wrap={false}>
            <Text style={{ width: 22, fontWeight: 700 }}>{p.n}</Text>
            <View style={{ flex: 1 }}>
              <Text>
                Prise {formatParis(p.takenAt)}
                {p.receivedAt ? ` · reçue ${formatParis(p.receivedAt)}` : ''} · {position(p)}
              </Text>
              <Text style={s.mono}>{p.sha256}</Text>
            </View>
          </View>
        ))}
        {data.notes.length ? (
          <>
            <Text style={s.h2}>Notes vocales</Text>
            {data.notes.map((n) => (
              <View key={n.n} style={s.row} wrap={false}>
                <Text style={{ width: 22, fontWeight: 700 }}>{n.n}</Text>
                <Text style={{ flex: 1 }}>
                  {formatParis(n.recordedAt)} · « {n.text} »
                </Text>
              </View>
            ))}
          </>
        ) : null}
        <Footer data={data} />
      </Page>
    </Document>
  );
}
