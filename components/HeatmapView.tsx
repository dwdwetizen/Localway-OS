'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Clock3, Grid3X3, History, Layers, Link2, Loader2, MapPin, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { useLeads } from '@/hooks/use-leads';
import { Lead } from '@/lib/leads';
import { supabase } from '@/lib/supabase';
import { KeywordOpportunityPanel } from '@/components/KeywordOpportunityPanel';
import { useAuthProfile } from '@/components/AuthGate';

interface HeatmapViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

type LatLng = { lat: number; lng: number };
type MapInstance = {
  fitBounds: (bounds: BoundsInstance) => void;
  setCenter: (center: LatLng) => void;
  setZoom: (zoom: number) => void;
  addListener?: (eventName: string, handler: () => void) => { remove?: () => void };
};
type BoundsInstance = {
  extend: (position: LatLng) => void;
};
type MarkerInstance = {
  setMap: (map: MapInstance | null) => void;
};
type CircleInstance = {
  setMap: (map: MapInstance | null) => void;
};
type MapsNamespace = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  LatLngBounds: new () => BoundsInstance;
  Marker: new (options: Record<string, unknown>) => MarkerInstance;
  Circle: new (options: Record<string, unknown>) => CircleInstance;
  SymbolPath: { CIRCLE: number };
  importLibrary?: (library: string) => Promise<unknown>;
};
type RankedPlace = {
  id: string;
  name: string;
  address: string | null;
  category: string | null;
  rating: number | null;
  review_count: number;
  photo_name: string | null;
};
type VisibilityPoint = {
  row: number;
  column: number;
  latitude: number;
  longitude: number;
  position: number | null;
  found: boolean;
  top_place_ids: string[];
  top_places?: RankedPlace[];
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
  if (readyMaps && typeof readyMaps.Map === 'function' && typeof readyMaps.Marker === 'function' && typeof readyMaps.Circle === 'function') {
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
          Circle: mapLibrary.Circle || maps.Circle,
          SymbolPath: maps.SymbolPath,
          importLibrary: maps.importLibrary,
        };
        if (typeof completeMaps.Map !== 'function' || typeof completeMaps.Marker !== 'function' || typeof completeMaps.Circle !== 'function') {
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
  if (position === null) return '#9f1239';
  if (position <= 3) return '#10b981';
  if (position <= 10) return '#f59e0b';
  return '#fb5b6d';
}

function scanGridSize(scan: VisibilityScan) {
  const sizeFromPoints = Math.sqrt(scan.points.length);
  return Number.isInteger(sizeFromPoints) ? sizeFromPoints : scan.grid_size;
}

function keywordKey(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function GridMapCanvas({ scan, mapsKey, onError }: {
  scan: VisibilityScan;
  mapsKey: string;
  onError: (message: string) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!node.current || !mapsKey || !scan.points.length) return;
    let active = true;
    let loadTimer: number | null = null;
    let tilesListener: { remove?: () => void } | null = null;
    const markers: MarkerInstance[] = [];
    const circles: CircleInstance[] = [];
    setMapError('');
    setMapReady(false);
    void loadGoogleMaps(mapsKey).then(maps => {
      if (!active || !node.current) return;
      const map = new maps.Map(node.current, {
        center: { lat: scan.center_latitude, lng: scan.center_longitude },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
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
      tilesListener = map.addListener?.('tilesloaded', () => {
        if (!active) return;
        if (loadTimer !== null) window.clearTimeout(loadTimer);
        setMapReady(true);
      }) || null;
      loadTimer = window.setTimeout(() => {
        if (!active) return;
        const message = 'O mapa-base não carregou. Verifique se a chave de navegador permite este domínio na Maps JavaScript API.';
        setMapError(message);
        onError(message);
      }, 12_000);
      const bounds = new maps.LatLngBounds();
      const gridStep = scan.radius_m / Math.max((scanGridSize(scan) - 1) / 2, 1);
      const pointRadius = Math.max(180, gridStep * 0.42);
      scan.points.forEach(point => {
        const position = { lat: point.latitude, lng: point.longitude };
        bounds.extend(position);
        const circle = new maps.Circle({
          map,
          center: position,
          radius: pointRadius,
          fillColor: '#22c55e',
          fillOpacity: 0.16,
          strokeColor: '#16a34a',
          strokeOpacity: 0.28,
          strokeWeight: 1,
          clickable: false,
        });
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
            scale: 19,
          },
        });
        circles.push(circle);
        markers.push(marker);
      });
      map.fitBounds(bounds);
    }).catch(error => {
      if (!active) return;
      const message = error instanceof Error ? error.message : 'Erro ao abrir a grade.';
      setMapError(message);
      onError(message);
    });
    return () => {
      active = false;
      if (loadTimer !== null) window.clearTimeout(loadTimer);
      tilesListener?.remove?.();
      markers.forEach(marker => marker.setMap(null));
      circles.forEach(circle => circle.setMap(null));
    };
  }, [mapsKey, onError, scan]);

  return <div className="relative w-full h-[520px] sm:h-[680px] bg-[#eef2f6]">
    <div ref={node} className="absolute inset-0 w-full h-full" />
    {!mapReady && !mapError && <div className="absolute inset-0 z-10 grid place-items-center bg-[#eef2f6]">
      <div className="text-center"><Loader2 className="w-7 h-7 animate-spin text-[#0066ff] mx-auto" /><p className="text-xs font-semibold mt-2">Carregando mapa…</p></div>
    </div>}
    {mapError && <div className="absolute inset-0 z-10 grid place-items-center bg-gradient-to-br from-[#f8fafc] to-[#eef2f6] p-8 text-center">
      <div><MapPin className="w-10 h-10 mx-auto text-rose-500" /><p className="font-semibold mt-3">Não foi possível exibir o mapa</p><p className="text-xs text-[#727687] mt-1 max-w-md">{mapError}</p></div>
    </div>}
  </div>;
}

export function HeatmapView({ onShowToast }: HeatmapViewProps) {
  const profile = useAuthProfile();
  const { leads, loading, error, createLead, updateLead } = useLeads();
  const [selectedId, setSelectedId] = useState('');
  const [mapsKey, setMapsKey] = useState(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '');
  const [gridSize, setGridSize] = useState(5);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [resolvingProfile, setResolvingProfile] = useState(false);
  const [generatingGrid, setGeneratingGrid] = useState(false);
  const [scanHistory, setScanHistory] = useState<VisibilityScan[]>([]);
  const [activeScan, setActiveScan] = useState<VisibilityScan | null>(null);
  const [activeKeyword, setActiveKeyword] = useState('');
  const [keywordManagerOpen, setKeywordManagerOpen] = useState(false);
  const [keywordDrafts, setKeywordDrafts] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [savingKeywords, setSavingKeywords] = useState(false);
  const resolvingProfileRef = useRef(false);

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
          .eq('created_by', profile.id)
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
        setSelectedId(rows[0]?.lead_id || '');
        setActiveKeyword(rows[0]?.keyword || '');
      }
    };
    void loadConfiguration();
    return () => { active = false; };
  }, [profile.id]);

  const located = useMemo(
    () => leads.filter(lead => typeof lead.latitude === 'number' && typeof lead.longitude === 'number'),
    [leads],
  );
  const selected = located.find(lead => lead.id === selectedId) || null;
  const activeScanLead = activeScan ? leads.find(lead => lead.id === activeScan.lead_id) || null : null;
  const keywordTabs = useMemo(() => {
    if (!selected) return [];
    const stored = selected.analysis_data?.visibility_keywords || [];
    const scanned = scanHistory.filter(scan => scan.lead_id === selected.id).map(scan => scan.keyword);
    const values = (stored.length ? stored : [selected.category || '', ...scanned]).map(value => value.trim()).filter(Boolean);
    return values.filter((value, index) => values.findIndex(item => keywordKey(item) === keywordKey(value)) === index);
  }, [scanHistory, selected]);
  const competitors = useMemo(() => {
    if (!activeScan) return [];
    const targetPlaceId = activeScanLead?.google_place_id;
    const grouped = new Map<string, RankedPlace & {
      appearances: number;
      total_position: number;
      best_position: number;
    }>();
    activeScan.points.forEach(point => {
      (point.top_places || []).forEach((place, index) => {
        if (place.id === targetPlaceId) return;
        const current = grouped.get(place.id);
        if (current) {
          current.appearances += 1;
          current.total_position += index + 1;
          current.best_position = Math.min(current.best_position, index + 1);
        } else {
          grouped.set(place.id, {
            ...place,
            appearances: 1,
            total_position: index + 1,
            best_position: index + 1,
          });
        }
      });
    });
    return Array.from(grouped.values())
      .map(place => ({ ...place, average_position: place.total_position / place.appearances }))
      .sort((a, b) => b.appearances - a.appearances || a.average_position - b.average_position)
      .slice(0, 20);
  }, [activeScan, activeScanLead?.google_place_id]);
  const areaDifficulty = !activeScan
    ? null
    : competitors.length >= 12 || activeScan.visibility_percentage < 25
      ? 'Alta'
      : competitors.length >= 6 || activeScan.visibility_percentage < 60
        ? 'Média'
        : 'Baixa';

  const handleMapError = useCallback((message: string) => onShowToast(message, 'error'), [onShowToast]);
  const selectKeyword = (keyword: string) => {
    if (!selected) return;
    setActiveKeyword(keyword);
    const scan = scanHistory.find(item => item.lead_id === selected.id && keywordKey(item.keyword) === keywordKey(keyword));
    setActiveScan(scan || null);
  };
  const openKeywordManager = () => {
    if (!selected) return;
    setKeywordDrafts(keywordTabs.length ? keywordTabs : [selected.category || selected.company_name]);
    setNewKeyword('');
    setKeywordManagerOpen(true);
  };
  const addKeywordDraft = () => {
    const value = newKeyword.trim();
    if (value.length < 2) return onShowToast('Digite uma palavra-chave válida.', 'error');
    if (keywordDrafts.some(item => keywordKey(item) === keywordKey(value))) return onShowToast('Essa palavra-chave já está na lista.', 'info');
    if (keywordDrafts.length >= 10) return onShowToast('Use no máximo 10 palavras-chave por empresa.', 'error');
    setKeywordDrafts(current => [...current, value]);
    setNewKeyword('');
  };
  const saveKeywords = async () => {
    if (!selected) return;
    const cleaned = keywordDrafts
      .map(value => value.trim())
      .filter(value => value.length >= 2)
      .filter((value, index, values) => values.findIndex(item => keywordKey(item) === keywordKey(value)) === index);
    if (!cleaned.length) return onShowToast('Mantenha pelo menos uma palavra-chave.', 'error');
    setSavingKeywords(true);
    const result = await updateLead(selected.id, {
      analysis_data: {
        ...(selected.analysis_data || {}),
        visibility_keywords: cleaned,
      },
    });
    setSavingKeywords(false);
    if (result.error) return onShowToast(result.error, 'error');
    const nextKeyword = cleaned.some(item => keywordKey(item) === keywordKey(activeKeyword)) ? activeKeyword : cleaned[0];
    setActiveKeyword(nextKeyword);
    setActiveScan(scanHistory.find(item => item.lead_id === selected.id && keywordKey(item.keyword) === keywordKey(nextKeyword)) || null);
    setKeywordManagerOpen(false);
    onShowToast('Palavras-chave atualizadas.', 'success');
  };
  const resolveGoogleProfile = async () => {
    if (resolvingProfileRef.current) return;
    if (!supabase || !googleMapsUrl.trim()) {
      return onShowToast('Cole o link do perfil da empresa no Google Maps.', 'error');
    }
    resolvingProfileRef.current = true;
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
        setActiveKeyword(existing.analysis_data?.visibility_keywords?.[0] || existing.category || existing.company_name);
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
        setActiveKeyword(created.data.category || created.data.company_name);
      }
      setActiveScan(null);
      onShowToast('Perfil carregado. O segmento foi identificado automaticamente.', 'success');
    } catch (requestError) {
      onShowToast(requestError instanceof Error ? requestError.message : 'Erro ao carregar o perfil.', 'error');
    } finally {
      resolvingProfileRef.current = false;
      setResolvingProfile(false);
    }
  };

  const runVisibilityGrid = async () => {
    if (!supabase || !selected) return;
    if (!selected.google_place_id || typeof selected.latitude !== 'number' || typeof selected.longitude !== 'number') {
      return onShowToast('Selecione uma empresa gerada pelo Google e com coordenadas válidas.', 'error');
    }
    const searchKeyword = activeKeyword.trim() || selected.category?.trim() || selected.company_name.trim();
    if (searchKeyword.length < 2) return onShowToast('Selecione ou cadastre uma palavra-chave válida.', 'error');
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
        keyword: searchKeyword,
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
    setActiveKeyword(scan.keyword);
    setActiveScan(scan);
    setScanHistory(current => [scan, ...current.filter(item => item.id !== scan.id)].slice(0, 20));
    onShowToast(`Grade ${gridSize}×${gridSize} calculada e salva no histórico.`);
  };

  const useKeywordFromResearch = async (keyword: string) => {
    if (!selected) return;
    const stored = selected.analysis_data?.visibility_keywords || [];
    const keywords = stored.some(item => keywordKey(item) === keywordKey(keyword))
      ? stored
      : [...stored, keyword].slice(0, 10);
    if (keywords !== stored) {
      const result = await updateLead(selected.id, {
        analysis_data: { ...(selected.analysis_data || {}), visibility_keywords: keywords },
      });
      if (result.error) {
        onShowToast(result.error, 'error');
        return;
      }
    }
    setActiveKeyword(keyword);
    setActiveScan(scanHistory.find(item =>
      item.lead_id === selected.id && keywordKey(item.keyword) === keywordKey(keyword)) || null);
    onShowToast(`“${keyword}” adicionada ao mapa de calor.`, 'success');
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex items-center gap-3 bg-white dark:bg-[#141936] p-4 sm:p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl sm:rounded-2xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center"><MapPin className="w-5 h-5 sm:w-6 sm:h-6" /></div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>Mapa de calor de ranking local</h2>
          <p className="text-xs text-[#727687] mt-0.5">Cole o perfil do Google e veja a posição da empresa em cada ponto da região.</p>
        </div>
      </header>

      <section className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35 dark:border-[#2e366b] shadow-sm space-y-4">
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

        {selected && <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] uppercase tracking-[0.12em] font-semibold text-[#727687]">Palavras-chave</span>
          {keywordTabs.map(keyword => <button key={keyword} type="button" onClick={() => selectKeyword(keyword)} className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${keywordKey(activeKeyword) === keywordKey(keyword) ? 'bg-[#0066ff] border-[#0066ff] text-white shadow-sm' : 'bg-white dark:bg-[#10142e] border-[#c2c6d8]/45 hover:border-[#0066ff] text-[#424656] dark:text-[#dfe3f4]'}`}>{keyword}</button>)}
          <button type="button" onClick={openKeywordManager} className="w-full sm:w-auto sm:ml-auto px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-full border border-[#c2c6d8]/45 text-xs font-semibold text-[#0066ff] hover:bg-[#0066ff]/5 flex justify-center items-center gap-1.5"><Pencil className="w-3 h-3" /> Gerenciar palavras-chave</button>
        </div>}

        {selected && <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-[#f8f9fc] dark:bg-[#10142e] border border-[#c2c6d8]/30">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#727687]">Perfil identificado</p>
            <p className="text-sm font-semibold mt-1">{selected.company_name}</p>
            <p className="text-xs text-[#727687]">{selected.category || 'Categoria identificada pelo Google'}</p>
          </div>
          <div className="grid grid-cols-2 md:flex w-full md:w-auto items-center gap-2">
            <span className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35 text-xs font-medium text-center">Raio: 2 km</span>
            <select aria-label="Tamanho da grade" value={gridSize} onChange={event => setGridSize(Number(event.target.value))} className="min-w-0 px-3 py-2 rounded-xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/50 text-xs font-medium">
              {[3, 4, 5, 6, 7].map(size => <option key={size} value={size}>{size}×{size} ({size * size} pontos)</option>)}
            </select>
            <button disabled={generatingGrid} onClick={() => void runVisibilityGrid()} className="col-span-2 md:col-span-1 min-h-11 px-5 py-2 rounded-xl bg-[#0066ff] hover:bg-[#0050cb] disabled:opacity-50 text-white text-xs font-semibold flex justify-center items-center gap-2">
              {generatingGrid ? <Loader2 className="w-4 h-4 animate-spin"/> : <Grid3X3 className="w-4 h-4"/>}
              {generatingGrid ? `Consultando ${gridSize * gridSize} pontos…` : 'Gerar mapa de calor'}
            </button>
          </div>
        </div>}
      </section>

      {selected && <KeywordOpportunityPanel
        selectedLead={selected}
        leads={leads}
        currentPosition={activeScan?.average_position || null}
        rankedKeyword={activeScan?.keyword || ''}
        onUseKeyword={useKeywordFromResearch}
        onShowToast={onShowToast}
      />}

      <div className={`grid grid-cols-1 overflow-hidden rounded-2xl border border-[#c2c6d8]/45 bg-white dark:bg-[#141936] shadow-sm ${activeScan ? 'lg:grid-cols-[350px_1fr]' : ''}`}>
        {activeScan && <aside className="flex flex-col min-h-0 max-h-[520px] lg:min-h-[680px] lg:max-h-[760px] border-b lg:border-b-0 lg:border-r border-[#c2c6d8]/35 bg-white dark:bg-[#141936]">
          <div className="p-5 border-b border-[#c2c6d8]/30">
            <p className="text-xs text-[#727687]">Palavra-chave</p>
            <span className="inline-flex mt-1.5 px-3 py-1 rounded-full bg-[#0066ff] text-white text-xs font-semibold">{activeScan.keyword}</span>
            <div className="mt-4 p-4 rounded-2xl bg-[#f0f3ff] dark:bg-[#10142e]">
              <div className="flex items-start gap-3">
                <span className="shrink-0 px-2 py-1 rounded-lg bg-white text-rose-600 text-[10px] font-bold shadow-sm">
                  Pos. {activeScan.average_position ? Math.round(activeScan.average_position) : '20+'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{activeScanLead?.company_name || 'Empresa analisada'}</p>
                  <p className="text-[11px] text-[#727687] mt-1 line-clamp-2">{activeScanLead?.address}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-[11px]"><span>Visibilidade do negócio</span><strong>{Math.round(activeScan.visibility_percentage)}%</strong></div>
                <div className="h-2 mt-1.5 rounded-full bg-[#d9dce7] overflow-hidden"><div className="h-full rounded-full bg-[#0066ff]" style={{ width: `${Math.max(activeScan.visibility_percentage, 2)}%` }} /></div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[11px]"><span>Dificuldade da área</span><strong className={areaDifficulty === 'Alta' ? 'text-rose-600' : areaDifficulty === 'Média' ? 'text-amber-600' : 'text-emerald-600'}>{areaDifficulty}</strong></div>
                <div className="h-2 mt-1.5 rounded-full bg-[#d9dce7] overflow-hidden"><div className={`h-full rounded-full ${areaDifficulty === 'Alta' ? 'w-[88%] bg-rose-500' : areaDifficulty === 'Média' ? 'w-[58%] bg-amber-500' : 'w-[30%] bg-emerald-500'}`} /></div>
              </div>
              {activeScanLead?.google_maps_url && <a href={activeScanLead.google_maps_url} target="_blank" rel="noreferrer" className="inline-flex mt-3 text-xs font-medium text-[#0066ff] hover:underline">Abrir no Google ↗</a>}
            </div>
          </div>

          <div className="px-5 py-3 flex items-center justify-between border-b border-[#c2c6d8]/25">
            <div><p className="text-sm font-medium">Concorrentes</p><p className="text-[10px] text-[#727687]">Mais presentes nos pontos consultados</p></div>
            <span className="px-2 py-1 rounded-lg bg-[#f4f2fd] dark:bg-[#10142e] text-[10px] font-semibold">{competitors.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#c2c6d8]/25">
            {!competitors.length && <div className="p-6 text-center text-xs text-[#727687]">Gere uma nova grade para carregar os concorrentes encontrados pelo Google.</div>}
            {competitors.map(competitor => {
              const displayPosition = Math.max(1, Math.round(competitor.average_position));
              return <article key={competitor.id} className="p-4 flex gap-3">
                <CompetitorPhoto photoName={competitor.photo_name} companyName={competitor.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold leading-tight line-clamp-2">{competitor.name}</p><span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold ${displayPosition <= 3 ? 'bg-emerald-50 text-emerald-700' : displayPosition <= 10 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>Pos. {displayPosition}</span></div>
                  <p className="text-[10px] text-[#727687] mt-1 truncate">{competitor.address || 'Endereço não informado'}</p>
                  <p className="text-[10px] text-[#727687] mt-1">{competitor.category || activeScan.keyword}</p>
                  {competitor.rating !== null && <p className="flex items-center gap-1 text-[10px] mt-1 text-amber-500"><Star className="w-3 h-3 fill-current" /><strong>{competitor.rating.toFixed(1)}</strong><span className="text-[#727687]">({competitor.review_count})</span></p>}
                </div>
              </article>;
            })}
          </div>
        </aside>}

        <section className="relative overflow-hidden bg-[#eef2f6] min-h-[520px] sm:min-h-[680px]">
          {activeScan && <div className="absolute z-10 top-3 sm:top-4 left-1/2 -translate-x-1/2 max-w-[calc(100%-1.5rem)] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-white/95 shadow-xl border border-white flex items-center gap-2 text-[10px] sm:text-xs font-medium whitespace-nowrap"><Clock3 className="w-4 h-4 text-[#0066ff]" />{new Date(activeScan.created_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}</div>}
          {activeScan && <div className="absolute z-10 top-4 right-4 hidden xl:flex flex-col gap-1.5 p-2 rounded-xl bg-white/95 shadow-lg text-[9px] font-semibold">
            <span className="text-emerald-700">● 1–3</span><span className="text-amber-600">● 4–10</span><span className="text-rose-500">● 11–20</span><span className="text-rose-800">● 20+</span>
          </div>}
          {(loading || generatingGrid) && <div className="absolute inset-0 z-20 grid place-items-center bg-white/85 backdrop-blur-[2px]"><div className="text-center"><Loader2 className="w-7 h-7 animate-spin text-[#0066ff] mx-auto" /><p className="text-xs font-semibold mt-2">{generatingGrid ? `Consultando ${gridSize * gridSize} pontos…` : 'Carregando mapa…'}</p></div></div>}
          {!mapsKey
            ? <EmptyMap title="Chave do mapa ainda não configurada" detail="O administrador pode cadastrar a chave em Administração → Integrações." />
            : activeScan
              ? <GridMapCanvas scan={activeScan} mapsKey={mapsKey} onError={handleMapError}/>
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
            return <button key={scan.id} onClick={() => { setActiveScan(scan); setSelectedId(scan.lead_id); setActiveKeyword(scan.keyword); setGridSize(historyGridSize); }} className={`w-full p-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#f8f9fc] dark:hover:bg-[#10142e] ${activeScan?.id === scan.id ? 'bg-[#0066ff]/5' : ''}`}>
              <div>
                <p className="text-xs font-semibold">{lead?.company_name || 'Empresa'} <span className="font-normal text-[#727687]">• {scan.keyword}</span></p>
                <p className="text-[10px] text-[#727687] mt-0.5">{new Date(scan.created_at).toLocaleString('pt-BR')} • Grade {historyGridSize}×{historyGridSize} • Raio de 2 km</p>
              </div>
              <div className="flex gap-2 text-[10px] font-semibold"><span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700">Presença {Math.round(scan.visibility_percentage)}%</span><span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">Melhor {scan.best_position || '20+'}</span></div>
            </button>;
          })}
        </div>}
      </section>
      {keywordManagerOpen && selected && <div className="fixed inset-0 z-50 flex items-end sm:grid sm:place-items-center p-0 sm:p-4 bg-[#10142e]/55 backdrop-blur-sm">
        <div className="w-full max-w-lg max-h-[92dvh] rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35 shadow-2xl overflow-hidden mobile-safe-bottom">
          <div className="p-5 flex items-start justify-between border-b border-[#c2c6d8]/30">
            <div><h3 className="text-base font-semibold" style={{ fontFamily: "'Inter', sans-serif" }}>Gerenciar palavras-chave</h3><p className="text-xs text-[#727687] mt-1">Cada palavra-chave terá sua própria grade e histórico.</p></div>
            <button type="button" onClick={() => setKeywordManagerOpen(false)} className="p-2 rounded-lg hover:bg-[#f4f2fd] dark:hover:bg-[#10142e]" aria-label="Fechar"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
            {keywordDrafts.map((keyword, index) => <div key={index} className="flex items-center gap-2">
              <input aria-label={`Palavra-chave ${index + 1}`} value={keyword} onChange={event => setKeywordDrafts(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="flex-1 px-3 py-2.5 rounded-xl bg-[#f8f9fc] dark:bg-[#10142e] border border-[#c2c6d8]/45 text-sm outline-none focus:border-[#0066ff]" />
              <button type="button" disabled={keywordDrafts.length === 1} onClick={() => setKeywordDrafts(current => current.filter((_, itemIndex) => itemIndex !== index))} className="p-2.5 rounded-xl border border-[#c2c6d8]/45 text-rose-600 disabled:opacity-30 hover:bg-rose-50" aria-label={`Remover ${keyword}`}><Trash2 className="w-4 h-4" /></button>
            </div>)}
            <div className="flex items-center gap-2 pt-2">
              <input value={newKeyword} onChange={event => setNewKeyword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addKeywordDraft(); }} placeholder="Nova palavra-chave" className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-[#10142e] border border-dashed border-[#0066ff]/50 text-sm outline-none focus:border-[#0066ff]" />
              <button type="button" onClick={addKeywordDraft} className="px-3 py-2.5 rounded-xl bg-[#0066ff]/10 text-[#0066ff] text-xs font-semibold flex items-center gap-1"><Plus className="w-4 h-4" /> Adicionar</button>
            </div>
          </div>
          <div className="p-5 border-t border-[#c2c6d8]/30 flex justify-end gap-2">
            <button type="button" onClick={() => setKeywordManagerOpen(false)} className="px-4 py-2.5 rounded-xl border border-[#c2c6d8]/45 text-xs font-semibold">Cancelar</button>
            <button type="button" disabled={savingKeywords} onClick={() => void saveKeywords()} className="px-5 py-2.5 rounded-xl bg-[#0066ff] disabled:opacity-50 text-white text-xs font-semibold">{savingKeywords ? 'Salvando…' : 'Salvar palavras-chave'}</button>
          </div>
        </div>
      </div>}
      {error && <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</div>}
    </div>
  );
}

function CompetitorPhoto({ photoName, companyName }: { photoName: string | null; companyName: string }) {
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    if (!photoName || !supabase) return;
    let active = true;
    let objectUrl = '';
    const load = async () => {
      const { data } = await supabase!.auth.getSession();
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token || ''}`,
        },
        body: JSON.stringify({ action: 'photo', photoName }),
      });
      if (!response.ok || !active) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (active) setPhotoUrl(objectUrl);
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoName]);

  return photoUrl
    ? <Image src={photoUrl} alt="" width={48} height={48} unoptimized className="shrink-0 w-12 h-12 rounded-xl object-cover bg-[#eef2f6]" />
    : <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#e9efff] to-[#dce6ff] text-[#0066ff] grid place-items-center font-semibold text-sm">{companyName.slice(0, 2).toUpperCase()}</div>;
}

function EmptyMap({ title, detail }: { title: string; detail: string }) {
  return <div className="min-h-[680px] grid place-items-center p-8 text-center bg-gradient-to-br from-[#f8fafc] to-[#eef2f6] dark:from-[#141936] dark:to-[#10142e]"><div><Layers className="w-10 h-10 mx-auto text-[#0066ff]/70" /><p className="font-semibold mt-3">{title}</p><p className="text-xs text-[#727687] mt-1 max-w-sm">{detail}</p></div></div>;
}
