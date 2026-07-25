'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Grid3X3, History, Layers, Link2, Loader2, MapPin, Target, TrendingUp } from 'lucide-react';
import { useLeads } from '@/hooks/use-leads';
import { Lead } from '@/lib/leads';
import { supabase } from '@/lib/supabase';

interface HeatmapViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

type LatLng = { lat: number; lng: number };
type MapInstance = {
  fitBounds: (bounds: BoundsInstance) => void;
  setCenter: (center: LatLng) => void;
  setZoom: (zoom: number) => void;
};
type BoundsInstance = {
  extend: (position: LatLng) => void;
};
type MarkerInstance = {
  setMap: (map: MapInstance | null) => void;
};
type MapsNamespace = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  LatLngBounds: new () => BoundsInstance;
  Marker: new (options: Record<string, unknown>) => MarkerInstance;
  SymbolPath: { CIRCLE: number };
  importLibrary?: (library: string) => Promise<unknown>;
};
type VisibilityPoint = {
  row: number;
  column: number;
  latitude: number;
  longitude: number;
  position: number | null;
  found: boolean;
  top_place_ids: string[];
};
type VisibilityScan = {
  id: string;
  lead_id: string;
  keyword: string;
  grid_size: number;
  radius_m: number;
  center_latitude: number;
  center_longitude: number;
  visibility_percentage: number;
  average_position: number | null;
  best_position: number | null;
  points: VisibilityPoint[];
  source: string;
  created_at: string;
};

declare global {
  interface Window {
    google?: { maps: MapsNamespace };
  }
}

let mapsPromise: Promise<MapsNamespace> | null = null;

function loadGoogleMaps(key: string) {
  const readyMaps = window.google?.maps;
  if (readyMaps && typeof readyMaps.Map === 'function' && typeof readyMaps.Marker === 'function') {
    return Promise.resolve(readyMaps);
  }
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    let settled = false;
    const previous = document.querySelector<HTMLScriptElement>('script[data-localway-google-maps]');
    const fail = () => {
      if (settled) return;
      settled = true;
      mapsPromise = null;
      reject(new Error('Falha ao carregar o Google Maps.'));
    };
    const finish = async () => {
      if (settled) return;
      try {
        const maps = window.google?.maps;
        if (!maps) throw new Error('Google Maps não carregou.');
        let mapLibrary: Partial<MapsNamespace> = {};
        let markerLibrary: Partial<MapsNamespace> = {};
        if (maps.importLibrary) {
          const libraries = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')]);
          mapLibrary = libraries[0] as Partial<MapsNamespace>;
          markerLibrary = libraries[1] as Partial<MapsNamespace>;
        }
        const completeMaps: MapsNamespace = {
          Map: mapLibrary.Map || maps.Map,
          LatLngBounds: mapLibrary.LatLngBounds || maps.LatLngBounds,
          Marker: markerLibrary.Marker || maps.Marker,
          SymbolPath: maps.SymbolPath,
          importLibrary: maps.importLibrary,
        };
        if (typeof completeMaps.Map !== 'function' || typeof completeMaps.Marker !== 'function') {
          throw new Error('A biblioteca do mapa não foi carregada por completo.');
        }
        settled = true;
        resolve(completeMaps);
      } catch (error) {
        settled = true;
        mapsPromise = null;
        reject(error);
      }
    };
    if (previous) {
      if (window.google?.maps) void finish();
      else {
        previous.addEventListener('load', () => void finish(), { once: true });
        previous.addEventListener('error', fail, { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&libraries=maps,marker&language=pt-BR&region=BR`;
    script.async = true;
    script.dataset.localwayGoogleMaps = 'true';
    script.addEventListener('load', () => void finish(), { once: true });
    script.addEventListener('error', fail, { once: true });
    document.head.appendChild(script);
  });
  return mapsPromise;
}

function colorForPosition(position: number | null) {
  if (position === null) return '#64748b';
  if (position <= 3) return '#10b981';
  if (position <= 10) return '#f59e0b';
  return '#e11d48';
}

function scanGridSize(scan: VisibilityScan) {
  const sizeFromPoints = Math.sqrt(scan.points.length);
  return Number.isInteger(sizeFromPoints) ? sizeFromPoints : scan.grid_size;
}

function GridMapCanvas({ scan, companyName, mapsKey, onError }: {
  scan: VisibilityScan;
  companyName: string;
  mapsKey: string;
  onError: (message: string) => void;
}) {
  const node = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!node.current || !mapsKey || !scan.points.length) return;
    let active = true;
    const markers: MarkerInstance[] = [];
    void loadGoogleMaps(mapsKey).then(maps => {
      if (!active || !node.current) return;
      const map = new maps.Map(node.current, {
        center: { lat: scan.center_latitude, lng: scan.center_longitude },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#f4f6f8' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#667085' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#d7dce2' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f7f8fa' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eef1f4' }] },
          { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -70 }, { lightness: 25 }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e4e7ec' }] },
          { featureType: 'transit', stylers: [{ saturation: -70 }, { lightness: 20 }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dcecf5' }] },
        ],
      });
      const bounds = new maps.LatLngBounds();
      scan.points.forEach(point => {
        const position = { lat: point.latitude, lng: point.longitude };
        bounds.extend(position);
        const marker = new maps.Marker({
          map,
          position,
          title: point.position ? `Posição estimada: ${point.position}` : 'Posição estimada: 20+',
          label: {
            text: point.position ? String(point.position) : '20+',
            color: '#ffffff',
            fontSize: point.position ? '11px' : '9px',
            fontWeight: '800',
          },
          icon: {
            path: maps.SymbolPath.CIRCLE,
            fillColor: colorForPosition(point.position),
            fillOpacity: 0.95,
            strokeColor: '#ffffff',
            strokeOpacity: 1,
            strokeWeight: 2,
            scale: 18,
          },
        });
        markers.push(marker);
      });
      const companyMarker = new maps.Marker({
        map,
        position: { lat: scan.center_latitude, lng: scan.center_longitude },
        title: companyName,
        zIndex: 100,
      });
      markers.push(companyMarker);
      map.fitBounds(bounds);
    }).catch(error => {
      if (active) onError(error instanceof Error ? error.message : 'Erro ao abrir a grade.');
    });
    return () => {
      active = false;
      markers.forEach(marker => marker.setMap(null));
    };
  }, [companyName, mapsKey, onError, scan]);

  return <div ref={node} className="w-full min-h-[590px] rounded-2xl bg-[#eef2f6]" />;
}

export function HeatmapView({ onShowToast }: HeatmapViewProps) {
  const { leads, loading, error, createLead } = useLeads();
  const [selectedId, setSelectedId] = useState('');
  const [mapsKey, setMapsKey] = useState(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '');
  const [gridSize, setGridSize] = useState(5);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [resolvingProfile, setResolvingProfile] = useState(false);
  const [generatingGrid, setGeneratingGrid] = useState(false);
  const [scanHistory, setScanHistory] = useState<VisibilityScan[]>([]);
  const [activeScan, setActiveScan] = useState<VisibilityScan | null>(null);

  useEffect(() => {
    let active = true;
    const loadConfiguration = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const [configurationResponse, scansRequest] = await Promise.all([
        fetch('/api/places', {
          headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
          cache: 'no-store',
        }),
        supabase
          .from('local_visibility_scans')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (configurationResponse.ok) {
        const configuration = await configurationResponse.json();
        if (active && configuration.mapsBrowserKey) setMapsKey(configuration.mapsBrowserKey);
      }
      if (active && !scansRequest.error) {
        const rows = (scansRequest.data || []) as VisibilityScan[];
        setScanHistory(rows);
        setActiveScan(rows[0] || null);
      }
    };
    void loadConfiguration();
    return () => { active = false; };
  }, []);

  const located = useMemo(
    () => leads.filter(lead => typeof lead.latitude === 'number' && typeof lead.longitude === 'number'),
    [leads],
  );
  const selected = located.find(lead => lead.id === selectedId) || null;
  const activeScanLead = activeScan ? leads.find(lead => lead.id === activeScan.lead_id) || null : null;

  const handleMapError = useCallback((message: string) => onShowToast(message, 'error'), [onShowToast]);
  const resolveGoogleProfile = async () => {
    if (!supabase || !googleMapsUrl.trim()) {
      return onShowToast('Cole o link do perfil da empresa no Google Maps.', 'error');
    }
    setResolvingProfile(true);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'resolve_map_profile',
          googleMapsUrl: googleMapsUrl.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível localizar esse perfil.');
      const place = result.place as Partial<Lead>;
      if (!place.google_place_id || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') {
        throw new Error('O Google não retornou a identificação e as coordenadas dessa empresa.');
      }

      const existing = leads.find(lead => lead.google_place_id === place.google_place_id);
      if (existing) {
        setSelectedId(existing.id);
      } else {
        const created = await createLead({
          company_name: place.company_name || 'Empresa do Google',
          category: place.category || null,
          address: place.address || null,
          city: place.city || null,
          decision_maker_name: null,
          receptionist_name: null,
          phone: place.phone || null,
          whatsapp: place.whatsapp || place.phone || null,
          email: null,
          notes: null,
          google_place_id: place.google_place_id,
          google_maps_url: place.google_maps_url || googleMapsUrl.trim(),
          website_url: place.website_url || null,
          rating: place.rating ?? null,
          review_count: place.review_count ?? null,
          photo_count: place.photo_count ?? null,
          has_website: place.has_website ?? null,
          health_score: place.health_score ?? null,
          opportunity: place.opportunity || null,
          latitude: place.latitude,
          longitude: place.longitude,
          analysis_data: place.analysis_data || {},
          analysed_at: place.analysed_at || new Date().toISOString(),
          source: 'manual',
          status: 'novo',
          next_action_at: null,
        });
        if (created.error || !created.data) throw new Error(created.error || 'Não foi possível salvar a empresa.');
        setSelectedId(created.data.id);
      }
      setActiveScan(null);
      onShowToast('Perfil carregado. O segmento foi identificado automaticamente.', 'success');
    } catch (requestError) {
      onShowToast(requestError instanceof Error ? requestError.message : 'Erro ao carregar o perfil.', 'error');
    } finally {
      setResolvingProfile(false);
    }
  };

  const runVisibilityGrid = async () => {
    if (!supabase || !selected) return;
    if (!selected.google_place_id || typeof selected.latitude !== 'number' || typeof selected.longitude !== 'number') {
      return onShowToast('Selecione uma empresa gerada pelo Google e com coordenadas válidas.', 'error');
    }
    const automaticKeyword = selected.category?.trim() || selected.company_name.trim();
    if (automaticKeyword.length < 2) return onShowToast('O Google não retornou um segmento válido para essa empresa.', 'error');
    setGeneratingGrid(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/places', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session?.access_token || ''}`,
      },
      body: JSON.stringify({
        action: 'grid',
        leadId: selected.id,
        placeId: selected.google_place_id,
        keyword: automaticKeyword,
        latitude: selected.latitude,
        longitude: selected.longitude,
        radiusMeters: 2000,
        gridSize,
      }),
    });
    const result = await response.json();
    setGeneratingGrid(false);
    if (!response.ok) return onShowToast(result.error || 'Não foi possível gerar a grade.', 'error');
    const scan = result.scan as VisibilityScan;
    setActiveScan(scan);
    setScanHistory(current => [scan, ...current.filter(item => item.id !== scan.id)].slice(0, 20));
    onShowToast(`Grade ${gridSize}×${gridSize} calculada e salva no histórico.`);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex items-center gap-3 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center"><MapPin className="w-6 h-6" /></div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>Mapa de calor de ranking local</h2>
          <p className="text-xs text-[#727687] mt-0.5">Cole o perfil do Google e veja a posição da empresa em cada ponto da região.</p>
        </div>
      </header>

      <section className="p-5 rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35 dark:border-[#2e366b] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#727687]" />
            <input
              type="url"
              value={googleMapsUrl}
              onChange={event => setGoogleMapsUrl(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void resolveGoogleProfile();
              }}
              placeholder="Cole o link curto ou completo do perfil no Google Maps"
              className="w-full pl-9 pr-3 py-3 rounded-xl bg-[#f8f9fc] dark:bg-[#10142e] border border-[#c2c6d8]/50 text-sm outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
            />
          </div>
          <button disabled={resolvingProfile || !googleMapsUrl.trim()} onClick={() => void resolveGoogleProfile()} className="px-5 py-3 rounded-xl border border-[#0066ff] text-[#0066ff] hover:bg-[#0066ff]/5 disabled:opacity-50 text-xs font-semibold flex justify-center items-center gap-2">
            {resolvingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            {resolvingProfile ? 'Identificando...' : 'Carregar perfil'}
          </button>
        </div>

        {selected && <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-[#f8f9fc] dark:bg-[#10142e] border border-[#c2c6d8]/30">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#727687]">Perfil identificado</p>
            <p className="text-sm font-semibold mt-1">{selected.company_name}</p>
            <p className="text-xs text-[#727687]">{selected.category || 'Categoria identificada pelo Google'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-2 rounded-xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35 text-xs font-medium">Raio fixo: 2 km</span>
            <select aria-label="Tamanho da grade" value={gridSize} onChange={event => setGridSize(Number(event.target.value))} className="px-3 py-2 rounded-xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/50 text-xs font-medium">
              {[3, 4, 5, 6, 7].map(size => <option key={size} value={size}>{size}×{size} ({size * size} pontos)</option>)}
            </select>
            <button disabled={generatingGrid} onClick={() => void runVisibilityGrid()} className="px-5 py-2 rounded-xl bg-[#0066ff] hover:bg-[#0050cb] disabled:opacity-50 text-white text-xs font-semibold flex justify-center items-center gap-2">
              {generatingGrid ? <Loader2 className="w-4 h-4 animate-spin"/> : <Grid3X3 className="w-4 h-4"/>}
              {generatingGrid ? `Consultando ${gridSize * gridSize} pontos…` : 'Gerar mapa de calor'}
            </button>
          </div>
        </div>}
      </section>

      <div className="flex flex-wrap gap-2 text-[10px] font-semibold items-center justify-end">
        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">1–3</span>
        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">4–10</span>
        <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">11–20</span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">20+</span>
      </div>

      <div className={`grid grid-cols-1 gap-5 ${activeScan ? 'lg:grid-cols-[280px_1fr]' : ''}`}>
        {activeScan && <aside className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Summary icon={<Target className="w-4 h-4" />} label="Presença" value={`${Math.round(activeScan.visibility_percentage)}%`} />
            <Summary icon={<TrendingUp className="w-4 h-4" />} label="Melhor posição" value={activeScan.best_position || '20+'} />
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35">
            <p className="text-[10px] text-[#727687] uppercase tracking-[0.12em] font-semibold">Posição média</p>
            <p className="text-3xl font-semibold tracking-tight mt-1">{activeScan.average_position?.toFixed(1) || '20+'}</p>
            <p className="text-[11px] text-[#727687] mt-3">Busca automática</p>
            <p className="text-xs font-medium">{activeScan.keyword}</p>
            <p className="text-[11px] text-[#727687] mt-2">Raio de 2 km • {activeScan.points.length} pontos</p>
          </div>
        </aside>}

        <section className="relative rounded-2xl overflow-hidden border border-[#c2c6d8]/45 bg-[#eef2f6] min-h-[590px] shadow-sm">
          {(loading || generatingGrid) && <div className="absolute inset-0 z-20 grid place-items-center bg-white/85 backdrop-blur-[2px]"><div className="text-center"><Loader2 className="w-7 h-7 animate-spin text-[#0066ff] mx-auto" /><p className="text-xs font-semibold mt-2">{generatingGrid ? `Consultando ${gridSize * gridSize} pontos…` : 'Carregando mapa…'}</p></div></div>}
          {!mapsKey
            ? <EmptyMap title="Chave do mapa ainda não configurada" detail="O administrador pode cadastrar a chave em Administração → Integrações." />
            : activeScan
              ? <GridMapCanvas scan={activeScan} companyName={activeScanLead?.company_name || 'Empresa analisada'} mapsKey={mapsKey} onError={handleMapError}/>
              : <EmptyMap title="Pronto para analisar" detail="Cole o link do perfil do Google Maps acima. O sistema identifica a empresa e o segmento automaticamente." />}
        </section>
      </div>

      <section className="rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#c2c6d8]/30 flex items-center gap-2">
          <History className="w-4 h-4 text-[#0066ff]"/>
          <div>
            <h3 className="font-semibold text-sm tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>Histórico de mapas</h3>
            <p className="text-[10px] text-[#727687]">Análises anteriores desta conta.</p>
          </div>
        </div>
        {!scanHistory.length ? <div className="p-8 text-center text-xs text-[#727687]">Nenhum mapa gerado ainda.</div> : <div className="divide-y divide-[#c2c6d8]/25">
          {scanHistory.map(scan => {
            const lead = leads.find(item => item.id === scan.lead_id);
            const historyGridSize = scanGridSize(scan);
            return <button key={scan.id} onClick={() => { setActiveScan(scan); setSelectedId(scan.lead_id); setGridSize(historyGridSize); }} className={`w-full p-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#f8f9fc] dark:hover:bg-[#10142e] ${activeScan?.id === scan.id ? 'bg-[#0066ff]/5' : ''}`}>
              <div>
                <p className="text-xs font-semibold">{lead?.company_name || 'Empresa'} <span className="font-normal text-[#727687]">• {scan.keyword}</span></p>
                <p className="text-[10px] text-[#727687] mt-0.5">{new Date(scan.created_at).toLocaleString('pt-BR')} • Grade {historyGridSize}×{historyGridSize} • Raio de 2 km</p>
              </div>
              <div className="flex gap-2 text-[10px] font-semibold"><span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700">Presença {Math.round(scan.visibility_percentage)}%</span><span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">Melhor {scan.best_position || '20+'}</span></div>
            </button>;
          })}
        </div>}
      </section>
      {error && <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</div>}
    </div>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return <div className="p-4 rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35"><div className="text-[#0066ff]">{icon}</div><p className="text-2xl font-semibold tracking-tight mt-2">{value}</p><p className="text-[10px] text-[#727687] mt-0.5">{label}</p></div>;
}

function EmptyMap({ title, detail }: { title: string; detail: string }) {
  return <div className="min-h-[590px] grid place-items-center p-8 text-center bg-gradient-to-br from-[#f8fafc] to-[#eef2f6] dark:from-[#141936] dark:to-[#10142e]"><div><Layers className="w-10 h-10 mx-auto text-[#0066ff]/70" /><p className="font-semibold mt-3">{title}</p><p className="text-xs text-[#727687] mt-1 max-w-sm">{detail}</p></div></div>;
}
