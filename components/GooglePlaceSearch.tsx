'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Loader2, MapPin, Search, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type GooglePlaceSuggestion = {
  google_place_id: string;
  company_name: string;
  category: string | null;
  address: string | null;
  google_maps_url: string;
  rating: number | null;
  review_count: number;
};

interface GooglePlaceSearchProps {
  module: 'analises' | 'mapa';
  onSelect: (place: GooglePlaceSuggestion) => void | Promise<void>;
  disabled?: boolean;
}

export function GooglePlaceSearch({ module, onSelect, disabled = false }: GooglePlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || disabled) {
      return;
    }
    const sequence = ++requestSequence.current;
    const timer = window.setTimeout(async () => {
      if (!supabase) return;
      setLoading(true);
      setMessage('');
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token || ''}`,
        },
        body: JSON.stringify({ action: 'suggest', module, query: term }),
      });
      const result = await response.json().catch(() => ({ error: 'A busca não respondeu corretamente.' }));
      if (sequence !== requestSequence.current) return;
      setLoading(false);
      if (!response.ok) {
        setSuggestions([]);
        setMessage(result.error || 'Não foi possível buscar empresas.');
        return;
      }
      const rows = (result.suggestions || []) as GooglePlaceSuggestion[];
      setSuggestions(rows);
      setMessage(rows.length ? '' : 'Nenhuma empresa encontrada. Tente incluir o bairro ou a cidade.');
      setOpen(true);
    }, 380);
    return () => window.clearTimeout(timer);
  }, [disabled, module, query]);

  const choose = async (place: GooglePlaceSuggestion) => {
    requestSequence.current += 1;
    setQuery(place.company_name);
    setSuggestions([]);
    setMessage('');
    setOpen(false);
    await onSelect(place);
  };

  return <div className="relative">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0066ff]" />
      <input
        value={query}
        disabled={disabled}
        onChange={event => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          if (value.trim().length < 2) {
            requestSequence.current += 1;
            setSuggestions([]);
            setMessage('');
            setLoading(false);
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && suggestions[0]) {
            event.preventDefault();
            void choose(suggestions[0]);
          }
        }}
        placeholder="Digite o nome da empresa, bairro ou cidade"
        autoComplete="off"
        className="w-full min-h-12 pl-10 pr-10 py-3 rounded-xl bg-[#f8f9fc] dark:bg-[#10142e] border border-[#0066ff]/30 text-sm outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10 disabled:opacity-50"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0066ff] animate-spin" />}
    </div>
    {open && !disabled && (suggestions.length > 0 || message) && <div className="absolute z-40 left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-[#c2c6d8]/45 bg-white dark:bg-[#141936] shadow-2xl">
      {message && <p className="p-4 text-xs text-[#727687]">{message}</p>}
      {suggestions.map(place => <button
        key={place.google_place_id}
        type="button"
        onMouseDown={event => event.preventDefault()}
        onClick={() => void choose(place)}
        className="w-full p-3 sm:p-4 flex items-start gap-3 text-left border-b last:border-b-0 border-[#c2c6d8]/20 hover:bg-[#0066ff]/5 focus:bg-[#0066ff]/5 outline-none"
      >
        <span className="w-9 h-9 shrink-0 rounded-xl bg-[#0066ff]/10 text-[#0066ff] grid place-items-center"><Building2 className="w-4 h-4"/></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs sm:text-sm font-bold truncate">{place.company_name}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[10px] sm:text-[11px] text-[#727687]"><MapPin className="w-3 h-3 shrink-0"/><span className="truncate">{place.address || 'Endereço não informado'}</span></span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#727687]">
            <span>{place.category || 'Categoria não informada'}</span>
            {place.rating !== null && <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-500 fill-amber-500"/>{place.rating.toFixed(1)} ({place.review_count})</span>}
          </span>
        </span>
      </button>)}
    </div>}
    <p className="mt-1.5 text-[10px] text-[#727687]">As sugestões vêm do Google Places. Inclua a cidade ou o bairro para identificar a unidade correta.</p>
  </div>;
}
