import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeGoogleAdsRequest,
  googleAdsAccessToken,
  googleAdsHeaders,
  googleAdsStatus,
  loadGoogleAdsConfiguration,
} from '@/lib/google-ads-server';

type AdsError = { error?: { message?: string; details?: Array<{ errors?: Array<{ message?: string }> }> } };
type RankedKeywordIdea = {
  keyword: string;
  avgMonthlySearches: number;
  competition: string;
  competitionIndex: number;
  lowTopOfPageBid: number;
  highTopOfPageBid: number;
  monthlySearchVolumes: unknown[];
  relevanceScore: number;
  cluster: string;
};

const ignoredRelevanceTokens = new Set([
  'para', 'como', 'com', 'sem', 'sobre', 'outro', 'segmento', 'empresa',
  'loja', 'grupo', 'brasil', 'fortaleza',
]);

const commercialIntentTokens = new Set([
  'preco', 'valor', 'orcamento', 'comprar', 'contratar', 'servico', 'clinica',
  'profissional', 'especialista', 'perto', 'proximo', 'bairro', 'cidade',
  'melhor', 'aberto', 'agendar', 'consulta',
]);

function relevanceTokens(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map(token => token.length > 5 && token.endsWith('s') ? token.slice(0, -1) : token)
    .filter(token => token.length >= 4 && !ignoredRelevanceTokens.has(token));
}

function normalizedKeyword(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isRelevantKeyword(keyword: string, expectedTokens: string[]) {
  const ideaTokens = relevanceTokens(keyword);
  return ideaTokens.some(ideaToken => expectedTokens.some(expected =>
    ideaToken === expected
    || (ideaToken.length >= 6 && expected.length >= 6 && (
      ideaToken.startsWith(expected.slice(0, 6))
      || expected.startsWith(ideaToken.slice(0, 6))
    )),
  ));
}

function keywordScore(keyword: string, volume: number, expectedTokens: string[]) {
  const tokens = relevanceTokens(keyword);
  const relevance = tokens.filter(token => expectedTokens.some(expected =>
    token === expected
    || (token.length >= 6 && expected.length >= 6 && (
      token.startsWith(expected.slice(0, 6))
      || expected.startsWith(token.slice(0, 6))
    )),
  )).length;
  const commercialIntent = tokens.filter(token => commercialIntentTokens.has(token)).length;
  return relevance * 100 + commercialIntent * 18 + Math.log10(Math.max(volume, 1)) * 12;
}

function keywordCluster(keyword: string, expectedTokens: string[]) {
  const normalized = normalizedKeyword(keyword);
  const meaningful = relevanceTokens(normalized)
    .filter(token => expectedTokens.includes(token) || !commercialIntentTokens.has(token))
    .slice(0, 4);
  return meaningful.join(' ') || normalized;
}

function adsErrorMessage(result: AdsError) {
  const message = result.error?.details?.flatMap(detail => detail.errors || [])[0]?.message
    || result.error?.message
    || 'O Google Ads não conseguiu consultar as palavras-chave.';
  if (/developer token is only approved for use with test accounts/i.test(message)) {
    return 'O Developer Token do Google Ads ainda está limitado a contas de teste. Solicite Acesso Básico na Central da API da conta administradora para consultar volumes de contas reais.';
  }
  return message;
}

async function suggestGeoTarget(
  location: string,
  configuration: NonNullable<Awaited<ReturnType<typeof loadGoogleAdsConfiguration>>>,
  accessToken: string,
) {
  const response = await fetch('https://googleads.googleapis.com/v25/geoTargetConstants:suggest', {
    method: 'POST',
    headers: googleAdsHeaders(configuration, accessToken),
    body: JSON.stringify({
      locale: 'pt_BR',
      countryCode: 'BR',
      locationNames: { names: [location] },
    }),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(adsErrorMessage(result));
  const suggestions = Array.isArray(result.geoTargetConstantSuggestions)
    ? result.geoTargetConstantSuggestions
    : [];
  return suggestions.find((item: Record<string, unknown>) => {
    const constant = item.geoTargetConstant as Record<string, unknown> | undefined;
    return constant?.status === 'ENABLED';
  })?.geoTargetConstant?.resourceName as string | undefined;
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeGoogleAdsRequest(request);
  if (authorization.error) return authorization.error;
  try {
    return NextResponse.json(googleAdsStatus(await loadGoogleAdsConfiguration()));
  } catch {
    return NextResponse.json({ credentialsConfigured: false, connected: false });
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeGoogleAdsRequest(request);
  if (authorization.error) return authorization.error;
  const configuration = await loadGoogleAdsConfiguration();
  if (!configuration || !googleAdsStatus(configuration).connected) {
    return NextResponse.json({ error: 'Google Ads ainda não conectado pelo administrador.' }, { status: 400 });
  }
  const body = await request.json();
  const segment = String(body.segment || '').trim();
  const businessName = String(body.businessName || '').trim();
  const websiteUrl = String(body.websiteUrl || '').trim();
  const location = String(body.location || 'Fortaleza').trim();
  const keywords = (Array.isArray(body.keywords) ? body.keywords : [])
    .map((value: unknown) => String(value).trim())
    .filter((value: string) => value.length >= 2)
    .slice(0, 20);
  const businessContext = [segment, businessName.replace(/[|•]/g, ' ')].filter(Boolean).join(' ').trim();
  const seeds = keywords.length ? keywords : [segment || businessContext];
  if (!seeds[0]) return NextResponse.json({ error: 'Selecione um segmento ou informe uma palavra-chave.' }, { status: 400 });
  const expectedTokens = Array.from(new Set(relevanceTokens(
    keywords.length ? `${keywords.join(' ')} ${segment}` : segment || businessContext,
  )));
  const segmentTokens = new Set(relevanceTokens(segment));
  const brandTokens = relevanceTokens(businessName).filter(token => !segmentTokens.has(token));

  try {
    const accessToken = await googleAdsAccessToken(configuration);
    const geoTarget = await suggestGeoTarget(location, configuration, accessToken);
    if (!geoTarget) {
      return NextResponse.json({ error: `O Google Ads não reconheceu “${location}” como localização segmentável.` }, { status: 400 });
    }
    const customerId = String(configuration.customer_id || '').replace(/\D/g, '');
    const seed = websiteUrl && /^https?:\/\//i.test(websiteUrl)
      ? { keywordAndUrlSeed: { keywords: seeds, url: websiteUrl } }
      : { keywordSeed: { keywords: seeds } };
    const response = await fetch(
      `https://googleads.googleapis.com/v25/customers/${customerId}:generateKeywordIdeas`,
      {
        method: 'POST',
        headers: googleAdsHeaders(configuration, accessToken),
        body: JSON.stringify({
          customerId,
          language: 'languageConstants/1014',
          geoTargetConstants: [geoTarget],
          keywordPlanNetwork: 'GOOGLE_SEARCH',
          ...seed,
          includeAdultKeywords: false,
          pageSize: 50,
        }),
        cache: 'no-store',
      },
    );
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ error: adsErrorMessage(result) }, { status: response.status });
    const unfilteredIdeas = (Array.isArray(result.results) ? result.results : []).map((item: Record<string, unknown>) => {
      const metrics = (item.keywordIdeaMetrics || {}) as Record<string, unknown>;
      const monthly = Array.isArray(metrics.monthlySearchVolumes) ? metrics.monthlySearchVolumes : [];
      return {
        keyword: String(item.text || ''),
        avgMonthlySearches: Number(metrics.avgMonthlySearches || 0),
        competition: String(metrics.competition || 'UNSPECIFIED'),
        competitionIndex: Number(metrics.competitionIndex || 0),
        lowTopOfPageBid: Number(metrics.lowTopOfPageBidMicros || 0) / 1_000_000,
        highTopOfPageBid: Number(metrics.highTopOfPageBidMicros || 0) / 1_000_000,
        monthlySearchVolumes: monthly,
      };
    }).sort((a: { avgMonthlySearches: number }, b: { avgMonthlySearches: number }) =>
      b.avgMonthlySearches - a.avgMonthlySearches);
    const relevantIdeas = expectedTokens.length
      ? unfilteredIdeas.filter((idea: { keyword: string }) => isRelevantKeyword(idea.keyword, expectedTokens))
      : unfilteredIdeas;
    const nonBrandedIdeas = relevantIdeas.filter((idea: { keyword: string }) => {
      if (!brandTokens.length) return true;
      const tokens = new Set(relevanceTokens(idea.keyword));
      return !brandTokens.every(token => tokens.has(token));
    });
    const ideas = nonBrandedIdeas
      .map((idea: {
        keyword: string;
        avgMonthlySearches: number;
        competition: string;
        competitionIndex: number;
        lowTopOfPageBid: number;
        highTopOfPageBid: number;
        monthlySearchVolumes: unknown[];
      }) => ({
        ...idea,
        relevanceScore: keywordScore(idea.keyword, idea.avgMonthlySearches, expectedTokens),
        cluster: keywordCluster(idea.keyword, expectedTokens),
      }))
      .sort((a: RankedKeywordIdea, b: RankedKeywordIdea) =>
        b.relevanceScore - a.relevanceScore || b.avgMonthlySearches - a.avgMonthlySearches)
      .map((idea: RankedKeywordIdea, index: number) => ({ ...idea, recommended: index < 8 }));
    return NextResponse.json({
      ideas,
      location,
      geoTarget,
      searchBasis: seeds.join(', '),
      profileContext: {
        businessName,
        segment,
        websiteUsed: Boolean(websiteUrl && /^https?:\/\//i.test(websiteUrl)),
      },
      filteredIdeas: unfilteredIdeas.length - ideas.length,
      disclaimer: 'Volumes do Google Ads são arredondados, incluem variantes próximas e não representam exclusivamente buscas no Google Maps.',
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Falha ao consultar o Google Ads.',
    }, { status: 500 });
  }
}
