'use client';

import type { JobsiteState } from '@preuvio/shared';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

export type Pin = { id: string; label: string; lat: number; lng: number; state: JobsiteState };

// Fond IGN Plan (Géoplateforme, service public, sans clé).
const IGN_PLAN =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2' +
  '&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

const TOKEN: Record<JobsiteState, string> = {
  complete: '--pv-ok',
  to_complete: '--pv-text-muted',
  at_risk: '--pv-ko',
};

/** Carte des chantiers du jour, une épingle colorée par état (et son état en clair au survol). */
export function JobsiteMap({ pins }: { pins: Pin[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || pins.length === 0) return;
    let map: import('maplibre-gl').Map | null = null;
    let cancelled = false;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !container.current) return;
      map = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            ign: { type: 'raster', tiles: [IGN_PLAN], tileSize: 256, attribution: '© IGN' },
          },
          layers: [{ id: 'ign', type: 'raster', source: 'ign' }],
        },
        center: [pins[0]!.lng, pins[0]!.lat],
        zoom: 9,
      });
      const css = getComputedStyle(document.documentElement);
      const bounds = new maplibregl.LngLatBounds();
      for (const p of pins) {
        const word =
          p.state === 'complete' ? 'Complet' : p.state === 'at_risk' ? 'À risque' : 'À compléter';
        new maplibregl.Marker({ color: css.getPropertyValue(TOKEN[p.state]).trim() || undefined })
          .setLngLat([p.lng, p.lat])
          .setPopup(
            new maplibregl.Popup().setHTML(
              `<a href="/chantiers/${p.id}">${escapeHtml(p.label)}</a><br>${word}`,
            ),
          )
          .addTo(map);
        bounds.extend([p.lng, p.lat]);
      }
      if (pins.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 13 });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [pins]);
  if (pins.length === 0)
    return <p className="text-text-muted">Aucun chantier localisé aujourd’hui.</p>;
  return (
    <div
      ref={container}
      role="region"
      aria-label="Carte des chantiers du jour"
      className="h-80 w-full overflow-hidden rounded-xl border border-border"
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
