'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Grid3X3, History, Layers, Link2, Loader2, MapPin, RefreshCw, Search, Target, TrendingUp } from 'lucide-react';
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
type CircleInstance = {
  addListener: (eventName: string, callback: () => void) => void;
  setMap: (map: MapInstance | null) => void;
};
type MarkerInstance = {
  setMap: (map: MapInstance | null) => void;
};
type MapsNamespace = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  LatLngBounds: new () => BoundsInstance;
  Circle: new (options: Record<string, unknown>) => CircleInstance;
  Marker: new (options: Record<string, unknown>) => MarkerInstance;
  SymbolPath: { CIRCLE: number };
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
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const previous = document.querySelector<HTMLScriptElement>('script[data-localway-google-maps]');
    const finish = () => window.google?.maps ? resolve(window.google.maps) : reject(new Error('Google Maps não carregou.'));
    if (previous) {
      previous.addEventListener('load', finish, { once: true });
      previous.addEventListener('error', () => reject(new Error('Falha ao carregar o Google Maps.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&language=pt-BR&region=BR`;
    script.async = true;
    script.dataset.localwayGoogleMaps = 'true';
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('Falha ao carregar o Google Maps.')), { once: true });
    document.head.appendChild(script);
  });
  return mapsPromise;
}

function colorForScore(score: number | null) {
  if ((score ?? 0) < 55) return '#e11d48';
  if ((score ?? 0) < 75) return '#f59e0b';
  return '#10b981';
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

function MapCanvas({ leads, selectedId, mapsKey, onSelect, onError }: {
  leads: Lead[];
  selectedId: string;
  mapsKey: string;
  onSelect: (id: string) => void;
  onError: (message: string) => void;
}) {
  const node = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!node.current || !mapsKey || !leads.length) return;
    let active = true;
    const circles: CircleInstance[] = [];
    void loadGoogleMaps(mapsKey).then(maps => {
      if (!active || !node.current) return;
      const first = leads[0];
      const map = new maps.Map(node.current, {
        center: { lat: first.latitude as number, lng: first.longitude as number },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
      });
      const bounds = new maps.LatLngBounds();
      leads.forEach(lead => {
        const center = { lat: lead.latitude as number, lng: lead.longitude as number };
        bounds.extend(center);
        const opportunity = 100 - (lead.health_score ?? 50);
        const selected = selectedId === lead.id;
        const circle = new maps.Circle({
          map,
          center,
          radius: 180 + opportunity * 7,
          fillColor: colorForScore(lead.health_score),
          fillOpacity: selected ? 0.65 : 0.35,
          strokeColor: selected ? '#ffffff' : colorForScore(lead.health_score),
          strokeOpacity: 0.95,
          strokeWeight: selected ? 4 : 2,
          zIndex: selected ? 10 : 1,
        });
        circle.addListener('click', () => onSelect(lead.id));
        circles.push(circle);
      });
      map.fitBounds(bounds);
      if (leads.length === 1) {
        map.setCenter({ lat: leads[0].latitude as number, lng: leads[0].longitude as number });
        map.setZoom(14);
      }
    }).catch(error => {
      if (active) onError(error instanceof Error ? error.message : 'Erro ao abrir o mapa.');
    });
    return () => {
      active = false;
      circles.forEach(circle => circle.setMap(null));
    };
  }, [leads, mapsKey, onError, onSelect, selectedId]);

  return <div ref={node} className="w-full min-h-[520px] rounded-2xl bg-[#10142e]" />;
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

  return <div ref={node} className="w-full min-h-[560px] rounded-2xl bg-[#10142e]" />;
}

export function HeatmapView({ onShowToast }: HeatmapViewProps) {
  const { leads, loading, error, refresh, createLead } = useLeads();
  const [city, setCity] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [mapsKey, setMapsKey] = useState(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '');
  const [keyword, setKeyword] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(2000);
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
  const cities = useMemo(() => Array.from(new Set(located.map(lead => lead.city).filter(Boolean) as string[])).sort(), [located]);
  const categories = useMemo(() => Array.from(new Set(located.map(lead => lead.category).filter(Boolean) as string[])).sort(), [located]);
  const filtered = useMemo(() => located.filter(lead => {
    const matchesCity = city === 'all' || lead.city === city;
    const matchesCategory = category === 'all' || lead.category === category;
    const matchesQuery = !query.trim() || lead.company_name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
    return matchesCity && matchesCategory && matchesQuery;
  }), [category, city, located, query]);
  const selected = filtered.find(lead => lead.id === selectedId) || filtered[0] || null;
  const opportunities = filtered.filter(lead => (lead.health_score ?? 100) < 60).length;
  const averageScore = filtered.length
    ? Math.round(filtered.reduce((total, lead) => total + (lead.health_score ?? 0), 0) / filtered.length)
    : 0;
  const activeScanLead = activeScan ? leads.find(lead => lead.id === activeScan.lead_id) || null : null;

  const handleMapError = (message: string) => onShowToast(message, 'error');
  const handleSelect = (id: string) => setSelectedId(id);
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
        setKeyword(existing.category || place.category || '');
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
        setKeyword(created.data.category || '');
      }
      setGoogleMapsUrl('');
      setActiveScan(null);
      onShowToast('Perfil do Google carregado. Informe a palavra-chave e gere a grade.', 'success');
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
    if (keyword.trim().length < 2) return onShowToast('Digite a palavra-chave da pesquisa.', 'error');
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
        keyword: keyword.trim(),
        latitude: selected.latitude,
        longitude: selected.longitude,
        radiusMeters,
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center"><MapPin className="w-6 h-6" /></div>
          <div><h2 className="text-xl font-bold">Mapa de Visibilidade Local</h2><p className="text-xs text-[#727687]">Grade estimada por GPS e mapa de oportunidades dos leads.</p></div>
        </div>
        <button onClick={() => void refresh()} className="px-4 py-2.5 rounded-xl bg-[#0066ff] text-white text-xs font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Atualizar dados</button>
      </div>

      <section className="p-5 rounded-2xl bg-white dark:bg-[#141936] border space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center"><Grid3X3 className="w-5 h-5"/></div>
          <div>
            <h3 className="font-bold text-sm">Mapa de calor de ranking local</h3>
            <p className="text-[11px] text-[#727687]">Consulte de 9 a 49 pontos oficiais do Google Places. Resultados fora das 20 primeiras posições aparecem como 20+.</p>
          </div>
        </div>
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
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] border text-xs"
            />
          </div>
          <button disabled={resolvingProfile || !googleMapsUrl.trim()} onClick={() => void resolveGoogleProfile()} className="px-5 py-2.5 rounded-xl border border-[#0066ff] text-[#0066ff] disabled:opacity-50 text-xs font-bold flex justify-center items-center gap-2">
            {resolvingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            {resolvingProfile ? 'Carregando perfil...' : 'Carregar perfil'}
          </button>
        </div>
        <div className="grid md:grid-cols-[1.4fr_1fr_130px_130px_auto] gap-3">
          <select value={selected?.id || ''} onChange={event => { const lead = located.find(item => item.id === event.target.value); setSelectedId(event.target.value); setKeyword(lead?.category || ''); setActiveScan(null); }} className="px-3 py-2.5 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] border text-xs">
            <option value="">Selecione a empresa</option>
            {located.map(lead => <option key={lead.id} value={lead.id}>{lead.company_name}</option>)}
          </select>
          <input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="Ex.: dentista, restaurante" className="px-3 py-2.5 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] border text-xs"/>
          <select value={radiusMeters} onChange={event => setRadiusMeters(Number(event.target.value))} className="px-3 py-2.5 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] border text-xs">
            <option value={1000}>Raio de 1 km</option>
            <option value={2000}>Raio de 2 km</option>
            <option value={3000}>Raio de 3 km</option>
            <option value={5000}>Raio de 5 km</option>
          </select>
          <select value={gridSize} onChange={event => setGridSize(Number(event.target.value))} className="px-3 py-2.5 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] border text-xs">
            {[3, 4, 5, 6, 7].map(size => <option key={size} value={size}>{size}×{size} ({size * size} pontos)</option>)}
          </select>
          <button disabled={generatingGrid || !selected} onClick={() => void runVisibilityGrid()} className="px-5 py-2.5 rounded-xl bg-[#0066ff] disabled:opacity-50 text-white text-xs font-bold flex justify-center items-center gap-2">
            {generatingGrid ? <Loader2 className="w-4 h-4 animate-spin"/> : <Grid3X3 className="w-4 h-4"/>}{generatingGrid ? `Consultando ${gridSize * gridSize} pontos…` : 'Gerar grade'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#727687]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar empresa" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-[#141936] border text-xs" /></div>
        <select value={city} onChange={event => setCity(event.target.value)} className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#141936] border text-xs"><option value="all">Todas as cidades</option>{cities.map(item => <option key={item}>{item}</option>)}</select>
        <select value={category} onChange={event => setCategory(event.target.value)} className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#141936] border text-xs"><option value="all">Todos os segmentos</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
        <div className="flex gap-2 text-[10px] font-bold items-center justify-end">
          {activeScan ? <>
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">1–3</span>
            <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700">4–10</span>
            <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700">11–20</span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">20+</span>
          </> : <>
            <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700">Vermelho: oportunidade alta</span>
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">Verde: perfil forte</span>
          </>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <aside className="space-y-4">
          {activeScan ? <>
            <div className="grid grid-cols-2 gap-3">
              <Summary icon={<Target className="w-4 h-4" />} label="Presença estimada" value={`${Math.round(activeScan.visibility_percentage)}%`} />
              <Summary icon={<TrendingUp className="w-4 h-4" />} label="Melhor posição" value={activeScan.best_position || '—'} />
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#141936] border">
              <p className="text-[10px] text-[#727687] uppercase font-bold">Posição média estimada</p>
              <p className="text-3xl font-black mt-1">{activeScan.average_position?.toFixed(1) || '—'}</p>
              <p className="text-[10px] text-[#727687] mt-2">Palavra-chave: <strong>{activeScan.keyword}</strong></p>
              <p className="text-[10px] text-[#727687]">Raio: {(activeScan.radius_m / 1000).toFixed(0)} km • {activeScan.points.length} pontos</p>
            </div>
            <button onClick={() => setActiveScan(null)} className="w-full py-2.5 rounded-xl border text-xs font-bold">Ver mapa de oportunidades</button>
          </> : <>
            <div className="grid grid-cols-2 gap-3">
              <Summary icon={<Target className="w-4 h-4" />} label="Leads no mapa" value={filtered.length} />
              <Summary icon={<TrendingUp className="w-4 h-4" />} label="Oportunidades" value={opportunities} />
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#141936] border">
              <p className="text-[10px] text-[#727687] uppercase font-bold">Score médio da região</p>
              <p className="text-3xl font-black mt-1">{averageScore}</p>
            </div>
          </>}
          {selected && <div className="p-5 rounded-2xl bg-white dark:bg-[#141936] border space-y-3">
            <div className="flex items-start justify-between gap-2"><div><p className="font-bold text-sm">{selected.company_name}</p><p className="text-[11px] text-[#727687]">{selected.category || 'Sem segmento'}</p></div><span className="text-xs font-black" style={{ color: colorForScore(selected.health_score) }}>{selected.health_score ?? 0}</span></div>
            <p className="text-[11px] text-[#727687]">{selected.address}</p>
            <p className="text-xs">{selected.opportunity || 'Atualize a análise para ver a oportunidade.'}</p>
            {selected.google_maps_url && <a href={selected.google_maps_url} target="_blank" rel="noreferrer" className="w-full py-2 rounded-xl bg-[#0066ff]/10 text-[#0066ff] text-xs font-bold flex items-center justify-center gap-2">Abrir perfil <ExternalLink className="w-3.5 h-3.5" /></a>}
          </div>}
        </aside>

        <section className="relative rounded-2xl overflow-hidden border bg-[#10142e] min-h-[520px]">
          {(loading || generatingGrid) && <div className="absolute inset-0 z-20 grid place-items-center bg-white/80"><div className="text-center"><Loader2 className="w-7 h-7 animate-spin text-[#0066ff] mx-auto" /><p className="text-xs font-bold mt-2">{generatingGrid ? `Consultando ${gridSize * gridSize} pontos…` : 'Carregando mapa…'}</p></div></div>}
          {!mapsKey
            ? <EmptyMap title="Chave do mapa ainda não configurada" detail="O administrador pode colar a chave em Administração → Integrações." />
            : activeScan
              ? <GridMapCanvas scan={activeScan} companyName={activeScanLead?.company_name || 'Empresa analisada'} mapsKey={mapsKey} onError={handleMapError}/>
              : !filtered.length
                ? <EmptyMap title="Nenhum lead com coordenadas" detail="Gere novos leads pelo Google Places ou atualize a análise dos leads antigos." />
                : <MapCanvas leads={filtered} selectedId={selected?.id || ''} mapsKey={mapsKey} onSelect={handleSelect} onError={handleMapError} />}
        </section>
      </div>
      <section className="rounded-2xl bg-white dark:bg-[#141936] border overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2"><History className="w-4 h-4 text-[#0066ff]"/><div><h3 className="font-bold text-sm">Histórico de grades</h3><p className="text-[10px] text-[#727687]">Últimas análises salvas no Supabase.</p></div></div>
        {!scanHistory.length ? <div className="p-8 text-center text-xs text-[#727687]">Nenhuma grade gerada ainda.</div> : <div className="divide-y">
          {scanHistory.map(scan => {
            const lead = leads.find(item => item.id === scan.lead_id);
            const historyGridSize = scanGridSize(scan);
            return <button key={scan.id} onClick={() => { setActiveScan(scan); setSelectedId(scan.lead_id); setKeyword(scan.keyword); setRadiusMeters(scan.radius_m); setGridSize(historyGridSize); }} className={`w-full p-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#f8f9ff] dark:hover:bg-[#10142e] ${activeScan?.id === scan.id ? 'bg-[#0066ff]/5' : ''}`}>
              <div><p className="text-xs font-bold">{lead?.company_name || 'Empresa'} • {scan.keyword}</p><p className="text-[10px] text-[#727687]">{new Date(scan.created_at).toLocaleString('pt-BR')} • Grade {historyGridSize}×{historyGridSize} • Raio de {(scan.radius_m / 1000).toFixed(0)} km</p></div>
              <div className="flex gap-2 text-[10px] font-bold"><span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700">Presença {Math.round(scan.visibility_percentage)}%</span><span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">Melhor {scan.best_position || '—'}</span></div>
            </button>;
          })}
        </div>}
      </section>
      {error && <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</div>}
    </div>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return <div className="p-4 rounded-2xl bg-white dark:bg-[#141936] border"><div className="text-[#0066ff]">{icon}</div><p className="text-2xl font-black mt-2">{value}</p><p className="text-[10px] text-[#727687]">{label}</p></div>;
}

function EmptyMap({ title, detail }: { title: string; detail: string }) {
  return <div className="min-h-[520px] grid place-items-center p-8 text-center text-white"><div><Layers className="w-10 h-10 mx-auto text-[#3b82f6]" /><p className="font-bold mt-3">{title}</p><p className="text-xs text-white/60 mt-1 max-w-sm">{detail}</p></div></div>;
}
