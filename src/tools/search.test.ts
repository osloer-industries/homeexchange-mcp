import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSearch, savedSearchSnapshotPath, searchTools } from './search';

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
const BFF_SEARCH_HOMES = '/search/homes';
const BFF_SAVED_SEARCHES = '/search/saved-searches';
const CHECK_SAVED_SEARCH_ALERTS = 'check_saved_search_alerts';
const SAVED_SEARCH_SNAPSHOT_FILE = 'saved-search-alerts.json';
const SAVED_SEARCH_TEMP_PREFIX = 'he-saved-search-';
const CHECKIN_AUG_2026 = '2026-08-01';
const LOCATION_BRUSSELS = 'Brussels';
const GEOCODING_TEST_TOKEN = 'test-token';

function savedSearchFixtureWithoutExternalId() {
  return { ...savedSearchFixture(), externalId: undefined };
}

function savedSearchFixture(externalId = 'search-1') {
  return {
    externalId,
    userId: 100,
    alertConfig: { enabled: true, locale: 'en', email: 'redacted' },
    displayInformation: {
      title: externalId === 'search-1' ? 'Portugal' : 'Lisbon',
      description: 'Summer',
    },
    source: 'web',
    searchCriteria: {
      calendar: {
        dateRanges: [
          { from: '2026-07-01', to: '2026-07-15' },
          { from: '2026-08-01', to: '2026-08-08' },
        ],
        flexibleSearch: { duration: 'P7D' },
      },
      location: { locationId: `loc-${externalId}`, provider: 'openstreetmap' },
      guestCriteria: {
        guests: { adults: 2, children: null, babies: 1 },
        guestCount: 2,
      },
      additionalCriteria: { isLuxury: true },
    },
    queryParams: 'place=portugal',
    alertLegacyId: 5,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  };
}

function readSnapshotContents(filePath: string): { parsed: unknown; mode: number } {
  const fd = fs.openSync(filePath, 'r');
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(fd, 'utf8'));
    return {
      parsed,
      mode: fs.fstatSync(fd).mode & 0o777,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function expectNoSensitiveCopy(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('redacted');
  expect(serialized).not.toContain('userId');
  expect(serialized).not.toContain('queryParams');
  expect(serialized).not.toContain('isLuxury');
  expect(serialized).not.toContain('babies');
  expect(serialized).not.toContain('flexibleSearch');
}

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
      BFF_SEARCH_HOMES,
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

    expect(apiMock.bffPost).toHaveBeenCalledWith(BFF_SEARCH_HOMES, {
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
    expect(apiMock.bff).toHaveBeenCalledWith(BFF_SAVED_SEARCHES, { limit: '100' });
  });

  it('rejects unknown search tools', async () => {
    await expect(handleSearch('unknown', {})).rejects.toThrow('Unknown search tool: unknown');
  });

  describe('check_saved_search_alerts', () => {
    let snapshotDir = '';
    let snapshotFile = '';

    beforeEach(() => {
      snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), SAVED_SEARCH_TEMP_PREFIX));
      snapshotFile = path.join(snapshotDir, SAVED_SEARCH_SNAPSHOT_FILE);
      process.env['HOMEEXCHANGE_SAVED_SEARCH_SNAPSHOT'] = snapshotFile;
      fetchMock.mockImplementation(() => {
        throw new Error('network is disabled');
      });
    });

    afterEach(() => {
      delete process.env['HOMEEXCHANGE_SAVED_SEARCH_SNAPSHOT'];
      if (snapshotDir) fs.rmSync(snapshotDir, { recursive: true, force: true });
      fetchMock.mockReset();
    });

    it('keeps the snapshot file gitignored and away from session and env files', () => {
      delete process.env['HOMEEXCHANGE_SAVED_SEARCH_SNAPSHOT'];
      const filePath = savedSearchSnapshotPath();
      expect(path.basename(filePath)).toBe(SAVED_SEARCH_SNAPSHOT_FILE);
      const gitignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf8');
      expect(gitignore).toContain(SAVED_SEARCH_SNAPSHOT_FILE);
      expect(searchTools.find((tool) => tool.name === CHECK_SAVED_SEARCH_ALERTS)?.inputSchema)
        .toMatchObject({
          properties: {
            saved_search_id: expect.any(Object),
            limit: expect.any(Object),
          },
        });
    });

    it('records the first result as a baseline and later reports only new home ids', async () => {
      fs.writeFileSync(snapshotFile, `${JSON.stringify({
        searches: { 'search-2': { homeIds: ['99'] } },
      })}\n`);
      apiMock.bff.mockResolvedValue({ success: true, data: [savedSearchFixture()] });
      apiMock.bffPost
        .mockResolvedValueOnce({
          results: [
            { id: 10 },
            { id: '10' },
            { homeId: '11' },
            { name: 'ignored' },
          ],
        })
        .mockResolvedValueOnce({
          homes: [{ id: '11' }, { homeId: 13 }, { id: null }],
        });

      const baseline = await handleSearch(CHECK_SAVED_SEARCH_ALERTS, { limit: 25 });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(apiMock.bff).toHaveBeenCalledWith(BFF_SAVED_SEARCHES, { limit: '25' });
      expect(apiMock.bffPost).toHaveBeenCalledWith(BFF_SEARCH_HOMES, {
        search_query: {
          guests: { adults: 2, children: 0 },
          dateRanges: [{ from: '2026-07-01', to: '2026-07-15' }],
          locationId: 'loc-search-1',
          provider: 'openstreetmap',
        },
      }, { limit: '20', offset: '0' }, {
        'X-SEARCH-API-VERSION': 'v2',
        'X-LEGACY-RESPONSE': 'true',
      });
      expect(baseline).toEqual({
        results: [{
          savedSearchId: 'search-1',
          title: 'Portugal',
          baseline: true,
          skipped: false,
          homeIds: ['10', '11'],
          newHomeIds: [],
        }],
      });
      expectNoSensitiveCopy(baseline);
      const baselineSnapshot = readSnapshotContents(snapshotFile);
      expect(baselineSnapshot.parsed).toEqual({
        searches: {
          'search-2': { homeIds: ['99'] },
          'search-1': { homeIds: ['10', '11'] },
        },
      });
      expect(baselineSnapshot.mode).toBe(0o600);
      expect(fs.readdirSync(snapshotDir).some((name) => name.endsWith('.tmp'))).toBe(false);

      const updated = await handleSearch(CHECK_SAVED_SEARCH_ALERTS, {});

      expect(fetchMock).not.toHaveBeenCalled();
      expect(apiMock.get).not.toHaveBeenCalled();
      expect(apiMock.post).not.toHaveBeenCalled();
      expect(apiMock.del).not.toHaveBeenCalled();
      expect(updated).toEqual({
        results: [{
          savedSearchId: 'search-1',
          title: 'Portugal',
          baseline: false,
          skipped: false,
          homeIds: ['11', '13'],
          newHomeIds: ['13'],
        }],
      });
      const updatedSnapshot = readSnapshotContents(snapshotFile);
      expect(updatedSnapshot.parsed).toEqual({
        searches: {
          'search-2': { homeIds: ['99'] },
          'search-1': { homeIds: ['11', '13'] },
        },
      });
      expectNoSensitiveCopy(updatedSnapshot.parsed);
    });

    it('skips a saved search when locationId is missing and does not use the network', async () => {
      const search = {
        ...savedSearchFixture(),
        searchCriteria: {
          ...savedSearchFixture().searchCriteria,
          location: { provider: 'openstreetmap' },
        },
      };
      apiMock.bff.mockResolvedValue({ success: true, data: [search, savedSearchFixture('search-2')] });

      const result = await handleSearch(CHECK_SAVED_SEARCH_ALERTS, { saved_search_id: 'search-1' });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(apiMock.bffPost).not.toHaveBeenCalled();
      expect(apiMock.bff).toHaveBeenCalledWith(BFF_SAVED_SEARCHES, { limit: '100' });
      expect(result).toEqual({
        results: [{
          savedSearchId: 'search-1',
          title: 'Portugal',
          baseline: false,
          skipped: true,
          reason: 'This saved search has no locationId, so it was not re-run.',
          homeIds: [],
          newHomeIds: [],
        }],
      });
      expect(fs.existsSync(snapshotFile)).toBe(false);
    });

    it('checks only the saved search selected by externalId', async () => {
      apiMock.bff.mockResolvedValue({
        success: true,
        data: [savedSearchFixture(), savedSearchFixture('search-2')],
      });
      apiMock.bffPost.mockResolvedValue({ results: [{ id: '4' }] });

      const result = await handleSearch(CHECK_SAVED_SEARCH_ALERTS, { saved_search_id: 'search-2' });

      expect(apiMock.bffPost).toHaveBeenCalledTimes(1);
      expect(apiMock.bffPost.mock.calls[0]?.[1]).toMatchObject({
        search_query: { locationId: 'loc-search-2', provider: 'openstreetmap' },
      });
      expect(result).toEqual({
        results: [{
          savedSearchId: 'search-2',
          title: 'Lisbon',
          baseline: true,
          skipped: false,
          homeIds: ['4'],
          newHomeIds: [],
        }],
      });
    });

    it('reports an unmatched saved search id without calling home search', async () => {
      apiMock.bff.mockResolvedValue({ success: true, data: [savedSearchFixture()] });

      await expect(handleSearch(CHECK_SAVED_SEARCH_ALERTS, { saved_search_id: 'missing' }))
        .resolves.toEqual({
          results: [{
            savedSearchId: 'missing',
            baseline: false,
            skipped: true,
            reason: 'No saved search matched that id.',
            homeIds: [],
            newHomeIds: [],
          }],
        });
      expect(apiMock.bffPost).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats an unreadable snapshot as a baseline and drops non-string ids', async () => {
      fs.writeFileSync(snapshotFile, 'not-json');
      apiMock.bff.mockResolvedValue({ success: true, data: [savedSearchFixture()] });
      apiMock.bffPost.mockResolvedValueOnce({ results: [{ homeId: 7 }] });

      await expect(handleSearch(CHECK_SAVED_SEARCH_ALERTS, {})).resolves.toMatchObject({
        results: [{ baseline: true, newHomeIds: [], homeIds: ['7'] }],
      });

      fs.writeFileSync(snapshotFile, JSON.stringify({
        searches: {
          'search-1': { homeIds: [7], email: 'redacted' },
          broken: null,
        },
      }));
      apiMock.bffPost.mockResolvedValueOnce({ results: [{ id: '8' }] });

      const result = await handleSearch(CHECK_SAVED_SEARCH_ALERTS, {});
      expect(result).toMatchObject({
        results: [{ baseline: true, newHomeIds: [], homeIds: ['8'] }],
      });
      expectNoSensitiveCopy(JSON.parse(fs.readFileSync(snapshotFile, 'utf8')));
    });

    it('skips searches that cannot be re-run and ignores criteria the home search does not send', async () => {
      const undated = {
        ...savedSearchFixture('search-3'),
        searchCriteria: {
          ...savedSearchFixture('search-3').searchCriteria,
          location: { locationId: 'loc-search-3' },
          calendar: { dateRanges: [], flexibleSearch: { duration: 'P7D' } },
        },
      };
      const unnamed = savedSearchFixtureWithoutExternalId();
      apiMock.bff.mockResolvedValueOnce({ success: true });
      apiMock.bff.mockResolvedValueOnce({ success: true, data: [unnamed, undated] });
      apiMock.bffPost.mockResolvedValue({ results: [{ id: '5' }] });

      await expect(handleSearch(CHECK_SAVED_SEARCH_ALERTS, {})).resolves.toEqual({
        results: [{
          savedSearchId: '',
          baseline: false,
          skipped: true,
          reason: 'Saved searches response did not include a data array.',
          homeIds: [],
          newHomeIds: [],
        }],
      });

      const result = await handleSearch(CHECK_SAVED_SEARCH_ALERTS, { saved_search_id: '   ' });
      expect(apiMock.bffPost).toHaveBeenCalledTimes(1);
      expect(apiMock.bffPost.mock.calls[0]?.[1]).toEqual({
        search_query: {
          guests: { adults: 2, children: 0 },
          locationId: 'loc-search-3',
        },
      });
      expect(result).toEqual({
        results: [
          {
            savedSearchId: '',
            title: 'Portugal',
            baseline: false,
            skipped: true,
            reason: 'This saved search has no externalId, so it was not re-run.',
            homeIds: [],
            newHomeIds: [],
          },
          {
            savedSearchId: 'search-3',
            title: 'Lisbon',
            baseline: true,
            skipped: false,
            homeIds: ['5'],
            newHomeIds: [],
          },
        ],
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(['session.json', '.env', '.env.local'])('refuses to store snapshots in %s', async (filename) => {
      process.env['HOMEEXCHANGE_SAVED_SEARCH_SNAPSHOT'] = path.join(snapshotDir, filename);

      await expect(handleSearch(CHECK_SAVED_SEARCH_ALERTS, {})).rejects.toThrow(
        'session or environment files',
      );
      expect(apiMock.bff).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(snapshotDir, filename))).toBe(false);
    });
  });
});
