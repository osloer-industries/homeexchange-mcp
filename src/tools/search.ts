import * as fs from 'node:fs';
import * as path from 'node:path';
import { api, z, zodTool, type Tool, type ToolArgs } from './tool-common';

const searchArgsSchema = z.object({
  adults: z.number().optional(),
  children: z.number().optional(),
  guests: z.number().optional(),
  checkin: z.string().optional(),
  checkout: z.string().optional(),
  exchange_type: z.enum(['GuestPoints', 'simultaneous', 'non_simultaneous']).optional(),
  home_id: z.string().optional(),
  home_type: z.enum(['house', 'apartment', 'other']).optional(),
  limit: z.number().optional(),
  location: z.string().optional(),
  offset: z.number().optional(),
});
const homeIdArgs = z.object({ home_id: z.string().min(1) });
const limitArgs = z.object({ limit: z.number().optional() });
const savedSearchAlertArgsSchema = z.object({
  saved_search_id: z.string().optional(),
  limit: z.number().optional(),
});
type Args = z.infer<typeof searchArgsSchema>;
type SavedSearchAlertArgs = z.infer<typeof savedSearchAlertArgsSchema>;

const SEARCH_HEADERS: Record<string, string> = {
  'X-SEARCH-API-VERSION': 'v2',
  'X-LEGACY-RESPONSE': 'true',
};

export const searchTools: Tool[] = [
  zodTool(
    'search_homes',
    'Search HomeExchange homes by location, dates, guests, and exchange type.',
    searchArgsSchema,
  ),
  zodTool('get_home', 'Get full details for a HomeExchange listing by home ID.', homeIdArgs),
  zodTool(
    'get_home_calendar',
    'Get availability calendar for a home showing blocked and available dates.',
    homeIdArgs,
  ),
  zodTool(
    'get_recommendations',
    'Get personalised home recommendations based on your profile and history.',
    limitArgs,
  ),
  zodTool('list_my_homes', 'List your own HomeExchange listings.', z.object({})),
  zodTool('list_favorites', 'List your saved favourite homes.', limitArgs),
  zodTool('add_favorite', 'Save a home to your favourites.', homeIdArgs),
  zodTool('remove_favorite', 'Remove a home from your favourites.', homeIdArgs),
  zodTool('list_saved_searches', 'List your saved search filters.', limitArgs),
  zodTool(
    'check_saved_search_alerts',
    'Re-run saved searches and compare home ids with a local snapshot. The first run stores a baseline. Later runs report ids that were not in the previous snapshot.',
    savedSearchAlertArgsSchema,
  ),
];

const geocodingFeatureSchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({ id: z.string().optional(), source: z.string().optional() }),
});
const geocodingResponseSchema = z.object({ features: z.array(geocodingFeatureSchema).optional() });
const optionalCoordinate = z.number().optional();
const coordinateFields = {
  lat: optionalCoordinate,
  latitude: optionalCoordinate,
  lng: optionalCoordinate,
  longitude: optionalCoordinate,
} as const;
const searchHomeSchema = z.object({
  ...coordinateFields,
  location: z.object(coordinateFields).optional(),
}).catchall(z.unknown());
const searchResponseSchema = z.object({
  homes: z.array(searchHomeSchema).optional(),
  results: z.array(searchHomeSchema).optional(),
}).catchall(z.unknown());

type GeocodedLocation = {
  bbox: { maxLat: number; maxLon: number; minLat: number; minLon: number };
  locationId: string;
  provider: string;
};
type SearchHome = z.infer<typeof searchHomeSchema>;
type SearchResponse = z.infer<typeof searchResponseSchema>;
type SearchLocationRef = Pick<GeocodedLocation, 'locationId'> & { provider?: string };

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

function isSavedSearch(value: unknown): value is SavedSearch {
  return isRecord(value);
}

function savedSearchesFrom(response: unknown): SavedSearch[] | undefined {
  if (!isRecord(response) || !Array.isArray(response['data'])) return undefined;
  const searches: SavedSearch[] = [];
  for (const entry of response['data']) {
    if (isSavedSearch(entry)) searches.push(entry);
  }
  return searches;
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

  const body = geocodingResponseSchema.parse(await response.json());
  const feature = body.features?.[0];
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

function searchBody(args: Args, location?: SearchLocationRef): Record<string, unknown> {
  const query: Record<string, unknown> = {
    guests: {
      adults: args.adults ?? args.guests ?? 2,
      children: args.children ?? 0,
    },
  };
  if (args.checkin && args.checkout) {
    query['dateRanges'] = [{ from: args.checkin, to: args.checkout }];
  }
  if (location) {
    query['locationId'] = location.locationId;
    if (location.provider) query['provider'] = location.provider;
  }
  if (args.exchange_type) query['exchangeTypes'] = [args.exchange_type];
  if (args.home_type) query['homeTypes'] = [args.home_type];
  return { search_query: query };
}

function numericParameter(args: Args, name: 'limit' | 'offset', fallback: number): number {
  return args[name] ?? fallback;
}

async function searchHomes(args: Args): Promise<SearchResponse> {
  const limit = Math.min(Math.max(numericParameter(args, 'limit', 20), 1), 200);
  const offset = Math.max(numericParameter(args, 'offset', 0), 0);
  const locationName = args.location;
  const location = locationName ? await geocodeLocation(locationName) : undefined;
  const response = await api.bffPost('/search/homes', searchBody(args, location), {
    limit: String(limit), offset: String(offset),
  }, SEARCH_HEADERS);
  const parsedResponse = searchResponseSchema.parse(response);
  return location ? filterToLocation(parsedResponse, location) : parsedResponse;
}

function parseHomeId(args: Args): string {
  return homeIdArgs.parse(args).home_id;
}

function guestArgsFromSavedSearch(search: SavedSearch): Args {
  const guests = search.searchCriteria?.guestCriteria?.guests;
  const args: Args = {
    children: typeof guests?.children === 'number' ? guests.children : 0,
  };
  if (typeof guests?.adults === 'number') args.adults = guests.adults;
  return args;
}

function withFirstDateRange(args: Args, search: SavedSearch): Args {
  const range = search.searchCriteria?.calendar?.dateRanges?.[0];
  const from = textValue(range?.from);
  const to = textValue(range?.to);
  if (!from || !to) return args;
  return { ...args, checkin: from, checkout: to };
}

function alertSearchBody(search: SavedSearch): Record<string, unknown> | undefined {
  const locationId = textValue(search.searchCriteria?.location?.locationId);
  if (!locationId) return undefined;

  const provider = textValue(search.searchCriteria?.location?.provider);
  const args = withFirstDateRange(guestArgsFromSavedSearch(search), search);
  // flexibleSearch, isLuxury, babies, and queryParams are not sent.
  return searchBody(args, { locationId, ...(provider ? { provider } : {}) });
}

function scalarId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return textValue(value);
}

function homeIdentifier(home: SearchHome): string | undefined {
  return scalarId(home.id) ?? scalarId(home['homeId']);
}

function homeIdsFrom(response: SearchResponse): string[] {
  const homes = response.results ?? response.homes ?? [];
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

  const response = searchResponseSchema.parse(
    await api.bffPost('/search/homes', body, { limit: '20', offset: '0' }, SEARCH_HEADERS),
  );
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

async function checkSavedSearchAlerts(
  args: SavedSearchAlertArgs,
): Promise<{ results: SavedSearchAlertResult[] }> {
  const filePath = savedSearchSnapshotPath();
  const limit = args.limit ?? 100;
  const requestedId = textValue(args.saved_search_id);
  const loaded = savedSearchesFrom(
    await api.bff('/search/saved-searches', { limit: String(limit) }),
  );

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
  const compared = await Promise.all(selected.map((search) => compareSavedSearch(search, snapshot)));
  const results = compared.map((entry) => entry.result);
  const changed = compared.some((entry) => entry.changed);
  if (changed) writeSnapshot(filePath, snapshot);
  return { results };
}

const handlers: Record<string, (args: Args) => Promise<unknown>> = {
  search_homes: searchHomes,
  get_home: (args) => api.bff(`/homes/${parseHomeId(args)}`),
  get_home_calendar: (args) => api.get(`/v1/homes/${parseHomeId(args)}/calendar`),
  get_recommendations: (args) => api.bffPost('/search/recommendation', {}, { limit: String(numericParameter(args, 'limit', 8)) }),
  list_my_homes: () => api.bff('/v1/homes/me'),
  list_favorites: (args) => api.get('/v2/favorites/me', { 'filters[status]': '1', 'order_by[createdAt]': 'DESC', limit: String(numericParameter(args, 'limit', 20)) }),
  add_favorite: (args) => api.post('/v2/favorites', { homeId: parseHomeId(args) }),
  remove_favorite: (args) => api.del(`/v2/favorites/${parseHomeId(args)}`),
  list_saved_searches: (args) => api.bff('/search/saved-searches', { limit: String(numericParameter(args, 'limit', 100)) }),
};

export async function handleSearch(name: string, args: ToolArgs): Promise<unknown> {
  if (name === 'check_saved_search_alerts') {
    return checkSavedSearchAlerts(savedSearchAlertArgsSchema.parse(args));
  }
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown search tool: ${name}`);
  return handler(searchArgsSchema.parse(args));
}