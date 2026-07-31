'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Crosshair, ExternalLink, Grid3X3, History, Info, Layers, Link2, Loader2, MapPin, Pencil, Plus, Sparkles, Star, Trash2, X } from 'lucide-react';
import { useLeads } from '@/hooks/use-leads';
import { Lead } from '@/lib/leads';
import { supabase } from '@/lib/supabase';
import { useAuthProfile } from '@/components/AuthGate';
import { GooglePlaceSearch, GooglePlaceSuggestion } from '@/components/GooglePlaceSearch';

interface HeatmapViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

type LatLng = { lat: number; lng: number };
type MapInstance = {
  fitBounds: (bounds: BoundsInstance) => void;
  setCenter: (center: LatLng) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
  addListener?: (eventName: string, handler: () => void) => { remove?: () => void };
};
type BoundsInstance = {
  extend: (position: LatLng) => void;
};
type MarkerInstance = {
  setMap?: (map: MapInstance | null) => void;
  map?: MapInstance | null;
  addListener?: (eventName: string, handler: () => void) => { remove?: () => void };
};
type CircleInstance = {
  setMap: (map: MapInstance | null) => void;
};
type MapsNamespace = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  LatLngBounds: new () => BoundsInstance;
  Marker?: new (options: Record<string, unknown>) => MarkerInstance;
  AdvancedMarkerElement?: new (options: Record<string, unknown>) => MarkerInstance;
  Circle: new (options: Record<string, unknown>) => CircleInstance;
  SymbolPath?: { CIRCLE: number };
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
  if (
    readyMaps
    && typeof readyMaps.Map === 'function'
    && (typeof readyMaps.AdvancedMarkerElement === 'function' || typeof readyMaps.Marker === 'function')
    && typeof readyMaps.Circle === 'function'
  ) {
    return Promise.resolve(readyMaps);
  }
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    let settled = false;
    const callbackName = '__localwayGoogleMapsReady';
    const callbackHost = window as unknown as Record<string, unknown>;
    const previous = document.querySelector<HTMLScriptElement>('script[data-localway-google-maps]');
    const loadTimeout = window.setTimeout(() => {
      fail('O Google Maps demorou demais para responder.');
    }, 15_000);
    const cleanup = () => {
      window.clearTimeout(loadTimeout);
      if (callbackHost[callbackName]) delete callbackHost[callbackName];
    };
    function fail(message = 'Falha ao carregar o Google Maps.') {
      if (settled) return;
      settled = true;
      cleanup();
      mapsPromise = null;
      reject(new Error(message));
    }
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
          AdvancedMarkerElement: markerLibrary.AdvancedMarkerElement || maps.AdvancedMarkerElement,
          Circle: mapLibrary.Circle || maps.Circle,
          SymbolPath: maps.SymbolPath,
          importLibrary: maps.importLibrary,
        };
        if (
          typeof completeMaps.Map !== 'function'
          || (typeof completeMaps.AdvancedMarkerElement !== 'function' && typeof completeMaps.Marker !== 'function')
          || typeof completeMaps.Circle !== 'function'
        ) {
          const missing = [
            typeof completeMaps.Map !== 'function' ? 'mapa-base' : '',
            typeof completeMaps.Circle !== 'function' ? 'áreas' : '',
            typeof completeMaps.AdvancedMarkerElement !== 'function' && typeof completeMaps.Marker !== 'function'
              ? 'marcadores'
              : '',
          ].filter(Boolean);
          throw new Error(`O Google Maps não liberou: ${missing.join(', ')}.`);
        }
        settled = true;
        cleanup();
        resolve(completeMaps);
      } catch (error) {
        settled = true;
        cleanup();
        mapsPromise = null;
        reject(error);
      }
    };
    callbackHost[callbackName] = () => void finish();
    if (previous) {
      if (window.google?.maps) void finish();
      else previous.addEventListener('error', () => fail(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&libraries=maps,marker&callback=${callbackName}&language=pt-BR&region=BR`;
    script.async = true;
    script.dataset.localwayGoogleMaps = 'true';
    script.addEventListener('error', () => fail(), { once: true });
    document.head.appendChild(script);
  });
  return mapsPromise;
}

function colorForPosition(position: number | null) {
  if (position === null) return '#2877d3';
  if (position <= 3) return '#5aa56a';
  if (position <= 10) return '#d67935';
  return '#d45757';
}

function scanGridSize(scan: VisibilityScan) {
  const sizeFromPoints = Math.sqrt(scan.points.length);
  return Number.isInteger(sizeFromPoints) ? sizeFromPoints : scan.grid_size;
}

function centerPointForScan(scan: VisibilityScan) {
  return scan.points.reduce<VisibilityPoint | null>((closest, point) => {
    if (!closest) return point;
    const pointDistance = ((point.latitude - scan.center_latitude) ** 2)
      + ((point.longitude - scan.center_longitude) ** 2);
    const closestDistance = ((closest.latitude - scan.center_latitude) ** 2)
      + ((closest.longitude - scan.center_longitude) ** 2);
    return pointDistance < closestDistance ? point : closest;
  }, null);
}

function keywordKey(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function registeredVisibilityKeywords(lead: Lead) {
  const values = Array.isArray(lead.analysis_data?.visibility_keywords)
    ? lead.analysis_data.visibility_keywords
    : [];
  return values
    .map(value => value.trim())
    .filter(value => value.length >= 2)
    .filter((value, index, keywords) =>
      keywords.findIndex(item => keywordKey(item) === keywordKey(value)) === index);
}

function GridMapCanvas({ scan, mapsKey, targetPlaceId, focusedPlaceId, focusedPlaceName, onError }: {
  scan: VisibilityScan;
  mapsKey: string;
  targetPlaceId: string | null;
  focusedPlaceId: string | null;
  focusedPlaceName: string;
  onError: (message: string) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapInstance | null>(null);
  const gridBounds = useRef<BoundsInstance | null>(null);
  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{
    row: number;
    column: number;
    position: number | null;
  } | null>(null);

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
        fullscreenControl: false,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        scrollwheel: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#f4f4f1' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#989b96' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#deded9' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f2' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeea' }] },
          { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -100 }, { lightness: 32 }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e9e9e4' }] },
          { featureType: 'transit', stylers: [{ saturation: -100 }, { lightness: 35 }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e4ecec' }] },
        ],
      });
      mapInstance.current = map;
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
      const pointRadius = 135;
      scan.points.forEach(point => {
        const position = { lat: point.latitude, lng: point.longitude };
        const focusedPosition = !focusedPlaceId || focusedPlaceId === targetPlaceId
          ? point.position
          : (() => {
              const index = (point.top_places || []).findIndex(place => place.id === focusedPlaceId);
              return index >= 0 ? index + 1 : null;
            })();
        bounds.extend(position);
        const circle = new maps.Circle({
          map,
          center: position,
          radius: pointRadius,
          fillColor: '#67ad75',
          fillOpacity: 0.18,
          strokeColor: '#67ad75',
          strokeOpacity: 0.08,
          strokeWeight: 0.5,
          clickable: false,
        });
        const markerTitle = focusedPosition
          ? `${focusedPlaceName}: posição ${focusedPosition} neste ponto`
          : `${focusedPlaceName}: fora dos resultados armazenados neste ponto`;
        const markerZIndex = focusedPosition === null ? 1 : Math.max(2, 30 - focusedPosition);
        const selectPoint = () => setSelectedPoint({
          row: point.row,
          column: point.column,
          position: focusedPosition,
        });
        let marker: MarkerInstance;
        if (maps.Marker && maps.SymbolPath) {
          marker = new maps.Marker({
            map,
            position,
            title: markerTitle,
            label: {
              text: focusedPosition ? String(focusedPosition) : '20+',
              color: '#ffffff',
              fontSize: focusedPosition ? '12px' : '9px',
              fontWeight: '700',
            },
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: colorForPosition(focusedPosition),
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeOpacity: 1,
              strokeWeight: 2.25,
              scale: 15.5,
            },
            zIndex: markerZIndex,
          });
          marker.addListener?.('click', selectPoint);
        } else if (maps.AdvancedMarkerElement) {
          const content = document.createElement('div');
          content.textContent = focusedPosition ? String(focusedPosition) : '20+';
          content.title = markerTitle;
          Object.assign(content.style, {
            width: '31px',
            height: '31px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '999px',
            border: '2.25px solid #ffffff',
            background: colorForPosition(focusedPosition),
            color: '#ffffff',
            fontSize: focusedPosition ? '12px' : '9px',
            fontWeight: '700',
            lineHeight: '1',
            boxShadow: '0 1px 4px rgba(31, 41, 55, 0.28)',
            cursor: 'pointer',
          });
          content.setAttribute('role', 'button');
          content.setAttribute('tabindex', '0');
          content.addEventListener('click', selectPoint);
          content.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') selectPoint();
          });
          marker = new maps.AdvancedMarkerElement({
            map,
            position,
            title: markerTitle,
            content,
            zIndex: markerZIndex,
          });
        } else {
          throw new Error('A biblioteca de marcadores do mapa não foi carregada.');
        }
        circles.push(circle);
        markers.push(marker);
      });
      map.fitBounds(bounds);
      gridBounds.current = bounds;
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
      mapInstance.current = null;
      gridBounds.current = null;
      markers.forEach(marker => {
        if (marker.setMap) marker.setMap(null);
        else marker.map = null;
      });
      circles.forEach(circle => circle.setMap(null));
    };
  }, [focusedPlaceId, focusedPlaceName, mapsKey, onError, scan, targetPlaceId]);

  return <div className="relative h-full min-h-[600px] w-full overflow-hidden bg-[#e9e8e2] lg:min-h-0">
    <div ref={node} className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-out ${mapReady ? 'opacity-100' : 'opacity-0'}`} />
    {!mapReady && !mapError && <div className="absolute inset-0 z-10 grid place-items-center bg-[#e9e8e2] transition-opacity duration-300">
      <div className="text-center"><Loader2 className="w-7 h-7 animate-spin text-[#0066ff] mx-auto" /><p className="text-xs font-semibold mt-2">Carregando mapa…</p></div>
    </div>}
    {mapError && <div className="absolute inset-0 z-10 grid place-items-center bg-gradient-to-br from-[#f8fafc] to-[#eef2f6] p-8 text-center">
      <div><MapPin className="w-10 h-10 mx-auto text-rose-500" /><p className="font-semibold mt-3">Não foi possível exibir o mapa</p><p className="text-xs text-[#727687] mt-1 max-w-md">{mapError}</p></div>
    </div>}
    {mapReady && selectedPoint && <div className="absolute z-20 left-1/2 bottom-5 -translate-x-1/2 max-w-[calc(100%-2rem)] rounded-xl border border-white/90 bg-white/95 px-4 py-3 shadow-[0_8px_30px_rgba(31,41,55,0.22)] backdrop-blur-sm">
      <button type="button" onClick={() => setSelectedPoint(null)} className="absolute right-2 top-2 text-[#8a8d94] hover:text-[#34363e]" aria-label="Fechar detalhe"><X className="w-3.5 h-3.5" /></button>
      <p className="pr-5 text-xs font-semibold text-[#34363e]">{focusedPlaceName}</p>
      <p className="mt-1 text-[11px] text-[#6e7179]">
        {selectedPoint.position
          ? `Posição ${selectedPoint.position} neste ponto da grade.`
          : 'Posição 20+: não apareceu entre os 20 primeiros resultados neste ponto.'}
      </p>
    </div>}
    {mapReady && <button type="button" onClick={() => {
      if (mapInstance.current && gridBounds.current) mapInstance.current.fitBounds(gridBounds.current);
    }} className="absolute bottom-4 right-3 z-20 grid h-10 w-10 place-items-center rounded-lg border border-[#dce1e8] bg-white text-[#4b5563] shadow-md hover:bg-[#f6f8fb]" title="Centralizar a grade" aria-label="Centralizar a grade"><Crosshair className="h-4 w-4" /></button>}
  </div>;
}

export function HeatmapView({ onShowToast }: HeatmapViewProps) {
  const profile = useAuthProfile();
  const { leads, archivedLeads, loading, error, createLead, updateLead } = useLeads();
  const allLeads = useMemo(() => [...leads, ...archivedLeads], [leads, archivedLeads]);
  const [selectedId, setSelectedId] = useState('');
  const [mapsKey, setMapsKey] = useState(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '');
  const [gridSize, setGridSize] = useState(5);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [resolvingProfile, setResolvingProfile] = useState(false);
  const [generatingGrid, setGeneratingGrid] = useState(false);
  const [scanHistory, setScanHistory] = useState<VisibilityScan[]>([]);
  const [activeScan, setActiveScan] = useState<VisibilityScan | null>(null);
  const [focusedPlaceId, setFocusedPlaceId] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [keywordManagerOpen, setKeywordManagerOpen] = useState(false);
  const [keywordDrafts, setKeywordDrafts] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [savingKeywords, setSavingKeywords] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [deletingScanId, setDeletingScanId] = useState('');
  const resolvingProfileRef = useRef(false);

  useEffect(() => {
    if (!setupOpen && !historyOpen && !keywordManagerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSetupOpen(false);
      setHistoryOpen(false);
      setKeywordManagerOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [historyOpen, keywordManagerOpen, setupOpen]);

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
        if (rows.length) {
          const latestScan = rows[0];
          setActiveScan(current => current || latestScan);
          setSelectedId(current => current || latestScan.lead_id);
          setActiveKeyword(current => current || latestScan.keyword);
          setGridSize(scanGridSize(latestScan));
          setSetupOpen(false);
          setHistoryOpen(false);
        }
      }
      if (active && scansRequest.error) {
        onShowToast('Não foi possível carregar as análises anteriores do mapa.', 'error');
      }
    };
    void loadConfiguration();
    return () => { active = false; };
  }, [onShowToast, profile.id]);

  const located = useMemo(
    () => allLeads.filter(lead => typeof lead.latitude === 'number' && typeof lead.longitude === 'number'),
    [allLeads],
  );
  const selected = located.find(lead => lead.id === selectedId) || null;
  const activeScanLead = activeScan ? allLeads.find(lead => lead.id === activeScan.lead_id) || null : null;
  const managedLead = selected || activeScanLead;
  const centerPoint = activeScan ? centerPointForScan(activeScan) : null;
  const targetPlace = (() => {
    if (!activeScan || !activeScanLead?.google_place_id) return null;
    for (const point of activeScan.points) {
      const match = (point.top_places || []).find(place => place.id === activeScanLead.google_place_id);
      if (match) return match;
    }
    return null;
  })();
  const keywordTabs = useMemo(() => {
    if (!managedLead) return [];
    return registeredVisibilityKeywords(managedLead);
  }, [managedLead]);
  const activeRegisteredKeyword = keywordTabs.find(keyword =>
    keywordKey(keyword) === keywordKey(activeKeyword));
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
      .map(place => ({
        ...place,
        average_position: place.total_position / place.appearances,
        center_position: centerPoint
          ? (() => {
              const index = (centerPoint.top_places || []).findIndex(item => item.id === place.id);
              return index >= 0 ? index + 1 : null;
            })()
          : null,
      }))
      .sort((a, b) => b.appearances - a.appearances || a.average_position - b.average_position)
      .slice(0, 20);
  }, [activeScan, activeScanLead?.google_place_id, centerPoint]);
  const focusedCompetitor = competitors.find(place => place.id === focusedPlaceId) || null;
  const displayedPlaceName = focusedCompetitor?.name || activeScanLead?.company_name || 'Empresa analisada';
  const handleMapError = useCallback((message: string) => onShowToast(message, 'error'), [onShowToast]);
  const selectKeyword = (keyword: string) => {
    if (!managedLead) return;
    setFocusedPlaceId('');
    setActiveKeyword(keyword);
    const scan = scanHistory.find(item => item.lead_id === managedLead.id && keywordKey(item.keyword) === keywordKey(keyword));
    setActiveScan(scan || null);
  };
  const openKeywordManager = () => {
    if (!managedLead) return;
    setKeywordDrafts(keywordTabs.length ? keywordTabs : ['']);
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
    if (!managedLead) return;
    const cleaned = keywordDrafts
      .map(value => value.trim())
      .filter(value => value.length >= 2)
      .filter((value, index, values) => values.findIndex(item => keywordKey(item) === keywordKey(value)) === index);
    if (!cleaned.length) return onShowToast('Mantenha pelo menos uma palavra-chave.', 'error');
    setSavingKeywords(true);
    const result = await updateLead(managedLead.id, {
      analysis_data: {
        ...(managedLead.analysis_data || {}),
        visibility_keywords: cleaned,
      },
    });
    setSavingKeywords(false);
    if (result.error) return onShowToast(result.error, 'error');
    const nextKeyword = cleaned.some(item => keywordKey(item) === keywordKey(activeKeyword)) ? activeKeyword : cleaned[0];
    setActiveKeyword(nextKeyword);
    setFocusedPlaceId('');
    setActiveScan(scanHistory.find(item => item.lead_id === managedLead.id && keywordKey(item.keyword) === keywordKey(nextKeyword)) || null);
    setKeywordManagerOpen(false);
    onShowToast('Palavras-chave atualizadas.', 'success');
  };
  const selectResolvedPlace = async (place: Partial<Lead> | GooglePlaceSuggestion, fallbackMapsUrl: string) => {
    if (!place.google_place_id || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') {
      throw new Error('O Google não retornou a identificação e as coordenadas dessa empresa.');
    }

    const existing = allLeads.find(lead => lead.google_place_id === place.google_place_id);
    if (existing) {
      const incomingAnalysis = place.analysis_data && typeof place.analysis_data === 'object'
        ? place.analysis_data as Lead['analysis_data']
        : null;
      if (incomingAnalysis) {
        const refreshed = await updateLead(existing.id, {
          analysis_data: {
            ...(existing.analysis_data || {}),
            ...incomingAnalysis,
          },
        });
        if (refreshed.error) throw new Error(refreshed.error);
      }
      const existingKeywords = registeredVisibilityKeywords(existing);
      setSelectedId(existing.id);
      setActiveKeyword(existingKeywords[0] || '');
      if (!existingKeywords.length) {
        setKeywordDrafts(['']);
        setNewKeyword('');
        setKeywordManagerOpen(true);
      }
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
        google_maps_url: place.google_maps_url || fallbackMapsUrl,
        website_url: place.website_url || null,
        rating: place.rating ?? null,
        review_count: place.review_count ?? null,
        photo_count: place.photo_count ?? null,
        has_website: place.has_website ?? null,
        health_score: place.health_score ?? null,
        opportunity: place.opportunity || null,
        latitude: place.latitude,
        longitude: place.longitude,
        analysis_data: place.analysis_data && typeof place.analysis_data === 'object'
          ? place.analysis_data as Lead['analysis_data']
          : {},
        analysed_at: place.analysed_at || new Date().toISOString(),
        source: 'manual',
        status: 'novo',
        next_action_at: null,
      });
      if (created.error || !created.data) throw new Error(created.error || 'Não foi possível salvar a empresa.');
      const createdKeywords = registeredVisibilityKeywords(created.data);
      setSelectedId(created.data.id);
      setActiveKeyword(createdKeywords[0] || '');
      if (!createdKeywords.length) {
        setKeywordDrafts(['']);
        setNewKeyword('');
        setKeywordManagerOpen(true);
      }
    }

    setGoogleMapsUrl(place.google_maps_url || fallbackMapsUrl);
    setFocusedPlaceId('');
    setActiveScan(null);
    setSetupOpen(true);
  };
  const resolveGoogleProfile = async (selectedUrl?: string) => {
    if (resolvingProfileRef.current) return;
    const mapsUrl = selectedUrl?.trim() || googleMapsUrl.trim();
    if (!supabase || !mapsUrl) {
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
          googleMapsUrl: mapsUrl,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível localizar esse perfil.');
      const place = result.place as Partial<Lead>;
      await selectResolvedPlace(place, mapsUrl);
      onShowToast('Perfil carregado. O segmento foi identificado automaticamente.', 'success');
    } catch (requestError) {
      onShowToast(requestError instanceof Error ? requestError.message : 'Erro ao carregar o perfil.', 'error');
    } finally {
      resolvingProfileRef.current = false;
      setResolvingProfile(false);
    }
  };

  const chooseSuggestion = async (place: GooglePlaceSuggestion) => {
    if (resolvingProfileRef.current) return;
    resolvingProfileRef.current = true;
    setResolvingProfile(true);
    try {
      await selectResolvedPlace(place, place.google_maps_url);
      onShowToast(`${place.company_name} selecionada.`, 'success');
    } catch (selectionError) {
      onShowToast(selectionError instanceof Error ? selectionError.message : 'Erro ao selecionar a empresa.', 'error');
    } finally {
      resolvingProfileRef.current = false;
      setResolvingProfile(false);
    }
  };
  const deleteHistoryScan = async (scan: VisibilityScan) => {
    if (!supabase || deletingScanId) return;
    const confirmed = window.confirm(`Apagar a análise de “${scan.keyword}”? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;

    setDeletingScanId(scan.id);
    const { data, error: deleteError } = await supabase
      .from('local_visibility_scans')
      .delete()
      .eq('id', scan.id)
      .eq('created_by', profile.id)
      .select('id');
    setDeletingScanId('');

    if (deleteError) {
      onShowToast(deleteError.message || 'Não foi possível apagar a análise.', 'error');
      return;
    }
    if (!data?.length) {
      onShowToast('A análise não foi encontrada ou você não tem permissão para apagá-la.', 'error');
      return;
    }

    setScanHistory(current => current.filter(item => item.id !== scan.id));
    if (activeScan?.id === scan.id) {
      setActiveScan(null);
      setSelectedId('');
      setActiveKeyword('');
      setFocusedPlaceId('');
    }
    onShowToast('Análise apagada.', 'success');
  };

  const runVisibilityGrid = async () => {
    if (!supabase || !selected) return;
    if (!selected.google_place_id || typeof selected.latitude !== 'number' || typeof selected.longitude !== 'number') {
      return onShowToast('Selecione uma empresa gerada pelo Google e com coordenadas válidas.', 'error');
    }
    const searchKeyword = activeKeyword.trim();
    const registeredKeyword = activeRegisteredKeyword
      && keywordKey(activeRegisteredKeyword) === keywordKey(searchKeyword)
      ? activeRegisteredKeyword
      : null;
    if (!registeredKeyword) {
      return onShowToast('Selecione uma palavra-chave cadastrada antes de gerar o mapa.', 'error');
    }
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
        keyword: registeredKeyword,
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
    setFocusedPlaceId('');
    setSetupOpen(false);
    setScanHistory(current => [scan, ...current.filter(item => item.id !== scan.id)].slice(0, 20));
    onShowToast(`Grade ${gridSize}×${gridSize} calculada e salva no histórico.`);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--bg-main)] lg:overflow-hidden">
      <section className="flex shrink-0 items-center gap-2 overflow-hidden border-b border-[var(--border-color)] bg-white px-3 py-2 dark:bg-[var(--surface-main)]">
        <button type="button" onClick={() => setSetupOpen(current => !current)} className="lw-secondary-button h-9 shrink-0 px-3.5 text-[13px]"><Sparkles className="h-4 w-4"/>{setupOpen ? 'Fechar análise' : 'Nova análise'}</button>
        <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
          <div className="flex gap-1.5">
            {keywordTabs.map(keyword => <button key={keyword} type="button" onClick={() => selectKeyword(keyword)} className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${keywordKey(activeKeyword) === keywordKey(keyword) ? 'border-[#1268ff] bg-blue-50 text-[#1268ff]' : 'border-[var(--border-color)] bg-[var(--surface-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-container-low)]'}`}>{keyword}</button>)}
            {!keywordTabs.length && <span className="px-2 py-1.5 text-[13px] text-[var(--text-secondary)]">Selecione uma empresa para começar</span>}
          </div>
        </div>
        {managedLead && <button type="button" onClick={openKeywordManager} className="lw-secondary-button h-9 shrink-0 px-3 text-[13px]" title="Gerenciar palavras-chave"><Pencil className="h-4 w-4"/><span className="hidden sm:inline">Gerenciar palavras-chave</span></button>}
        <button type="button" onClick={() => setHistoryOpen(current => !current)} className="lw-secondary-button h-9 shrink-0 px-3 text-[13px]"><History className="h-4 w-4"/><span className="hidden sm:inline">Histórico</span></button>
      </section>

      {setupOpen && <>
      <button type="button" className="fixed inset-0 z-40 cursor-default bg-[#10142e]/25 backdrop-blur-[1px]" onClick={() => setSetupOpen(false)} aria-label="Fechar nova análise" />
      <section className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] space-y-3 overflow-y-auto rounded-t-2xl border border-[var(--border-color)] bg-white p-4 shadow-2xl sm:inset-auto sm:right-4 sm:top-16 sm:w-[560px] sm:rounded-xl dark:bg-[var(--surface-main)]">
        <GooglePlaceSearch module="mapa" disabled={resolvingProfile} onSelect={chooseSuggestion}/>
        <div className="flex items-center gap-3"><span className="h-px flex-1 bg-[var(--border-subtle)]"/><span className="text-[11px] font-semibold uppercase text-[var(--text-secondary)]">ou cole o link</span><span className="h-px flex-1 bg-[var(--border-subtle)]"/></div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1"><Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" /><input type="url" value={googleMapsUrl} onChange={event => setGoogleMapsUrl(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void resolveGoogleProfile(); }} placeholder="Cole o link curto ou completo do perfil no Google Maps" className="lw-input w-full pl-9 pr-3 py-2 text-sm"/></div>
          <button disabled={resolvingProfile || !googleMapsUrl.trim()} onClick={() => void resolveGoogleProfile()} className="lw-secondary-button px-5 disabled:opacity-50">{resolvingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}{resolvingProfile ? 'Identificando...' : 'Carregar perfil'}</button>
        </div>
        {selected && <div className="grid gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-container-low)] p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
          <div className="min-w-0"><p className="truncate text-[14px] font-semibold">{selected.company_name}</p><p className="truncate text-[12px] text-[var(--text-secondary)]">{selected.category || 'Categoria identificada pelo Google'}</p></div>
          <span className="rounded-md border bg-[var(--surface-main)] px-3 py-2 text-center text-[13px]">Raio 2 km</span>
          <select aria-label="Tamanho da grade" value={gridSize} onChange={event => setGridSize(Number(event.target.value))} className="h-9 rounded-md border border-[var(--border-color)] bg-[var(--surface-main)] px-2 text-[13px]">{[3, 4, 5, 6, 7].map(size => <option key={size} value={size}>{size}×{size} ({size * size} pontos)</option>)}</select>
          <button disabled={generatingGrid || !activeRegisteredKeyword} onClick={() => void runVisibilityGrid()} className="lw-primary-button px-4 disabled:opacity-50">{generatingGrid ? <Loader2 className="w-4 h-4 animate-spin"/> : <Grid3X3 className="w-4 h-4"/>}{generatingGrid ? `Consultando ${gridSize * gridSize} pontos…` : 'Iniciar análise'}</button>
        </div>}
      </section></>}

      <div className={`heatmap-shell grid min-h-[600px] flex-1 grid-cols-1 overflow-hidden bg-white ${activeScan ? 'lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
        {activeScan && <aside className="order-2 flex min-h-0 flex-col border-t border-[#e2e3e8] bg-[#f8f9fc] p-3 text-[#222631] lg:order-2 lg:border-l lg:border-t-0">
          <div className="rounded-xl border border-[#dde2ea] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
            <div className="flex items-start gap-3">
              <CompetitorPhoto photoName={targetPlace?.photo_name || activeScanLead?.analysis_data?.photo_name || null} companyName={activeScanLead?.company_name || 'Empresa analisada'} size="large" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold leading-5">{activeScanLead?.company_name || 'Empresa analisada'}</p>
                <p className="mt-0.5 truncate text-[13px] text-[#667085]">Palavra-chave: {activeScan.keyword}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#f1f3f7] px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#667085]">Posição média</p>
                <p className="mt-0.5 text-[22px] font-bold tabular-nums">{activeScan.average_position ? activeScan.average_position.toFixed(1) : '20+'}</p>
              </div>
              <div className="rounded-lg bg-[#f1f3f7] px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#667085]">Visibilidade</p>
                <p className="mt-0.5 text-[22px] font-bold tabular-nums text-[#1268ff]">{Math.round(activeScan.visibility_percentage)}%</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {activeScanLead?.google_maps_url && <a href={activeScanLead.google_maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1268ff] hover:underline">Abrir no Google <ExternalLink className="h-3.5 w-3.5" /></a>}
              <p className="text-[11px] text-[#667085]">Análise de {new Date(activeScan.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
            </div>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center gap-1.5 px-0.5">
              <p className="text-[14px] font-semibold">Concorrentes ({competitors.length})</p>
              <InfoTip text="Empresas encontradas pelo Google nesta grade. Clique em um concorrente para ver a posição dele em cada ponto do mapa." />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-[#e3e7ee] rounded-xl border border-[#dde2ea] bg-white">
            {!competitors.length && <div className="p-6 text-center text-[13px] text-[#667085]">Gere uma nova grade para carregar os concorrentes encontrados pelo Google.</div>}
            {competitors.map(competitor => {
              const displayPosition = competitor.center_position || Math.max(1, Math.round(competitor.average_position));
              const isFocused = competitor.id === focusedPlaceId;
              return <button type="button" key={competitor.id} onClick={() => setFocusedPlaceId(competitor.id)} className={`group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-[#f6f8fb] ${isFocused ? 'bg-blue-50 ring-1 ring-inset ring-[#1268ff]/20' : ''}`}>
                  <CompetitorPhoto photoName={competitor.photo_name} companyName={competitor.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold leading-5 text-[#222631]">{competitor.name}</p>
                    <p className="truncate text-[12px] leading-4 text-[#667085]">{competitor.address || 'Endereço não informado'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#667085]">
                      <span className="max-w-[160px] truncate rounded bg-[#f1f3f7] px-1.5 py-0.5">{competitor.category || activeScan.keyword}</span>
                      {competitor.rating !== null && <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-[#f2a11a] text-[#f2a11a]" /><strong>{competitor.rating.toFixed(1)}</strong> ({competitor.review_count})</span>}
                    </div>
                    {isFocused && <p className="mt-1 text-[11px] font-semibold text-[#1268ff]">Exibindo posições no mapa</p>}
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-1 text-[12px] font-bold tabular-nums ${displayPosition <= 3 ? 'bg-emerald-100 text-emerald-700' : displayPosition <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>#{displayPosition > 20 ? '20+' : displayPosition}</span>
              </button>;
            })}
            </div>
          </div>
        </aside>}

        <section className="order-1 relative min-h-[600px] overflow-hidden bg-[#e9e8e2] lg:min-h-0">
          {activeScan && <div className="absolute left-3 top-3 z-10 max-w-[70%] rounded-lg border border-[#dde2ea] bg-white/95 px-3 py-2 shadow-[0_1px_3px_rgba(16,24,40,0.12)] backdrop-blur"><p className="truncate text-[13px] font-semibold">{activeScan.keyword}</p><p className="truncate text-[11px] text-[#667085]">{new Date(activeScan.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · grade {scanGridSize(activeScan)}×{scanGridSize(activeScan)} · raio 2 km</p></div>}
          {(loading || generatingGrid) && <div className="absolute inset-0 z-20 grid place-items-center bg-white/85 backdrop-blur-[2px]"><div className="text-center"><Loader2 className="w-7 h-7 animate-spin text-[#0066ff] mx-auto" /><p className="text-xs font-semibold mt-2">{generatingGrid ? `Consultando ${gridSize * gridSize} pontos…` : 'Carregando mapa…'}</p></div></div>}
          {!mapsKey
            ? <EmptyMap title="Chave do mapa ainda não configurada" detail="O administrador pode cadastrar a chave em Administração → Integrações." />
            : activeScan
              ? <GridMapCanvas
                  scan={activeScan}
                  mapsKey={mapsKey}
                  targetPlaceId={activeScanLead?.google_place_id || null}
                  focusedPlaceId={focusedPlaceId || activeScanLead?.google_place_id || null}
                  focusedPlaceName={displayedPlaceName}
                  onError={handleMapError}
                />
              : <EmptyMap title="Pronto para analisar" detail="Cole o link do perfil do Google Maps acima. O sistema identifica a empresa e o segmento automaticamente." />}
        </section>
      </div>

      {historyOpen && <>
      <button type="button" className="fixed inset-0 z-40 cursor-default bg-[#10142e]/25 backdrop-blur-[1px]" onClick={() => setHistoryOpen(false)} aria-label="Fechar histórico" />
      <section className="fixed inset-y-0 right-0 z-50 w-[min(92vw,430px)] overflow-y-auto border-l border-[var(--border-color)] bg-white shadow-2xl dark:bg-[var(--surface-main)]">
        <button type="button" onClick={() => setHistoryOpen(current => !current)} className="w-full p-4 flex items-center gap-2 text-left hover:bg-[#f8f9fc] dark:hover:bg-[#10142e] transition-colors" aria-expanded={historyOpen}>
          <History className="w-4 h-4 text-[#0066ff]"/>
          <div className="flex-1">
            <h3 className="text-[16px] font-semibold tracking-tight">Histórico de mapas</h3>
            <p className="text-[12px] text-[#727687]">{scanHistory.length ? `${scanHistory.length} análise${scanHistory.length === 1 ? '' : 's'} anterior${scanHistory.length === 1 ? '' : 'es'}.` : 'Nenhuma análise anterior.'}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#727687] transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`} />
        </button>
        {historyOpen && (!scanHistory.length ? <div className="p-8 border-t border-[#c2c6d8]/30 text-center text-xs text-[#727687]">Nenhum mapa gerado ainda.</div> : <div className="border-t border-[#c2c6d8]/30 divide-y divide-[#c2c6d8]/25">
          {scanHistory.map(scan => {
            const lead = allLeads.find(item => item.id === scan.lead_id);
            const historyGridSize = scanGridSize(scan);
            return <div key={scan.id} className={`flex items-stretch hover:bg-[#f8f9fc] dark:hover:bg-[#10142e] transition-colors ${activeScan?.id === scan.id ? 'bg-[#0066ff]/5' : ''}`}>
              <button type="button" onClick={() => { setActiveScan(scan); setSelectedId(scan.lead_id); setActiveKeyword(scan.keyword); setFocusedPlaceId(''); setGridSize(historyGridSize); }} className="min-w-0 flex-1 p-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold">{lead?.company_name || 'Empresa'} <span className="font-normal text-[#727687]">• {scan.keyword}</span></p>
                  <p className="mt-0.5 text-[12px] text-[#727687]">{new Date(scan.created_at).toLocaleString('pt-BR')} • Grade {historyGridSize}×{historyGridSize} • Raio de 2 km</p>
                </div>
                <div className="flex gap-2 text-[12px] font-semibold"><span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700">Presença {Math.round(scan.visibility_percentage)}%</span><span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">Melhor {scan.best_position || '20+'}</span></div>
              </button>
              <button type="button" disabled={Boolean(deletingScanId)} onClick={() => void deleteHistoryScan(scan)} className="shrink-0 w-12 grid place-items-center text-[#9a9daa] hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition-colors" aria-label={`Apagar análise de ${scan.keyword}`} title="Apagar análise">
                {deletingScanId === scan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>;
          })}
        </div>)}
      </section></>}
      {keywordManagerOpen && managedLead && <div onMouseDown={() => setKeywordManagerOpen(false)} className="fixed inset-0 z-50 flex items-end sm:grid sm:place-items-center p-0 sm:p-4 bg-[#10142e]/55 backdrop-blur-sm">
        <div onMouseDown={event => event.stopPropagation()} className="w-full max-w-lg max-h-[92dvh] rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35 shadow-2xl overflow-hidden mobile-safe-bottom">
          <div className="p-5 flex items-start justify-between border-b border-[#c2c6d8]/30">
            <div><h3 className="text-base font-semibold">Gerenciar palavras-chave</h3><p className="text-xs text-[#727687] mt-1">Cada palavra-chave terá sua própria grade e histórico.</p></div>
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

function InfoTip({ text }: { text: string }) {
  return <span className="group/info relative inline-flex shrink-0">
    <button type="button" aria-label={text} className="rounded-full text-[#9a9ca3] hover:text-[#3978d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978d4]/40">
      <Info className="w-3 h-3" />
    </button>
    <span role="tooltip" className="pointer-events-none invisible absolute z-50 left-1/2 bottom-[calc(100%+7px)] w-56 -translate-x-1/2 rounded-lg bg-[#252832] px-3 py-2 text-[10px] font-normal leading-4 text-white opacity-0 shadow-xl transition-opacity group-hover/info:visible group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:opacity-100">
      {text}
    </span>
  </span>;
}

function CompetitorPhoto({ photoName, companyName, size = 'normal' }: {
  photoName: string | null;
  companyName: string;
  size?: 'normal' | 'large';
}) {
  const [photoUrl, setPhotoUrl] = useState('');
  const sizeClass = size === 'large' ? 'w-14 h-14' : 'w-12 h-12';

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
    ? <Image src={photoUrl} alt={companyName} width={size === 'large' ? 56 : 48} height={size === 'large' ? 56 : 48} unoptimized onError={() => setPhotoUrl('')} className={`shrink-0 ${sizeClass} rounded-[3px] object-cover bg-[#e8ebee]`} />
    : <div className={`shrink-0 ${sizeClass} rounded-[3px] bg-gradient-to-br from-[#d9e1ea] to-[#b8c6d4] text-[#3978d4] grid place-items-center font-semibold text-sm`}>{companyName.slice(0, 2).toUpperCase()}</div>;
}

function EmptyMap({ title, detail }: { title: string; detail: string }) {
  return <div className="min-h-[680px] grid place-items-center p-8 text-center bg-gradient-to-br from-[#f8fafc] to-[#eef2f6] dark:from-[#141936] dark:to-[#10142e]"><div><Layers className="w-10 h-10 mx-auto text-[#0066ff]/70" /><p className="font-semibold mt-3">{title}</p><p className="text-xs text-[#727687] mt-1 max-w-sm">{detail}</p></div></div>;
}
