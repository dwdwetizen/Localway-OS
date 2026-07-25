import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type PlaceRecord = Record<string, unknown>;
type AnalysisRecommendation = {
  title: string;
  detail: string;
  priority: 'alta' | 'media' | 'baixa';
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

const searchFieldMask = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.googleMapsUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.photos',
  'places.location',
  'places.regularOpeningHours',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
].join(',');

const detailFieldMask = searchFieldMask
  .split(',')
  .map(field => field.replace(/^places\./, ''))
  .join(',');

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readText(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function readDisplayName(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  return readText((value as Record<string, unknown>).text);
}

function readLocation(value: unknown) {
  if (!value || typeof value !== 'object') return { latitude: null, longitude: null };
  const location = value as Record<string, unknown>;
  const latitude = typeof location.latitude === 'number' ? location.latitude : null;
  const longitude = typeof location.longitude === 'number' ? location.longitude : null;
  return { latitude, longitude };
}

function openingHoursCount(value: unknown) {
  if (!value || typeof value !== 'object') return 0;
  const descriptions = (value as Record<string, unknown>).weekdayDescriptions;
  return Array.isArray(descriptions) ? descriptions.length : 0;
}

function analysePlace(place: PlaceRecord) {
  const hasWebsite = Boolean(place.websiteUri);
  const hasPhone = Boolean(place.nationalPhoneNumber || place.internationalPhoneNumber);
  const hasAddress = Boolean(place.formattedAddress);
  const rating = Number(place.rating || 0);
  const reviews = Number(place.userRatingCount || 0);
  const photos = Array.isArray(place.photos) ? place.photos.length : 0;
  const hoursCount = openingHoursCount(place.regularOpeningHours);
  const isOperational = place.businessStatus === 'OPERATIONAL';

  const reputation = clamp((rating / 5) * 70 + Math.min(reviews / 100, 1) * 30);
  const visibility = clamp(Math.min(reviews / 100, 1) * 65 + Math.min(photos / 10, 1) * 35);
  const completeness = clamp(
    [hasWebsite, hasPhone, hasAddress, hoursCount > 0, isOperational].filter(Boolean).length * 20,
  );
  const conversion = clamp(
    (hasWebsite ? 30 : 0)
      + (hasPhone ? 25 : 0)
      + (rating >= 4.3 ? 25 : rating >= 4 ? 15 : 0)
      + (reviews >= 30 ? 20 : reviews >= 10 ? 10 : 0),
  );
  const healthScore = clamp(
    reputation * 0.35 + visibility * 0.25 + completeness * 0.25 + conversion * 0.15,
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: AnalysisRecommendation[] = [];

  if (rating >= 4.3) strengths.push(`Boa reputação: nota ${rating.toFixed(1)} no Google.`);
  else {
    weaknesses.push(rating ? `Nota atual de ${rating.toFixed(1)} pode reduzir conversões.` : 'Perfil sem nota pública disponível.');
    recommendations.push({
      title: 'Fortalecer a reputação',
      detail: 'Criar uma rotina de solicitação e acompanhamento de avaliações legítimas.',
      priority: 'alta',
    });
  }

  if (reviews >= 30) strengths.push(`Volume relevante de avaliações: ${reviews}.`);
  else {
    weaknesses.push(`Baixo volume de avaliações (${reviews}).`);
    recommendations.push({
      title: 'Aumentar avaliações',
      detail: 'Solicitar avaliações após cada atendimento e responder os novos comentários.',
      priority: reviews < 10 ? 'alta' : 'media',
    });
  }

  if (hasWebsite) strengths.push('Perfil possui site cadastrado.');
  else {
    weaknesses.push('Perfil sem site cadastrado.');
    recommendations.push({
      title: 'Adicionar presença digital',
      detail: 'Cadastrar um site ou página de conversão com WhatsApp e informações da empresa.',
      priority: 'alta',
    });
  }

  if (hasPhone) strengths.push('Telefone disponível para contato.');
  else {
    weaknesses.push('Telefone não encontrado no perfil.');
    recommendations.push({
      title: 'Cadastrar telefone',
      detail: 'Adicionar um número válido para facilitar ligações e conversões.',
      priority: 'alta',
    });
  }

  if (hoursCount > 0) strengths.push('Horários de funcionamento cadastrados.');
  else {
    weaknesses.push('Horários de funcionamento não identificados.');
    recommendations.push({
      title: 'Completar horários',
      detail: 'Cadastrar e manter os horários atualizados, inclusive em feriados.',
      priority: 'media',
    });
  }

  if (photos >= 5) strengths.push('Boa quantidade de fotos disponível na consulta.');
  else {
    weaknesses.push(`Poucas fotos retornadas pela consulta (${photos}).`);
    recommendations.push({
      title: 'Melhorar conteúdo visual',
      detail: 'Publicar fotos atuais da fachada, equipe, produtos e serviços.',
      priority: 'media',
    });
  }

  const summary = healthScore >= 80
    ? 'Perfil forte e completo, com oportunidades pontuais de diferenciação local.'
    : healthScore >= 60
      ? 'Perfil razoável, mas ainda existem pontos claros para melhorar visibilidade e conversão.'
      : 'Perfil com lacunas importantes e boa oportunidade comercial para otimização local.';

  return {
    has_website: hasWebsite,
    rating,
    review_count: reviews,
    photo_count: photos,
    health_score: healthScore,
    opportunity: summary,
    analysis_data: {
      summary,
      strengths,
      weaknesses,
      recommendations,
      metrics: { reputation, visibility, completeness, conversion },
      business_status: readText(place.businessStatus),
      opening_hours_count: hoursCount,
    },
    analysed_at: new Date().toISOString(),
  };
}

function mapPlace(place: PlaceRecord, fallbackCategory = '', fallbackCity = '') {
  const type = readDisplayName(place.primaryTypeDisplayName);
  const location = readLocation(place.location);
  return {
    google_place_id: readText(place.id),
    company_name: readDisplayName(place.displayName) || 'Empresa sem nome',
    category: type || fallbackCategory || null,
    city: fallbackCity || null,
    address: readText(place.formattedAddress),
    phone: readText(place.nationalPhoneNumber) || readText(place.internationalPhoneNumber),
    whatsapp: readText(place.nationalPhoneNumber) || readText(place.internationalPhoneNumber),
    google_maps_url: readText(place.googleMapsUri),
    website_url: readText(place.websiteUri),
    latitude: location.latitude,
    longitude: location.longitude,
    ...analysePlace(place),
  };
}

function isGoogleMapsHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'maps.app.goo.gl'
    || host === 'goo.gl'
    || host === 'google.com'
    || host.endsWith('.google.com')
    || host === 'google.com.br'
    || host.endsWith('.google.com.br');
}

function extractPlaceReference(value: string) {
  const url = new URL(value);
  const directId = url.searchParams.get('query_place_id');
  if (directId) return { placeId: directId, query: '' };

  const dataPlaceId = decodeURIComponent(url.href).match(/!1s(ChI[^!/?&]+)/)?.[1] || '';
  const placePath = decodeURIComponent(url.pathname).match(/\/place\/([^/]+)/)?.[1] || '';
  const query = (url.searchParams.get('query') || placePath)
    .replace(/\+/g, ' ')
    .trim();
  return { placeId: dataPlaceId, query };
}

async function placeFromGoogleMapsUrl(rawUrl: string, apiKey: string) {
  let submitted: URL;
  try {
    submitted = new URL(rawUrl);
  } catch {
    throw new Error('Cole um link válido do Google Maps.');
  }
  if (!isGoogleMapsHost(submitted.hostname)) {
    throw new Error('O link precisa ser do Google Maps.');
  }

  let resolvedUrl = submitted.href;
  if (submitted.hostname === 'maps.app.goo.gl' || submitted.hostname === 'goo.gl') {
    const expanded = await fetch(submitted.href, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'LocalWay-OS/1.0' },
    });
    resolvedUrl = expanded.url;
  }

  const resolved = new URL(resolvedUrl);
  if (!isGoogleMapsHost(resolved.hostname)) {
    throw new Error('O link curto não direcionou para uma empresa no Google Maps.');
  }
  const reference = extractPlaceReference(resolved.href);

  if (reference.placeId) {
    const detailsResponse = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(reference.placeId)}?languageCode=pt-BR&regionCode=BR`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': detailFieldMask,
        },
      },
    );
    const details = await detailsResponse.json();
    if (detailsResponse.ok) return mapPlace(details);
  }

  if (!reference.query) {
    throw new Error('Não foi possível identificar a empresa nesse link. Abra a ficha da empresa no Google Maps e copie o link novamente.');
  }
  const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': searchFieldMask,
    },
    body: JSON.stringify({
      textQuery: reference.query,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize: 1,
    }),
  });
  const searchResult = await searchResponse.json();
  if (!searchResponse.ok) {
    throw new Error(searchResult?.error?.message || 'O Google não conseguiu localizar essa empresa.');
  }
  const place = Array.isArray(searchResult.places) ? searchResult.places[0] : null;
  if (!place) throw new Error('Nenhuma empresa foi encontrada para esse link.');
  return mapPlace(place);
}

function createGrid(centerLatitude: number, centerLongitude: number, radiusMeters: number, gridSize: number) {
  const half = Math.floor(gridSize / 2);
  const stepMeters = radiusMeters / half;
  const longitudeScale = Math.max(Math.cos(centerLatitude * Math.PI / 180), 0.2);
  const points: Array<Omit<VisibilityPoint, 'position' | 'found' | 'top_place_ids'>> = [];

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const northMeters = (half - row) * stepMeters;
      const eastMeters = (column - half) * stepMeters;
      points.push({
        row,
        column,
        latitude: centerLatitude + northMeters / 111_320,
        longitude: centerLongitude + eastMeters / (111_320 * longitudeScale),
      });
    }
  }
  return { points, stepMeters };
}

async function loadGoogleConfiguration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  let stored: { google_key: string | null; google_maps_browser_key: string | null } | null = null;
  if (supabaseUrl && serverSecret) {
    const serverClient = createClient(supabaseUrl, serverSecret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await serverClient
      .from('settings')
      .select('google_key,google_maps_browser_key')
      .eq('id', 1)
      .maybeSingle();
    stored = data;
  }
  return {
    placesKey: process.env.GOOGLE_PLACES_API_KEY || stored?.google_key || '',
    mapsBrowserKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || stored?.google_maps_browser_key || '',
  };
}

async function authorize(request: NextRequest, required: 'prospeccao' | 'analises' | 'mapa' | 'any') {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!supabaseUrl || !publishableKey) {
    return {
      error: NextResponse.json({ error: 'Supabase não configurado no servidor.' }, { status: 500 }),
      client: null,
      userId: null,
    };
  }
  if (!accessToken) {
    return {
      error: NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 }),
      client: null,
      userId: null,
    };
  }

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: current } = await client.auth.getUser(accessToken);
  if (!current.user) {
    return {
      error: NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 }),
      client: null,
      userId: null,
    };
  }
  const { data: profile } = await client
    .from('profiles')
    .select('role,permissions,is_active')
    .eq('id', current.user.id)
    .maybeSingle();
  const permissions = (profile?.permissions || []).map((item: string) => item.toLocaleLowerCase('pt-BR'));
  const isAdmin = ['admin', 'administrador'].includes((profile?.role || '').toLowerCase());
  const allowed = required === 'any'
    || (required === 'prospeccao'
      ? permissions.some((item: string) => ['prospecção', 'prospeccao'].includes(item))
      : required === 'analises'
        ? permissions.some((item: string) => ['análises', 'analises'].includes(item))
        : permissions.includes('mapa'));
  if (!profile?.is_active || (!isAdmin && !allowed)) {
    return {
      error: NextResponse.json(
        {
          error: `Seu perfil não possui acesso a ${
            required === 'prospeccao' ? 'prospecção' : required === 'analises' ? 'análises' : 'mapa'
          }.`,
        },
        { status: 403 },
      ),
      client: null,
      userId: null,
    };
  }
  return { error: null, client, userId: current.user.id };
}

export async function GET(request: NextRequest) {
  const authorization = await authorize(request, 'any');
  if (authorization.error) return authorization.error;
  const configuration = await loadGoogleConfiguration();
  return NextResponse.json({
    placesConfigured: Boolean(configuration.placesKey),
    mapsConfigured: Boolean(configuration.mapsBrowserKey),
    mapsBrowserKey: configuration.mapsBrowserKey || null,
  }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body.action === 'analyze' || body.action === 'analyze_url'
    ? body.action
    : body.action === 'grid'
      ? 'grid'
      : 'search';
  const authorization = await authorize(
    request,
    action === 'analyze' || action === 'analyze_url' ? 'analises' : action === 'grid' ? 'mapa' : 'prospeccao',
  );
  if (authorization.error) return authorization.error;

  const configuration = await loadGoogleConfiguration();
  const apiKey = configuration.placesKey;
  if (!apiKey) {
    return NextResponse.json({ error: 'A chave do Google Places ainda não foi cadastrada em Administração → Integrações.' }, { status: 500 });
  }

  if (action === 'grid') {
    const leadId = String(body.leadId || '').trim();
    const targetPlaceId = String(body.placeId || '').trim();
    const keyword = String(body.keyword || '').trim();
    const centerLatitude = Number(body.latitude);
    const centerLongitude = Number(body.longitude);
    const gridSize = 5;
    const radiusMeters = Math.min(Math.max(Number(body.radiusMeters) || 2000, 500), 5000);

    if (!leadId || !targetPlaceId) {
      return NextResponse.json({ error: 'Selecione uma empresa gerada pelo Google para criar a grade.' }, { status: 400 });
    }
    if (keyword.length < 2 || keyword.length > 120) {
      return NextResponse.json({ error: 'Informe uma palavra-chave entre 2 e 120 caracteres.' }, { status: 400 });
    }
    if (!Number.isFinite(centerLatitude) || centerLatitude < -90 || centerLatitude > 90
      || !Number.isFinite(centerLongitude) || centerLongitude < -180 || centerLongitude > 180) {
      return NextResponse.json({ error: 'A empresa selecionada não possui coordenadas válidas.' }, { status: 400 });
    }

    const { points: gridPoints, stepMeters } = createGrid(
      centerLatitude,
      centerLongitude,
      radiusMeters,
      gridSize,
    );
    const searchRadius = Math.min(Math.max(Math.round(stepMeters * 0.8), 100), 5000);

    const pointResults = await Promise.all(gridPoints.map(async point => {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id',
        },
        body: JSON.stringify({
          textQuery: keyword,
          languageCode: 'pt-BR',
          regionCode: 'BR',
          pageSize: 20,
          includePureServiceAreaBusinesses: true,
          locationBias: {
            circle: {
              center: { latitude: point.latitude, longitude: point.longitude },
              radius: searchRadius,
            },
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error?.message || 'O Google não respondeu a um dos pontos da grade.');
      }
      const ids = (Array.isArray(result.places) ? result.places : [])
        .map((place: PlaceRecord) => readText(place.id))
        .filter((id: string | null): id is string => Boolean(id));
      const index = ids.indexOf(targetPlaceId);
      return {
        ...point,
        position: index >= 0 ? index + 1 : null,
        found: index >= 0,
        top_place_ids: ids.slice(0, 3),
      } satisfies VisibilityPoint;
    })).catch(error => ({ error: error instanceof Error ? error.message : 'Falha ao consultar a grade.' }));

    if (!Array.isArray(pointResults)) {
      return NextResponse.json({ error: pointResults.error }, { status: 502 });
    }

    const positions = pointResults
      .map(point => point.position)
      .filter((position): position is number => typeof position === 'number');
    const visibilityPercentage = Number(((positions.length / pointResults.length) * 100).toFixed(2));
    const averagePosition = positions.length
      ? Number((positions.reduce((total, position) => total + position, 0) / positions.length).toFixed(2))
      : null;
    const bestPosition = positions.length ? Math.min(...positions) : null;

    const { data: scan, error: saveError } = await authorization.client!
      .from('local_visibility_scans')
      .insert({
        lead_id: leadId,
        keyword,
        grid_size: gridSize,
        radius_m: radiusMeters,
        center_latitude: centerLatitude,
        center_longitude: centerLongitude,
        visibility_percentage: visibilityPercentage,
        average_position: averagePosition,
        best_position: bestPosition,
        points: pointResults,
        created_by: authorization.userId,
      })
      .select()
      .single();

    if (saveError) {
      return NextResponse.json({ error: `A grade foi calculada, mas o histórico não pôde ser salvo: ${saveError.message}` }, { status: 500 });
    }
    return NextResponse.json({ scan });
  }

  if (action === 'analyze') {
    const placeId = String(body.placeId || '').trim();
    if (!placeId) return NextResponse.json({ error: 'Este lead não possui um Place ID do Google.' }, { status: 400 });
    const detailsResponse = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR&regionCode=BR`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': detailFieldMask,
        },
      },
    );
    const details = await detailsResponse.json();
    if (!detailsResponse.ok) {
      return NextResponse.json(
        { error: details?.error?.message || 'Não foi possível atualizar a análise no Google Places.' },
        { status: detailsResponse.status },
      );
    }
    return NextResponse.json({ place: mapPlace(details) });
  }

  if (action === 'analyze_url') {
    try {
      const place = await placeFromGoogleMapsUrl(String(body.googleMapsUrl || '').trim(), apiKey);
      return NextResponse.json({ place });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Não foi possível analisar esse link.' },
        { status: 400 },
      );
    }
  }

  const category = String(body.category || '').trim();
  const city = String(body.city || '').trim();
  const maxResults = Math.min(Math.max(Number(body.maxResults) || 10, 1), 20);
  if (!category || !city) {
    return NextResponse.json({ error: 'Informe o segmento e a cidade/região.' }, { status: 400 });
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': searchFieldMask,
    },
    body: JSON.stringify({
      textQuery: `${category} em ${city}`,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize: maxResults,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json(
      { error: data?.error?.message || 'Não foi possível consultar o Google Places.' },
      { status: response.status },
    );
  }

  const places = (data.places || [])
    .filter((place: PlaceRecord) => place.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((place: PlaceRecord) => mapPlace(place, category, city));

  return NextResponse.json({ places });
}
