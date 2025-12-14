/**
 * TaxAtlas API Client
 * Handles all API calls with mock data fallback
 */

import { config } from './config';
import {
  mockResolveResponse,
  mockSummaryResponse,
  mockTaxesResponse,
  mockAccountabilityResponse,
  mockPendingResponse,
  mockPersonResponse,
} from './mock-data';
import type {
  ResolveResponse,
  PlaceSummaryResponse,
  TaxesResponse,
  AccountabilityResponse,
  PendingResponse,
  PersonResponse,
  ApiError,
} from '@/types';

// ============================================================================
// API Error Handling
// ============================================================================

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({
      error: { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' },
      timestamp: new Date().toISOString(),
      path: response.url,
    }));

    throw new ApiClientError(
      errorData.error.message,
      response.status,
      errorData.error.code,
      errorData.error.details
    );
  }

  return response.json();
}

// ============================================================================
// API Functions
// ============================================================================

interface ResolveParams {
  q: string;
  state?: string;
  city?: string;
}

// Helper to detect address pattern
function isAddressQuery(query: string): boolean {
  return /^\d+\s+\w+/.test(query.trim());
}

// Mock Minneapolis neighborhoods with approximate bounding boxes
const MOCK_NEIGHBORHOODS = [
  {
    geoUnitId: '550f8400-e29b-41d4-a716-446655440001',
    name: 'Northeast Minneapolis',
    displayName: 'Northeast Minneapolis, MN',
    bounds: { minLat: 44.99, maxLat: 45.03, minLng: -93.28, maxLng: -93.24 },
    streets: ['central ave', 'university ave', 'hennepin ave', 'broadway', 'lowry'],
  },
  {
    geoUnitId: '550f8400-e29b-41d4-a716-446655440002',
    name: 'Uptown',
    displayName: 'Uptown, MN',
    bounds: { minLat: 44.94, maxLat: 44.97, minLng: -93.32, maxLng: -93.28 },
    streets: ['lake st', 'lagoon ave', 'hennepin ave', 'lyndale ave', 'fremont'],
  },
  {
    geoUnitId: '550f8400-e29b-41d4-a716-446655440003',
    name: 'North Loop',
    displayName: 'North Loop, MN',
    bounds: { minLat: 44.98, maxLat: 45.00, minLng: -93.28, maxLng: -93.26 },
    streets: ['washington ave', '1st ave', '2nd ave', 'target field', 'hennepin'],
  },
  {
    geoUnitId: '550f8400-e29b-41d4-a716-446655440004',
    name: 'Downtown',
    displayName: 'Downtown Minneapolis, MN',
    bounds: { minLat: 44.97, maxLat: 44.99, minLng: -93.28, maxLng: -93.25 },
    streets: ['nicollet mall', 'marquette ave', '7th st', '8th st', 'hennepin'],
  },
  {
    geoUnitId: '550f8400-e29b-41d4-a716-446655440005',
    name: 'Longfellow',
    displayName: 'Longfellow, MN',
    bounds: { minLat: 44.92, maxLat: 44.95, minLng: -93.23, maxLng: -93.20 },
    streets: ['minnehaha ave', '38th st', '46th st', 'hiawatha'],
  },
  {
    geoUnitId: '550f8400-e29b-41d4-a716-446655440006',
    name: 'Powderhorn',
    displayName: 'Powderhorn, MN',
    bounds: { minLat: 44.93, maxLat: 44.95, minLng: -93.27, maxLng: -93.24 },
    streets: ['lake st', 'chicago ave', 'bloomington ave', '35th st'],
  },
  {
    geoUnitId: '550f8400-e29b-41d4-a716-446655440007',
    name: 'Dinkytown',
    displayName: 'Dinkytown, MN',
    bounds: { minLat: 44.97, maxLat: 44.99, minLng: -93.24, maxLng: -93.22 },
    streets: ['4th st', '14th ave', 'university ave', 'oak st'],
  },
];

export async function resolvePlace(params: ResolveParams): Promise<ResolveResponse> {
  if (config.useMockData) {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 300));

    const query = params.q.toLowerCase().trim();
    const isAddress = isAddressQuery(params.q);

    if (isAddress) {
      // Parse address to extract street name
      const streetMatch = query.match(/^\d+\s+(.+)/);
      const streetQuery = streetMatch ? streetMatch[1].toLowerCase() : '';

      // Find neighborhood by street name
      const matchedNeighborhood = MOCK_NEIGHBORHOODS.find((n) =>
        n.streets.some((s) => streetQuery.includes(s) || s.includes(streetQuery.split(' ')[0]))
      );

      if (matchedNeighborhood) {
        return {
          query: params.q,
          confidence: 'high',
          results: [
            {
              geoUnitId: matchedNeighborhood.geoUnitId,
              geoUnitType: 'neighborhood',
              name: matchedNeighborhood.name,
              displayName: matchedNeighborhood.displayName,
              stateCode: 'MN',
              countyFips: '053',
              matchedAlias: params.q, // Show the address as matched alias
              aliasKind: 'address',
              isPreferred: true,
            },
          ],
          bbox: [-93.28, 44.94, -93.24, 45.0],
          centroid: { type: 'Point', coordinates: [-93.26, 44.98] },
          disambiguation: null,
        };
      }

      // Default to Downtown if street not recognized
      return {
        query: params.q,
        confidence: 'medium',
        results: [
          {
            geoUnitId: '550f8400-e29b-41d4-a716-446655440004',
            geoUnitType: 'neighborhood',
            name: 'Downtown',
            displayName: 'Downtown Minneapolis, MN',
            stateCode: 'MN',
            countyFips: '053',
            matchedAlias: params.q,
            aliasKind: 'address',
            isPreferred: true,
          },
        ],
        bbox: [-93.28, 44.97, -93.25, 44.99],
        centroid: { type: 'Point', coordinates: [-93.265, 44.98] },
        disambiguation: null,
      };
    }

    // Regular neighborhood/place search
    const filteredResults = MOCK_NEIGHBORHOODS.filter(
      (n) =>
        n.name.toLowerCase().includes(query) ||
        n.displayName.toLowerCase().includes(query)
    ).map((n) => ({
      geoUnitId: n.geoUnitId,
      geoUnitType: 'neighborhood' as const,
      name: n.name,
      displayName: n.displayName,
      stateCode: 'MN',
      countyFips: '053',
      matchedAlias: n.name,
      aliasKind: 'name' as const,
      isPreferred: true,
    }));

    return {
      query: params.q,
      confidence: filteredResults.length === 1 ? 'high' : filteredResults.length > 0 ? 'medium' : 'low',
      results: filteredResults.length > 0 ? filteredResults : mockResolveResponse.results,
      bbox: [-93.28, 44.94, -93.24, 45.0],
      centroid: { type: 'Point', coordinates: [-93.26, 44.98] },
      disambiguation: null,
    };
  }

  const searchParams = new URLSearchParams({ q: params.q });
  if (params.state) searchParams.set('state', params.state);
  if (params.city) searchParams.set('city', params.city);

  const response = await fetch(`${config.apiBaseUrl}/resolve?${searchParams}`);
  return handleResponse<ResolveResponse>(response);
}

interface SummaryParams {
  geoUnitId: string;
  year?: number;
  mode?: string;
}

export async function getPlaceSummary(params: SummaryParams): Promise<PlaceSummaryResponse> {
  if (config.useMockData) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      ...mockSummaryResponse,
      geoUnitId: params.geoUnitId,
      taxYear: params.year ?? mockSummaryResponse.taxYear,
      presenceMode: (params.mode as PlaceSummaryResponse['presenceMode']) ?? mockSummaryResponse.presenceMode,
    };
  }

  const searchParams = new URLSearchParams();
  if (params.year) searchParams.set('year', String(params.year));
  if (params.mode) searchParams.set('mode', params.mode);

  const response = await fetch(
    `${config.apiBaseUrl}/place/${params.geoUnitId}/summary?${searchParams}`
  );
  return handleResponse<PlaceSummaryResponse>(response);
}

interface TaxesParams {
  geoUnitId: string;
  type?: string;
  from?: number;
  to?: number;
}

export async function getPlaceTaxes(params: TaxesParams): Promise<TaxesResponse> {
  if (config.useMockData) {
    await new Promise((r) => setTimeout(r, 500));
    return {
      ...mockTaxesResponse,
      geoUnitId: params.geoUnitId,
    };
  }

  const searchParams = new URLSearchParams();
  if (params.type) searchParams.set('type', params.type);
  if (params.from) searchParams.set('from', String(params.from));
  if (params.to) searchParams.set('to', String(params.to));

  const response = await fetch(
    `${config.apiBaseUrl}/place/${params.geoUnitId}/taxes?${searchParams}`
  );
  return handleResponse<TaxesResponse>(response);
}

interface AccountabilityParams {
  geoUnitId: string;
  taxType?: string;
  from?: number;
  to?: number;
}

export async function getPlaceAccountability(
  params: AccountabilityParams
): Promise<AccountabilityResponse> {
  if (config.useMockData) {
    await new Promise((r) => setTimeout(r, 500));
    return {
      ...mockAccountabilityResponse,
      geoUnitId: params.geoUnitId,
      filters: {
        taxType: (params.taxType as AccountabilityResponse['filters']['taxType']) ?? null,
        fromYear: params.from ?? mockAccountabilityResponse.filters.fromYear,
        toYear: params.to ?? mockAccountabilityResponse.filters.toYear,
      },
    };
  }

  const searchParams = new URLSearchParams();
  if (params.taxType) searchParams.set('taxType', params.taxType);
  if (params.from) searchParams.set('from', String(params.from));
  if (params.to) searchParams.set('to', String(params.to));

  const response = await fetch(
    `${config.apiBaseUrl}/place/${params.geoUnitId}/accountability?${searchParams}`
  );
  return handleResponse<AccountabilityResponse>(response);
}

interface PendingParams {
  geoUnitId: string;
}

export async function getPlacePending(params: PendingParams): Promise<PendingResponse> {
  if (config.useMockData) {
    await new Promise((r) => setTimeout(r, 300));
    return {
      ...mockPendingResponse,
      geoUnitId: params.geoUnitId,
      lastChecked: new Date().toISOString(),
    };
  }

  const response = await fetch(`${config.apiBaseUrl}/place/${params.geoUnitId}/pending`);
  return handleResponse<PendingResponse>(response);
}

interface PersonParams {
  personId: string;
}

export async function getPerson(params: PersonParams): Promise<PersonResponse> {
  if (config.useMockData) {
    await new Promise((r) => setTimeout(r, 300));
    return {
      ...mockPersonResponse,
      personId: params.personId,
    };
  }

  const response = await fetch(`${config.apiBaseUrl}/person/${params.personId}`);
  return handleResponse<PersonResponse>(response);
}
