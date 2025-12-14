/**
 * TaxAtlas React Query Hooks
 * Type-safe data fetching hooks for all API endpoints
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  resolvePlace,
  getPlaceSummary,
  getPlaceTaxes,
  getPlaceAccountability,
  getPlacePending,
  getPerson,
} from '@/lib/api-client';
import type {
  ResolveResponse,
  PlaceSummaryResponse,
  TaxesResponse,
  AccountabilityResponse,
  PendingResponse,
  PersonResponse,
} from '@/types';

// ============================================================================
// Query Keys
// ============================================================================

export const queryKeys = {
  resolve: (q: string, state?: string, city?: string) =>
    ['resolve', { q, state, city }] as const,
  summary: (geoUnitId: string, year?: number, mode?: string) =>
    ['place', geoUnitId, 'summary', { year, mode }] as const,
  taxes: (geoUnitId: string, type?: string, from?: number, to?: number) =>
    ['place', geoUnitId, 'taxes', { type, from, to }] as const,
  accountability: (geoUnitId: string, taxType?: string, from?: number, to?: number) =>
    ['place', geoUnitId, 'accountability', { taxType, from, to }] as const,
  pending: (geoUnitId: string) => ['place', geoUnitId, 'pending'] as const,
  person: (personId: string) => ['person', personId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

interface UseResolveOptions {
  q: string;
  state?: string;
  city?: string;
  enabled?: boolean;
}

export function useResolve({ q, state, city, enabled = true }: UseResolveOptions) {
  return useQuery<ResolveResponse, Error>({
    queryKey: queryKeys.resolve(q, state, city),
    queryFn: () => resolvePlace({ q, state, city }),
    enabled: enabled && q.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
}

interface UseSummaryOptions {
  geoUnitId: string;
  year?: number;
  mode?: string;
  enabled?: boolean;
}

export function useSummary({ geoUnitId, year, mode, enabled = true }: UseSummaryOptions) {
  return useQuery<PlaceSummaryResponse, Error>({
    queryKey: queryKeys.summary(geoUnitId, year, mode),
    queryFn: () => getPlaceSummary({ geoUnitId, year, mode }),
    enabled: enabled && !!geoUnitId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

interface UseTaxesOptions {
  geoUnitId: string;
  type?: string;
  from?: number;
  to?: number;
  enabled?: boolean;
}

export function useTaxes({ geoUnitId, type, from, to, enabled = true }: UseTaxesOptions) {
  return useQuery<TaxesResponse, Error>({
    queryKey: queryKeys.taxes(geoUnitId, type, from, to),
    queryFn: () => getPlaceTaxes({ geoUnitId, type, from, to }),
    enabled: enabled && !!geoUnitId,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

interface UseAccountabilityOptions {
  geoUnitId: string;
  taxType?: string;
  from?: number;
  to?: number;
  enabled?: boolean;
}

export function useAccountability({
  geoUnitId,
  taxType,
  from,
  to,
  enabled = true,
}: UseAccountabilityOptions) {
  return useQuery<AccountabilityResponse, Error>({
    queryKey: queryKeys.accountability(geoUnitId, taxType, from, to),
    queryFn: () => getPlaceAccountability({ geoUnitId, taxType, from, to }),
    enabled: enabled && !!geoUnitId,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

interface UsePendingOptions {
  geoUnitId: string;
  enabled?: boolean;
}

export function usePending({ geoUnitId, enabled = true }: UsePendingOptions) {
  return useQuery<PendingResponse, Error>({
    queryKey: queryKeys.pending(geoUnitId),
    queryFn: () => getPlacePending({ geoUnitId }),
    enabled: enabled && !!geoUnitId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

interface UsePersonOptions {
  personId: string;
  enabled?: boolean;
}

export function usePerson({ personId, enabled = true }: UsePersonOptions) {
  return useQuery<PersonResponse, Error>({
    queryKey: queryKeys.person(personId),
    queryFn: () => getPerson({ personId }),
    enabled: enabled && !!personId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

// ============================================================================
// Prefetch Helpers
// ============================================================================

export function usePrefetchSummary() {
  const queryClient = useQueryClient();

  return (geoUnitId: string, year?: number, mode?: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.summary(geoUnitId, year, mode),
      queryFn: () => getPlaceSummary({ geoUnitId, year, mode }),
    });
  };
}

export function usePrefetchTaxes() {
  const queryClient = useQueryClient();

  return (geoUnitId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.taxes(geoUnitId),
      queryFn: () => getPlaceTaxes({ geoUnitId }),
    });
  };
}
