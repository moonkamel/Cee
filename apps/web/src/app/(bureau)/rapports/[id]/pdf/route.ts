// PDF d'une version de rapport (section 9). Composé à la première demande avec le gabarit fixe,
// rangé dans le stockage privé avec son empreinte, puis toujours resservi à l'identique :
// le QR code renvoie vers la page qui compare cette empreinte.
import { type DocumentProps, renderToBuffer } from '@react-pdf/renderer';
import { parseContent, permissions, reportFileName, sha256Hex } from '@preuvio/shared';
import QRCode from 'qrcode';
import { createElement, type ReactElement } from 'react';
import { currentUser } from '@/lib/dal';
import { buildPdfData } from '@/lib/pdf/build';
import { ReportDocument } from '@/lib/pdf/ReportDocument';
import { downloadImages, loadReport, loadReportSources } from '@/lib/reports';
import { supabaseServer } from '@/lib/supabase/server';

export const maxDuration = 60;

function pdfResponse(bytes: Uint8Array, name: string) {
  return new Response(bytes as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function GET(request: Request, ctx: RouteContext<'/rapports/[id]/pdf'>) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!permissions(user.role).decide) return new Response('Accès réservé', { status: 403 });
  const loaded = await loadReport(id);
  if (!loaded) return new Response('Rapport introuvable', { status: 404 });
  const { report } = loaded;
  const jobsite = report.jobsites;
  const name = reportFileName(jobsite.reference, report.kind, report.version);
  const supabase = await supabaseServer();

  const stored = async (path: string) => {
    const { data } = await supabase.storage.from('documents').download(path);
    return data ? pdfResponse(new Uint8Array(await data.arrayBuffer()), name) : null;
  };
  if (report.pdf_path) {
    return (await stored(report.pdf_path)) ?? new Response('PDF indisponible', { status: 502 });
  }

  const content = parseContent(report.content, report.kind);
  const { photos, notes } = await loadReportSources(content.photo_ids, content.note_ids);
  const [images, logos] = await Promise.all([
    downloadImages(
      'photos',
      photos.map((p) => ({ id: p.id, path: p.thumbnail_path ?? p.original_path })),
    ),
    jobsite.companies.logo_path
      ? downloadImages('documents', [{ id: 'logo', path: jobsite.companies.logo_path }])
      : Promise.resolve(new Map()),
  ]);
  const verifyUrl = `${new URL(request.url).origin}/verifier/${report.id}`;
  const data = buildPdfData({
    report,
    jobsite,
    company: jobsite.companies,
    photos,
    notes,
    images,
    logo: logos.get('logo') ?? null,
    verifyUrl,
    qrDataUrl: await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240 }),
    issuedAt: new Date().toISOString(),
    signature: (
      await supabase
        .from('signatures')
        .select('signed_at, signer_name, has_reserves, reserves')
        .eq('jobsite_id', report.jobsite_id)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data,
  });
  const pdf = new Uint8Array(
    await renderToBuffer(
      // ReportDocument rend un <Document> : c'est bien l'élément attendu par react-pdf.
      createElement(ReportDocument, { data }) as unknown as ReactElement<DocumentProps>,
    ),
  );

  // Rangé une seule fois : si une autre demande l'a déjà fait, on sert celui-là.
  const path = `${report.company_id}/reports/${report.id}.pdf`;
  const upload = await supabase.storage
    .from('documents')
    .upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (upload.error)
    return (await stored(path)) ?? new Response('PDF non enregistré', { status: 502 });
  const { error } = await supabase
    .from('reports')
    .update({ pdf_path: path, pdf_sha256: await sha256Hex(pdf) })
    .eq('id', report.id)
    .is('pdf_path', null);
  if (error) return new Response('PDF non enregistré', { status: 502 });
  return pdfResponse(pdf, name);
}
