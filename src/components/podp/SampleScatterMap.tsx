// Build trigger: re-run after sandbox acquisition timeout.
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export interface SamplePoint {
  id: string;
  geo_lat: number;
  geo_lon: number;
  is_within_radius: boolean;
  distance_from_address_m: number | null;
  captured_at: string;
  rejection_reason: string | null;
}

interface Props {
  address: { lat: number; lon: number } | null;
  samples: SamplePoint[];
  toleranceUrbanM?: number;
  toleranceRuralM?: number;
  height?: number;
}

/**
 * Internal-only PoDP map. Plots the registered address anchor plus all
 * GPS samples returned by podp-admin, with tolerance circles to visualise
 * the dispersion radius. Not exposed to address holders.
 */
export default function SampleScatterMap({
  address,
  samples,
  toleranceUrbanM = 75,
  toleranceRuralM = 250,
  height = 360,
}: Props) {
  const { t } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const boundsRef = useRef<mapboxgl.LngLatBounds | null>(null);
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) setToken(data.token);
      } catch (e: any) {
        setError(e?.message || t('scattermap_error_token'));
      }
    })();
  }, []);

  // Init map
  useEffect(() => {
    if (!container.current || !token || map.current) return;
    try {
      mapboxgl.accessToken = token;
      const center: [number, number] = address
        ? [address.lon, address.lat]
        : samples[0]
        ? [samples[0].geo_lon, samples[0].geo_lat]
        : [13.2344, -8.8383];

      map.current = new mapboxgl.Map({
        container: container.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom: 16,
        failIfMajorPerformanceCaveat: false,
        preserveDrawingBuffer: true, // required for canvas export
      });
      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: false, showCompass: true, showZoom: true }),
        'top-right',
      );
      map.current.addControl(
        new mapboxgl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
        'bottom-right',
      );
      map.current.on('error', (e) => console.error('Mapbox error', e));
    } catch (e: any) {
      setError(e?.message || t('scattermap_error_init'));
    }

    return () => {
      try { map.current?.remove(); } catch { /* noop */ }
      map.current = null;
    };
  }, [token]);

  // Render markers, anchor + tolerance circles
  useEffect(() => {
    const m = map.current;
    if (!m || !token) return;

    const render = () => {
      // Clear previous markers
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];

      // Clear previous layers/sources
      ['podp-tol-urban-fill', 'podp-tol-urban-line', 'podp-tol-rural-line'].forEach((id) => {
        if (m.getLayer(id)) m.removeLayer(id);
      });
      ['podp-tol-urban', 'podp-tol-rural'].forEach((id) => {
        if (m.getSource(id)) m.removeSource(id);
      });

      // Address anchor + tolerance rings
      if (address) {
        const anchorEl = document.createElement('div');
        anchorEl.style.cssText =
          'width:18px;height:18px;border-radius:50%;background:hsl(220 90% 55%);border:3px solid #fff;box-shadow:0 0 0 2px hsl(220 90% 55% / .4);';
        const anchorMarker = new mapboxgl.Marker({ element: anchorEl })
          .setLngLat([address.lon, address.lat])
          .setPopup(new mapboxgl.Popup({ offset: 14 }).setHTML(`<strong>${t('scattermap_registered_address')}</strong>`))
          .addTo(m);
        markersRef.current.push(anchorMarker);

        const ring = (radiusM: number, points = 64) => {
          const coords: [number, number][] = [];
          const earth = 6378137;
          const dLat = (radiusM / earth) * (180 / Math.PI);
          const dLon = dLat / Math.cos((address.lat * Math.PI) / 180);
          for (let i = 0; i <= points; i++) {
            const t = (i / points) * 2 * Math.PI;
            coords.push([address.lon + dLon * Math.cos(t), address.lat + dLat * Math.sin(t)]);
          }
          return {
            type: 'Feature' as const,
            geometry: { type: 'Polygon' as const, coordinates: [coords] },
            properties: {},
          };
        };

        m.addSource('podp-tol-urban', { type: 'geojson', data: ring(toleranceUrbanM) });
        m.addLayer({
          id: 'podp-tol-urban-fill', type: 'fill', source: 'podp-tol-urban',
          paint: { 'fill-color': 'hsl(142 71% 45%)', 'fill-opacity': 0.08 },
        });
        m.addLayer({
          id: 'podp-tol-urban-line', type: 'line', source: 'podp-tol-urban',
          paint: { 'line-color': 'hsl(142 71% 45%)', 'line-width': 1.2, 'line-dasharray': [2, 2] },
        });

        m.addSource('podp-tol-rural', { type: 'geojson', data: ring(toleranceRuralM) });
        m.addLayer({
          id: 'podp-tol-rural-line', type: 'line', source: 'podp-tol-rural',
          paint: { 'line-color': 'hsl(38 92% 50%)', 'line-width': 1, 'line-dasharray': [4, 4] },
        });
      }

      // Sample markers
      const bounds = new mapboxgl.LngLatBounds();
      if (address) bounds.extend([address.lon, address.lat]);

      samples.forEach((s) => {
        const el = document.createElement('div');
        const color = s.is_within_radius ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)';
        el.style.cssText = `width:8px;height:8px;border-radius:50%;background:${color};border:1.5px solid #fff;opacity:.85;`;
        const popup = new mapboxgl.Popup({ offset: 8 }).setHTML(
          `<div style="font-size:12px;line-height:1.4">
            <div><strong>${new Date(s.captured_at).toLocaleString()}</strong></div>
            <div>${t('scattermap_distance')}: ${s.distance_from_address_m != null ? Math.round(Number(s.distance_from_address_m)) + ' m' : '—'}</div>
            <div>${s.is_within_radius ? '✅ ' + t('scattermap_within_radius') : '❌ ' + t('scattermap_outside_radius')}</div>
            ${s.rejection_reason ? `<div>${t('scattermap_reason')}: <code>${s.rejection_reason}</code></div>` : ''}
          </div>`
        );
        const mk = new mapboxgl.Marker({ element: el })
          .setLngLat([s.geo_lon, s.geo_lat])
          .setPopup(popup)
          .addTo(m);
        markersRef.current.push(mk);
        bounds.extend([s.geo_lon, s.geo_lat]);
      });

      if (!bounds.isEmpty()) {
        boundsRef.current = bounds;
        try {
          m.fitBounds(bounds, { padding: 40, maxZoom: 18, duration: 400 });
        } catch { /* noop */ }
      }
    };

    if (m.isStyleLoaded()) render();
    else m.once('load', render);
  }, [address, samples, token, toleranceUrbanM, toleranceRuralM]);

  if (error) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-md border bg-muted text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (!token) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
        {t('scattermap_loading')}
      </div>
    );
  }

  const zoomIn = () => map.current?.zoomIn({ duration: 200 });
  const zoomOut = () => map.current?.zoomOut({ duration: 200 });
  const resetView = () => {
    const m = map.current;
    if (!m) return;
    if (boundsRef.current && !boundsRef.current.isEmpty()) {
      try { m.fitBounds(boundsRef.current, { padding: 40, maxZoom: 18, duration: 400 }); } catch { /* noop */ }
    } else if (address) {
      m.flyTo({ center: [address.lon, address.lat], zoom: 16, duration: 400 });
    }
  };

  const legendRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  /** Renders map canvas + legend overlay onto a single canvas for export. */
  const composeExportCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const m = map.current;
    if (!m) return null;
    // Force a synchronous repaint so preserveDrawingBuffer has fresh pixels.
    m.triggerRepaint();
    await new Promise<void>((resolve) => m.once('render', () => resolve()));
    const mapCanvas = m.getCanvas();

    const out = document.createElement('canvas');
    out.width = mapCanvas.width;
    out.height = mapCanvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(mapCanvas, 0, 0);

    // Overlay legend (if present)
    if (legendRef.current) {
      try {
        const legendCanvas = await html2canvas(legendRef.current, {
          backgroundColor: null,
          scale: window.devicePixelRatio || 2,
          logging: false,
          useCORS: true,
        });
        const margin = 16;
        ctx.drawImage(
          legendCanvas,
          margin,
          out.height - legendCanvas.height - margin,
        );
      } catch (e) {
        console.warn('Falha ao desenhar legenda no export', e);
      }
    }

    // Footer with timestamp for auditability
    const stamp = `AFROLOC · PoDP · ${new Date().toLocaleString()}`;
    ctx.font = `${Math.max(12, Math.round(out.width / 110))}px system-ui, sans-serif`;
    const tw = ctx.measureText(stamp).width;
    const pad = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(out.width - tw - pad * 3, out.height - 28, tw + pad * 2, 22);
    ctx.fillStyle = '#111';
    ctx.fillText(stamp, out.width - tw - pad * 2, out.height - 12);

    return out;
  };

  const exportPng = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const c = await composeExportCanvas();
      if (!c) throw new Error(t('scattermap_error_map_unavailable'));
      const blob: Blob = await new Promise((res, rej) =>
        c.toBlob((b) => (b ? res(b) : rej(new Error(t('scattermap_error_toblob')))), 'image/png'),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `podp-mapa-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: t('scattermap_toast_png_ok_title'), description: t('scattermap_toast_png_ok_desc') });
    } catch (e: any) {
      toast({ title: t('scattermap_toast_png_err_title'), description: e?.message ?? '—', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const c = await composeExportCanvas();
      if (!c) throw new Error(t('scattermap_error_map_unavailable'));
      const dataUrl = c.toDataURL('image/png');
      const orientation: 'l' | 'p' = c.width >= c.height ? 'l' : 'p';
      const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      pdf.setFontSize(12);
      pdf.text(`AFROLOC · PoDP · ${t('scattermap_pdf_title')}`, margin, margin);
      pdf.setFontSize(9);
      pdf.text(`${t('scattermap_generated_at')} ${new Date().toLocaleString()}`, margin, margin + 14);
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2 - 30;
      const ratio = Math.min(availW / c.width, availH / c.height);
      const w = c.width * ratio;
      const h = c.height * ratio;
      pdf.addImage(dataUrl, 'PNG', margin + (availW - w) / 2, margin + 24, w, h);
      pdf.save(`podp-mapa-${Date.now()}.pdf`);
      toast({ title: t('scattermap_toast_pdf_ok_title'), description: t('scattermap_toast_pdf_ok_desc') });
    } catch (e: any) {
      toast({ title: t('scattermap_toast_pdf_err_title'), description: e?.message ?? '—', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };


  return (
    <div className="relative overflow-hidden rounded-md border" style={{ height }}>
      <div ref={container} className="absolute inset-0" />
      <div className="absolute top-2 left-2 flex flex-col gap-1 rounded-md border bg-background/95 p-1 shadow-md backdrop-blur">
        <button
          type="button"
          onClick={zoomIn}
          aria-label={t('scattermap_zoom_in')}
          title={t('scattermap_zoom_in')}
          className="h-7 w-7 rounded text-sm font-bold text-foreground hover:bg-muted"
        >+</button>
        <button
          type="button"
          onClick={zoomOut}
          aria-label={t('scattermap_zoom_out')}
          title={t('scattermap_zoom_out')}
          className="h-7 w-7 rounded text-sm font-bold text-foreground hover:bg-muted"
        >−</button>
        <button
          type="button"
          onClick={resetView}
          aria-label={t('scattermap_reset_view')}
          title={t('scattermap_reset_view_title')}
          className="h-7 w-7 rounded text-[10px] font-semibold text-foreground hover:bg-muted"
        >⟳</button>
      </div>
      <div className="absolute top-2 right-12 flex gap-1 rounded-md border bg-background/95 p-1 shadow-md backdrop-blur">
        <button
          type="button"
          onClick={exportPng}
          disabled={exporting}
          aria-label={t('scattermap_export_png')}
          title={t('scattermap_export_png_title')}
          className="h-7 rounded px-2 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >{exporting ? '…' : 'PNG'}</button>
        <button
          type="button"
          onClick={exportPdf}
          disabled={exporting}
          aria-label={t('scattermap_export_pdf')}
          title={t('scattermap_export_pdf_title')}
          className="h-7 rounded px-2 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >{exporting ? '…' : 'PDF'}</button>
      </div>
      <div ref={legendRef} className="pointer-events-none absolute bottom-2 left-2 max-w-[260px] rounded-md border bg-background/95 p-2 text-[11px] shadow-md backdrop-blur">
        <div className="mb-1 font-semibold text-foreground">{t('scattermap_legend')}</div>
        <div className="grid gap-1">
          <div className="flex items-start gap-2">
            <span className="mt-[3px] inline-block h-3 w-3 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_2px_hsl(220_90%_55%/.4)] bg-[hsl(220_90%_55%)]" />
            <span className="text-muted-foreground"><strong className="text-foreground">{t('scattermap_registered_address')}</strong> {t('scattermap_legend_address_desc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-[3px] inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white bg-[hsl(142_71%_45%)]" />
            <span className="text-muted-foreground"><strong className="text-foreground">{t('scattermap_legend_valid')}</strong> {t('scattermap_legend_valid_desc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-[3px] inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white bg-[hsl(0_84%_60%)]" />
            <span className="text-muted-foreground"><strong className="text-foreground">{t('scattermap_legend_rejected')}</strong> {t('scattermap_legend_rejected_desc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <svg width="14" height="10" className="mt-[3px] shrink-0" aria-hidden>
              <line x1="0" y1="5" x2="14" y2="5" stroke="hsl(142 71% 45%)" strokeWidth="1.5" strokeDasharray="2 2" />
            </svg>
            <span className="text-muted-foreground"><strong className="text-foreground">{t('scattermap_legend_tol_urban')}</strong> ({toleranceUrbanM} m) {t('scattermap_legend_tol_urban_desc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <svg width="14" height="10" className="mt-[3px] shrink-0" aria-hidden>
              <line x1="0" y1="5" x2="14" y2="5" stroke="hsl(38 92% 50%)" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>
            <span className="text-muted-foreground"><strong className="text-foreground">{t('scattermap_legend_tol_rural')}</strong> ({toleranceRuralM} m) {t('scattermap_legend_tol_rural_desc')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
