import * as fs from 'fs';
import * as path from 'path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { api } from '../api';

const SEARCH_HEADERS: Record<string, string> = {
  'X-SEARCH-API-VERSION': 'v2',
  'X-LEGACY-RESPONSE': 'true',
};

export const searchTools: Tool[] = [
  {
    name: 'search_homes',
    description: 'Search HomeExchange homes by location, dates, guests, and exchange type.',
    inputSchema: {
      type: 'object',
      properties: {
        location:      { type: 'string', description: 'City, region, or country name' },
        checkin:       { type: 'string', description: 'Check-in date (YYYY-MM-DD)' },
        checkout:      { type: 'string', description: 'Check-out date (YYYY-MM-DD)' },
        guests:        { type: 'number', description: 'Total guests, retained for compatibility' },
        adults:        { type: 'number', description: 'Number of adults (default 2)' },
        children:      { type: 'number', description: 'Number of children (default 0)' },
        exchange_type: { type: 'string', enum: ['GuestPoints', 'simultaneous', 'non_simultaneous'], description: 'Type of exchange' },
        home_type:     { type: 'string', enum: ['house', 'apartment', 'other'], description: 'Property type' },
        limit:         { type: 'number', description: 'Results per page (default 20, max 200)' },
        offset:        { type: 'number', description: 'Pagination offset (default 0)' },
      },
    },
  },
  {
    name: 'get_home',
    description: 'Get full details for a HomeExchange listing by home ID.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Numeric home ID' },
      },
    },
  },
  {
    name: 'get_home_calendar',
    description: 'Get availability calendar for a home showing blocked and available dates.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Numeric home ID' },
      },
    },
  },
  {
    name: 'get_recommendations',
    description: 'Get personalised home recommendations based on your profile and history.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recommendations (default 8)' },
      },
    },
  },
  {
    name: 'list_my_homes',
    description: 'List your own HomeExchange listings.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_favorites',
    description: 'List your saved favourite homes.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of results (default 20)' },
      },
    },
  },
  {
    name: 'add_favorite',
    description: 'Save a home to your favourites.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Home ID to save' },
      },
    },
  },
  {
    name: 'remove_favorite',
    description: 'Remove a home from your favourites.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Home ID to remove' },
      },
    },
  },
  {
    name: 'list_saved_searches',
    description: 'List your saved search filters.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of results (default 100)' },
      },
    },
  },
  {
    name: 'check_saved_search_alerts',
    description: 'Re-run saved searches and compare home ids with a local snapshot. The first run stores a baseline. Later runs report ids that were not in the previous snapshot.',
    inputSchema: {
      type: 'object',
      properties: {
        saved_search_id: { type: 'string', description: 'Saved search externalId. Omit to check every loaded saved search.' },
        limit:           { type: 'number', description: 'Number of saved searches to load (default 100)' },
      },
    },
  },
];

type Args = Record<string, unknown>;

interface GeocodingFeature {
  bbox?: [number, number, number, number];
  geometry: { coordinates: [number, number] };
  properties: { id?: string; source?: string };
}

interface GeocodingResponse {
  features?: GeocodingFeature[];
}

interface SearchHome {
  lat?: number;
  latitude?: number;
  lng?: number;
  longitude?: number;
  location?: { lat?: number; latitude?: number; lng?: number; longitude?: number };
  [key: string]: unknown;
}

interface SearchResponse {
  homes?: SearchHome[];
  results?: SearchHome[];
  [key: string]: unknown;
}

interface GeocodedLocation {
  bbox: { maxLat: number; maxLon: number; minLat: number; minLon: number };
  locationId: string;
  provider: string;
}

async function geocodeLocation(location: string): Promise<GeocodedLocation> {
  const token = process.env['HOMEEXCHANGE_GEOCODING_TOKEN'];
  if (!token) {
    throw new Error(
      'Searching by location requires HOMEEXCHANGE_GEOCODING_TOKEN. Set it to a personal geocoding API token before starting the MCP server.'
    );
  }

  const url = new URL('https://api.jawg.io/places/v1/autocomplete');
  url.searchParams.set('text', location);
  url.searchParams.set('access-token', token);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('size', '1');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not geocode ${location}.`);

  const feature = ((await response.json()) as GeocodingResponse).features?.[0];
  if (!feature?.properties.id) throw new Error(`No location found for ${location}.`);

  const [lon, lat] = feature.geometry.coordinates;
  const [minLon, minLat, maxLon, maxLat] = feature.bbox ?? [lon - 0.25, lat - 0.25, lon + 0.25, lat + 0.25];
  return {
    locationId: feature.properties.id,
    provider: feature.properties.source ?? 'openstreetmap',
    bbox: { minLat, maxLat, minLon, maxLon },
  };
}

function homeCoordinates(home: SearchHome): [number, number] | undefined {
  const lat = home.lat ?? home.latitude ?? home.location?.lat ?? home.location?.latitude;
  const lon = home.lng ?? home.longitude ?? home.location?.lng ?? home.location?.longitude;
  return lat === undefined || lon === undefined ? undefined : [lat, lon];
}

function filterToLocation(response: SearchResponse, location: GeocodedLocation): SearchResponse {
  const homes = response.results ?? response.homes;
  if (!homes) return response;
  const filtered = homes.filter((home) => {
    const coordinates = homeCoordinates(home);
    if (!coordinates) return false;
    const [lat, lon] = coordinates;
    const { minLat, maxLat, minLon, maxLon } = location.bbox;
    return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
  });
  return response.results ? { ...response, results: filtered } : { ...response, homes: filtered };
}

function searchBody(
  args: Args,
  location?: { locationId: string; provider?: string },
): Record<string, unknown> {
  const query: Record<string, unknown> = {
    guests: {
      adults: (args['adults'] as number | undefined) ?? (args['guests'] as number | undefined) ?? 2,
      children: (args['children'] as number | undefined) ?? 0,
    },
  };
  if (args['checkin'] && args['checkout']) {
    query['dateRanges'] = [{ from: args['checkin'], to: args['checkout'] }];
  }
  if (location) {
    query['locationId'] = location.locationId;
    if (location.provider) query['provider'] = location.provider;
  }
  if (args['exchange_type']) query['exchangeTypes'] = [args['exchange_type']];
  if (args['home_type']) query['homeTypes'] = [args['home_type']];
  return { search_query: query };
}

const SAVED_SEARCH_SNAPSHOT = 'saved-search-alerts.json';
const BLOCKED_SNAPSHOT_FILENAMES = new Set(['session.json', '.env']);

interface SavedSearch {
  externalId?: string;
  displayInformation?: { title?: string };
  searchCriteria?: {
    calendar?: { dateRanges?: { from?: string; to?: string }[] };
    location?: { locationId?: string; provider?: string };
    guestCriteria?: { guests?: { adults?: number; children?: number | null } };
  };
}

interface AlertSnapshot {
  searches: Record<string, { homeIds: string[] }>;
}

interface SavedSearchAlertResult {
  savedSearchId: string;
  title?: string;
  baseline: boolean;
  skipped: boolean;
  reason?: string;
  homeIds: string[];
  newHomeIds: string[];
}

export function savedSearchSnapshotPath(): string {
  const override = process.env['HOMEEXCHANGE_SAVED_SEARCH_SNAPSHOT'];
  const filePath = override
    ? path.resolve(override)
    : path.resolve(__dirname, '../..', SAVED_SEARCH_SNAPSHOT);
  const filename = path.basename(filePath);
  if (BLOCKED_SNAPSHOT_FILENAMES.has(filename) || filename.startsWith('.env')) {
    throw new Error('Refusing to store saved-search snapshots in session or environment files.');
  }
  return filePath;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function savedSearchesFrom(response: unknown): SavedSearch[] | undefined {
  if (!isRecord(response) || !Array.isArray(response['data'])) return undefined;
  return response['data'].filter(isRecord) as SavedSearch[];
}

function alertSearchBody(search: SavedSearch): Record<string, unknown> | undefined {
  const locationId = textValue(search.searchCriteria?.location?.locationId);
  if (!locationId) return undefined;

  const provider = textValue(search.searchCriteria?.location?.provider);
  const range = search.searchCriteria?.calendar?.dateRanges?.[0];
  const guests = search.searchCriteria?.guestCriteria?.guests;
  const args: Args = {
    children: typeof guests?.children === 'number' ? guests.children : 0,
  };
  if (typeof guests?.adults === 'number') args['adults'] = guests.adults;

  const from = textValue(range?.from);
  const to = textValue(range?.to);
  if (from && to) {
    args['checkin'] = from;
    args['checkout'] = to;
  }

  // flexibleSearch, isLuxury, babies, and queryParams are not sent.
  return searchBody(args, { locationId, ...(provider ? { provider } : {}) });
}

function scalarId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return textValue(value);
}

function homeIdentifier(home: SearchHome): string | undefined {
  return scalarId(home['id']) ?? scalarId(home['homeId']);
}

function homeIdsFrom(response: SearchResponse): string[] {
  let homes: SearchHome[] = [];
  if (Array.isArray(response.results)) homes = response.results;
  else if (Array.isArray(response.homes)) homes = response.homes;

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const home of homes) {
    const id = homeIdentifier(home);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function readSnapshot(filePath: string): AlertSnapshot {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return { searches: {} };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed['searches'])) return { searches: {} };

    const searches: AlertSnapshot['searches'] = {};
    for (const [id, entry] of Object.entries(parsed['searches'])) {
      if (!isRecord(entry) || !Array.isArray(entry['homeIds'])) continue;
      const homeIds = entry['homeIds'];
      if (!homeIds.every((homeId): homeId is string => typeof homeId === 'string')) continue;
      searches[id] = { homeIds };
    }
    return { searches };
  } catch {
    return { searches: {} };
  }
}

function writeSnapshot(filePath: string, snapshot: AlertSnapshot): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  try {
    fs.renameSync(temporary, filePath);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function alertResult(
  savedSearchId: string,
  title: string | undefined,
  outcome: {
    baseline: boolean;
    skipped: boolean;
    reason?: string;
    homeIds?: string[];
    newHomeIds?: string[];
  },
): SavedSearchAlertResult {
  const result: SavedSearchAlertResult = {
    savedSearchId,
    baseline: outcome.baseline,
    skipped: outcome.skipped,
    homeIds: outcome.homeIds ?? [],
    newHomeIds: outcome.newHomeIds ?? [],
  };
  if (title) result.title = title;
  if (outcome.reason) result.reason = outcome.reason;
  return result;
}

async function compareSavedSearch(
  search: SavedSearch,
  snapshot: AlertSnapshot,
): Promise<{ changed: boolean; result: SavedSearchAlertResult }> {
  const title = textValue(search.displayInformation?.title);
  const savedSearchId = textValue(search.externalId);
  if (!savedSearchId) {
    return {
      changed: false,
      result: alertResult('', title, {
        baseline: false,
        skipped: true,
        reason: 'This saved search has no externalId, so it was not re-run.',
      }),
    };
  }

  const body = alertSearchBody(search);
  if (!body) {
    return {
      changed: false,
      result: alertResult(savedSearchId, title, {
        baseline: false,
        skipped: true,
        reason: 'This saved search has no locationId, so it was not re-run.',
      }),
    };
  }

  const response = await api.bffPost<SearchResponse>('/search/homes', body, {
    limit: '20',
    offset: '0',
  }, SEARCH_HEADERS);
  const homeIds = homeIdsFrom(response);
  const previous = snapshot.searches[savedSearchId]?.homeIds;
  const baseline = previous === undefined;
  const seen = new Set(previous ?? []);
  snapshot.searches[savedSearchId] = { homeIds };
  return {
    changed: true,
    result: alertResult(savedSearchId, title, {
      baseline,
      skipped: false,
      homeIds,
      newHomeIds: baseline ? [] : homeIds.filter((id) => !seen.has(id)),
    }),
  };
}

async function checkSavedSearchAlerts(args: Args): Promise<{ results: SavedSearchAlertResult[] }> {
  const filePath = savedSearchSnapshotPath();
  const limit = (args['limit'] as number | undefined) ?? 100;
  const requestedId = textValue(args['saved_search_id']);
  const loaded = savedSearchesFrom(await handleSearch('list_saved_searches', { limit }));

  if (!loaded) {
    return {
      results: [alertResult('', undefined, {
        baseline: false,
        skipped: true,
        reason: 'Saved searches response did not include a data array.',
      })],
    };
  }

  const selected = requestedId
    ? loaded.filter((search) => search.externalId === requestedId)
    : loaded;
  if (requestedId && selected.length === 0) {
    return {
      results: [alertResult(requestedId, undefined, {
        baseline: false,
        skipped: true,
        reason: 'No saved search matched that id.',
      })],
    };
  }

  const snapshot = readSnapshot(filePath);
  const results: SavedSearchAlertResult[] = [];
  let changed = false;
  for (const search of selected) {
    const compared = await compareSavedSearch(search, snapshot);
    changed = changed || compared.changed;
    results.push(compared.result);
  }
  if (changed) writeSnapshot(filePath, snapshot);
  return { results };
}

export async function handleSearch(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'search_homes': {
      const limit = Math.min(Math.max((args['limit'] as number | undefined) ?? 20, 1), 200);
      const offset = Math.max((args['offset'] as number | undefined) ?? 0, 0);
      const location = args['location'] ? await geocodeLocation(args['location'] as string) : undefined;
      const response = await api.bffPost<SearchResponse>('/search/homes', searchBody(args, location), {
        limit: String(limit),
        offset: String(offset),
      }, SEARCH_HEADERS);
      return location ? filterToLocation(response, location) : response;
    }

    case 'get_home':
      return api.bff(`/homes/${args['home_id'] as string}`);

    case 'get_home_calendar':
      return api.get(`/v1/homes/${args['home_id'] as string}/calendar`);

    case 'get_recommendations': {
      const limit = (args['limit'] as number | undefined) ?? 8;
      return api.bffPost('/search/recommendation', {}, { limit: String(limit) });
    }

    case 'list_my_homes':
      return api.bff('/v1/homes/me');

    case 'list_favorites': {
      const limit = (args['limit'] as number | undefined) ?? 20;
      return api.get('/v2/favorites/me', {
        'filters[status]': '1',
        'order_by[createdAt]': 'DESC',
        limit: String(limit),
      });
    }

    case 'add_favorite':
      return api.post('/v2/favorites', { homeId: args['home_id'] });

    case 'remove_favorite':
      return api.del(`/v2/favorites/${args['home_id'] as string}`);

    case 'list_saved_searches': {
      const limit = (args['limit'] as number | undefined) ?? 100;
      return api.bff('/search/saved-searches', { limit: String(limit) });
    }

    case 'check_saved_search_alerts':
      return checkSavedSearchAlerts(args);

    default:
      throw new Error(`Unknown search tool: ${name}`);
  }
}
