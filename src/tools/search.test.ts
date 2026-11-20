import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSearch, searchTools } from './search';

const apiMock = vi.hoisted(() => ({
  bff: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  bffPost: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  del: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  get: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  post: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn<typeof fetch>() }));

vi.mock('../api', () => ({ api: apiMock }));
vi.stubGlobal('fetch', fetchMock);

const SEARCH_HOMES = 'search_homes';
const CHECKIN_AUG_2026 = '2026-08-01';
const LOCATION_BRUSSELS = 'Brussels';
const GEOCODING_TEST_TOKEN = 'test-token';

describe('search tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['HOMEEXCHANGE_GEOCODING_TOKEN'];
    apiMock.bff.mockResolvedValue({ ok: true });
    apiMock.bffPost.mockResolvedValue({ results: [] });
    apiMock.del.mockResolvedValue({ ok: true });
    apiMock.get.mockResolvedValue({ ok: true });
    apiMock.post.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    delete process.env['HOMEEXCHANGE_GEOCODING_TOKEN'];
  });

  it('rejects a missing required home ID before calling the API', async () => {
    await expect(handleSearch('get_home', {})).rejects.toThrow('expected string');
    expect(apiMock.bff).not.toHaveBeenCalled();
  });

  it('keeps the legacy guest count while supporting adults and children', () => {
    expect(searchTools.find((tool) => tool.name === SEARCH_HOMES)?.inputSchema.properties)
      .toMatchObject({ guests: expect.any(Object), adults: expect.any(Object), children: expect.any(Object) });
  });

  it('does not send an incomplete date range', async () => {
    await handleSearch(SEARCH_HOMES, { checkin: CHECKIN_AUG_2026 });
    expect(apiMock.bffPost).toHaveBeenCalledWith(
      '/search/homes',
      expect.not.objectContaining({ search_query: expect.objectContaining({ dateRanges: expect.anything() }) }),
      expect.anything(),
      expect.anything()
    );
  });

  it('uses the current BFF request shape and required headers', async () => {
    await handleSearch(SEARCH_HOMES, {
      checkin: CHECKIN_AUG_2026, checkout: '2026-08-22', guests: 3,
      exchange_type: 'GuestPoints', home_type: 'apartment', limit: 999, offset: -2,
    });

    expect(apiMock.bffPost).toHaveBeenCalledWith('/search/homes', {
      search_query: {
        dateRanges: [{ from: CHECKIN_AUG_2026, to: '2026-08-22' }],
        guests: { adults: 3, children: 0 },
        exchangeTypes: ['GuestPoints'], homeTypes: ['apartment'],
      },
    }, { limit: '200', offset: '0' }, {
      'X-SEARCH-API-VERSION': 'v2', 'X-LEGACY-RESPONSE': 'true',
    });
  });

  it('requires an explicit personal token before geocoding a location', async () => {
    await expect(handleSearch(SEARCH_HOMES, { location: LOCATION_BRUSSELS })).rejects.toThrow(
      'HOMEEXCHANGE_GEOCODING_TOKEN'
    );
  });

  it('reports failed and empty geocoding results without sending a search request', async () => {
    process.env['HOMEEXCHANGE_GEOCODING_TOKEN'] = GEOCODING_TEST_TOKEN;
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(handleSearch(SEARCH_HOMES, { location: LOCATION_BRUSSELS })).rejects.toThrow(
      'Could not geocode Brussels.'
    );

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ features: [] }), { status: 200 }));
    await expect(handleSearch(SEARCH_HOMES, { location: LOCATION_BRUSSELS })).rejects.toThrow(
      'No location found for Brussels.'
    );
    expect(apiMock.bffPost).not.toHaveBeenCalled();
  });

  it('geocodes a location and filters a BFF response to its bounding box', async () => {
    process.env['HOMEEXCHANGE_GEOCODING_TOKEN'] = GEOCODING_TEST_TOKEN;
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      features: [{
        bbox: [4, 50, 5, 51], geometry: { coordinates: [4.5, 50.5] },
        properties: { id: 'feature-1', source: 'openstreetmap' },
      }],
    }), { status: 200 }));
    apiMock.bffPost.mockResolvedValue({ results: [{ id: 1, lat: 50.5, lng: 4.5 }, { id: 2, lat: 48, lng: 2 }] });

    await expect(handleSearch(SEARCH_HOMES, { location: LOCATION_BRUSSELS, adults: 2, children: 1 }))
      .resolves.toEqual({ results: [{ id: 1, lat: 50.5, lng: 4.5 }] });
    expect(apiMock.bffPost.mock.calls[0]?.[1]).toMatchObject({
      search_query: { locationId: 'feature-1', provider: 'openstreetmap', guests: { adults: 2, children: 1 } },
    });
  });

  it('filters homes responses and applies default geocode bounding boxes', async () => {
    process.env['HOMEEXCHANGE_GEOCODING_TOKEN'] = GEOCODING_TEST_TOKEN;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      features: [{
        geometry: { coordinates: [4.5, 50.5] },
        properties: { id: 'feature-2', source: 'provider-a' },
      }],
    }), { status: 200 }));
    apiMock.bffPost.mockResolvedValue({
      homes: [
        { id: 1, latitude: 50.5, longitude: 4.5 },
        { id: 2, location: { lat: 48, lng: 2 } },
        { id: 3 },
      ],
    });

    await expect(handleSearch(SEARCH_HOMES, { location: LOCATION_BRUSSELS })).resolves.toEqual({
      homes: [{ id: 1, latitude: 50.5, longitude: 4.5 }],
    });
  });

  it('routes the remaining search tools to their current endpoints', async () => {
    await handleSearch('get_home', { home_id: '1' });
    await handleSearch('get_home_calendar', { home_id: '2' });
    await handleSearch('get_recommendations', {});
    await handleSearch('list_my_homes', {});
    await handleSearch('list_favorites', {});
    await handleSearch('add_favorite', { home_id: '3' });
    await handleSearch('remove_favorite', { home_id: '4' });
    await handleSearch('list_saved_searches', {});

    expect(apiMock.bff).toHaveBeenCalledWith('/homes/1');
    expect(apiMock.get).toHaveBeenNthCalledWith(1, '/v1/homes/2/calendar');
    expect(apiMock.bffPost).toHaveBeenCalledWith('/search/recommendation', {}, { limit: '8' });
    expect(apiMock.bff).toHaveBeenCalledWith('/v1/homes/me');
    expect(apiMock.get).toHaveBeenNthCalledWith(2, '/v2/favorites/me', {
      'filters[status]': '1', 'order_by[createdAt]': 'DESC', limit: '20',
    });
    expect(apiMock.post).toHaveBeenCalledWith('/v2/favorites', { homeId: '3' });
    expect(apiMock.del).toHaveBeenCalledWith('/v2/favorites/4');
    expect(apiMock.bff).toHaveBeenCalledWith('/search/saved-searches', { limit: '100' });
  });

  it('rejects unknown search tools', async () => {
    await expect(handleSearch('unknown', {})).rejects.toThrow('Unknown search tool: unknown');
  });
});
