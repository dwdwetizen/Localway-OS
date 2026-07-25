'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Layers, Loader2, MapPin, RefreshCw, Search, Target, TrendingUp } from 'lucide-react';
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
type MapsNamespace = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  LatLngBounds: new () => BoundsInstance;
  Circle: new (options: Record<string, unknown>) => CircleInstance;
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

export function HeatmapView({ onShowToast }: HeatmapViewProps) {
  const { leads, loading, error, refresh } = useLeads();
  const [city, setCity] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [mapsKey, setMapsKey] = useState(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '');

  useEffect(() => {
    let active = true;
    const loadConfiguration = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/places', {
        headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const configuration = await response.json();
      if (active && configuration.mapsBrowserKey) setMapsKey(configuration.mapsBrowserKey);
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

  const handleMapError = (message: string) => onShowToast(message, 'error');
  const handleSelect = (id: string) => setSelectedId(id);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center"><MapPin className="w-6 h-6" /></div>
          <div><h2 className="text-xl font-bold">Mapa de Oportunidades</h2><p className="text-xs text-[#727687]">Intensidade geográfica calculada com os leads reais da prospecção.</p></div>
        </div>
        <button onClick={() => void refresh()} className="px-4 py-2.5 rounded-xl bg-[#0066ff] text-white text-xs font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Atualizar dados</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#727687]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar empresa" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-[#141936] border text-xs" /></div>
        <select value={city} onChange={event => setCity(event.target.value)} className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#141936] border text-xs"><option value="all">Todas as cidades</option>{cities.map(item => <option key={item}>{item}</option>)}</select>
        <select value={category} onChange={event => setCategory(event.target.value)} className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#141936] border text-xs"><option value="all">Todos os segmentos</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
        <div className="flex gap-2 text-[10px] font-bold items-center justify-end">
          <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700">Vermelho: oportunidade alta</span>
          <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">Verde: perfil forte</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Summary icon={<Target className="w-4 h-4" />} label="Leads no mapa" value={filtered.length} />
            <Summary icon={<TrendingUp className="w-4 h-4" />} label="Oportunidades" value={opportunities} />
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-[#141936] border">
            <p className="text-[10px] text-[#727687] uppercase font-bold">Score médio da região</p>
            <p className="text-3xl font-black mt-1">{averageScore}</p>
          </div>
          {selected && <div className="p-5 rounded-2xl bg-white dark:bg-[#141936] border space-y-3">
            <div className="flex items-start justify-between gap-2"><div><p className="font-bold text-sm">{selected.company_name}</p><p className="text-[11px] text-[#727687]">{selected.category || 'Sem segmento'}</p></div><span className="text-xs font-black" style={{ color: colorForScore(selected.health_score) }}>{selected.health_score ?? 0}</span></div>
            <p className="text-[11px] text-[#727687]">{selected.address}</p>
            <p className="text-xs">{selected.opportunity || 'Atualize a análise para ver a oportunidade.'}</p>
            {selected.google_maps_url && <a href={selected.google_maps_url} target="_blank" rel="noreferrer" className="w-full py-2 rounded-xl bg-[#0066ff]/10 text-[#0066ff] text-xs font-bold flex items-center justify-center gap-2">Abrir perfil <ExternalLink className="w-3.5 h-3.5" /></a>}
          </div>}
        </aside>

        <section className="relative rounded-2xl overflow-hidden border bg-[#10142e] min-h-[520px]">
          {loading && <div className="absolute inset-0 z-20 grid place-items-center bg-white/80"><Loader2 className="w-7 h-7 animate-spin text-[#0066ff]" /></div>}
          {!mapsKey ? <EmptyMap title="Chave do mapa ainda não configurada" detail="O administrador pode colar a chave em Administração → Integrações." /> : !filtered.length ? <EmptyMap title="Nenhum lead com coordenadas" detail="Gere novos leads pelo Google Places ou atualize a análise dos leads antigos." /> : <MapCanvas leads={filtered} selectedId={selected?.id || ''} mapsKey={mapsKey} onSelect={handleSelect} onError={handleMapError} />}
        </section>
      </div>
      {error && <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</div>}
    </div>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="p-4 rounded-2xl bg-white dark:bg-[#141936] border"><div className="text-[#0066ff]">{icon}</div><p className="text-2xl font-black mt-2">{value}</p><p className="text-[10px] text-[#727687]">{label}</p></div>;
}

function EmptyMap({ title, detail }: { title: string; detail: string }) {
  return <div className="min-h-[520px] grid place-items-center p-8 text-center text-white"><div><Layers className="w-10 h-10 mx-auto text-[#3b82f6]" /><p className="font-bold mt-3">{title}</p><p className="text-xs text-white/60 mt-1 max-w-sm">{detail}</p></div></div>;
}
