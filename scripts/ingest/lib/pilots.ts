import path from 'node:path';
import { getEnv } from './env.js';

export interface PilotConfig {
  pilotId: string;
  countryCode: 'US';
  stateCode: string; // USPS
  stateFips: string; // 2 digits
  countyFips: string; // 3 digits
  countyName: string;
  cityName: string;
  tigerYear: number;
  tiger: {
    tractsUrl: string;
    blockGroupsUrl: string;
  };
  paths: {
    customGeoUnitsGeoJson: string;
    placeAliasesJson: string;
    jurisdictionsGeoJson: string;
    propertyTaxContextCsv: string;
    salesTaxRatesCsv: string;
    stateIncomeTaxJson: string;
    officialsJson: string;
    decisionsJson: string;
    policySignalsJson: string;
  };
  methodologies: {
    fact: { name: string; version: string; kind: 'fact' };
    estimate: { name: string; version: string; kind: 'estimate' };
    signal: { name: string; version: string; kind: 'signal' };
    geoOverlay: { name: string; version: string; kind: 'estimate' };
  };
}

function tigerUrl(year: number, folder: string, filename: string): string {
  return `https://www2.census.gov/geo/tiger/TIGER${year}/${folder}/${filename}`;
}

export const PILOTS: Record<string, PilotConfig> = {
  minneapolis: (() => {
    const tigerYear = Number(getEnv('TIGER_YEAR', '2023'));
    const stateFips = '27';
    const stateCode = 'MN';
    const pilotId = 'minneapolis';
    return {
      pilotId,
      countryCode: 'US',
      stateCode,
      stateFips,
      countyFips: '053',
      countyName: 'Hennepin County',
      cityName: 'Minneapolis',
      tigerYear,
      tiger: {
        tractsUrl: tigerUrl(tigerYear, 'TRACT', `tl_${tigerYear}_${stateFips}_tract.zip`),
        blockGroupsUrl: tigerUrl(tigerYear, 'BG', `tl_${tigerYear}_${stateFips}_bg.zip`),
      },
      paths: {
        customGeoUnitsGeoJson: path.join('data', 'pilot', pilotId, 'custom_geo_units.geojson'),
        placeAliasesJson: path.join('data', 'pilot', pilotId, 'place_aliases.json'),
        jurisdictionsGeoJson: path.join('data', 'pilot', pilotId, 'jurisdictions.geojson'),
        propertyTaxContextCsv: path.join('data', 'pilot', pilotId, 'property_tax_context.csv'),
        salesTaxRatesCsv: path.join('data', 'pilot', pilotId, 'sales_tax_rates.csv'),
        stateIncomeTaxJson: path.join('data', 'pilot', pilotId, 'state_income_tax.json'),
        officialsJson: path.join('data', 'pilot', pilotId, 'officials.json'),
        decisionsJson: path.join('data', 'pilot', pilotId, 'decisions.json'),
        policySignalsJson: path.join('data', 'pilot', pilotId, 'policy_signals.json'),
      },
      methodologies: {
        fact: { name: `pilot:${pilotId}`, version: 'v1-fact', kind: 'fact' },
        estimate: { name: `pilot:${pilotId}`, version: 'v1-estimate', kind: 'estimate' },
        signal: { name: `pilot:${pilotId}`, version: 'v1-signal', kind: 'signal' },
        geoOverlay: { name: `pilot:${pilotId}`, version: 'v1-geo-overlay', kind: 'estimate' },
      },
    } satisfies PilotConfig;
  })(),
};

export function getPilotConfig(): PilotConfig {
  const pilot = getEnv('TAXATLAS_PILOT', 'minneapolis') ?? 'minneapolis';
  const config = PILOTS[pilot];
  if (!config) {
    throw new Error(`Unknown pilot '${pilot}'. Known pilots: ${Object.keys(PILOTS).join(', ')}`);
  }
  return config;
}

