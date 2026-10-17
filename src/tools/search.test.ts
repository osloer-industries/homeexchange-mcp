import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSearch, savedSearchSnapshotPath, searchTools } from './search';

const apiMock = vi.hoisted(() => ({
  bff: vi.fn(), bffPost: vi.fn(), del: vi.fn(), get: vi.fn(), post: vi.fn(),
}));
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('../api', () => ({ api: apiMock }));
vi.stubGlobal('fetch', fetchMock);

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

  it('keeps the legacy guest count while supporting adults and children', () => {
    expect(searchTools.find((tool) => tool.name === 'search_homes')?.inputSchema.properties)
      .toMatchObject({ guests: expect.any(Object), adults: expect.any(Object), children: expect.any(Object) });
  });

  it('uses the current BFF request shape and required headers', async () => {
    await handleSearch('search_homes', {
      checkin: '2026-08-01', checkout: '2026-08-22', guests: 3,
      exchange_type: 'GuestPoints', home_type: 'apartment', limit: 999, offset: -2,
    });

    expect(apiMock.bffPost).toHaveBeenCalledWith('/search/homes', {
      search_query: {
        dateRanges: [{ from: '2026-08-01', to: '2026-08-22' }],
        guests: { adults: 3, children: 0 },
        exchangeTypes: ['GuestPoints'], homeTypes: ['apartment'],
      },
    }, { limit: '200', offset: '0' }, {
      'X-SEARCH-API-VERSION': 'v2', 'X-LEGACY-RESPONSE': 'true',
    });
  });

  it('requires an explicit personal token before geocoding a location', async () => {
    await expect(handleSearch('search_homes', { location: 'Brussels' })).rejects.toThrow(
      'HOMEEXCHANGE_GEOCODING_TOKEN'
    );
  });

  it('geocodes a location and filters a BFF response to its bounding box', async () => {
    process.env['HOMEEXCHANGE_GEOCODING_TOKEN'] = 'test-token';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ features: [{
      bbox: [4, 50, 5, 51], geometry: { coordinates: [4.5, 50.5] },
      properties: { id: 'feature-1', source: 'openstreetmap' },
    }] }) });
    apiMock.bffPost.mockResolvedValue({ results: [{ id: 1, lat: 50.5, lng: 4.5 }, { id: 2, lat: 48, lng: 2 }] });

    await expect(handleSearch('search_homes', { location: 'Brussels', adults: 2, children: 1 }))
      .resolves.toEqual({ results: [{ id: 1, lat: 50.5, lng: 4.5 }] });
    expect(apiMock.bffPost.mock.calls[0]?.[1]).toMatchObject({
      search_query: { locationId: 'feature-1', provider: 'openstreetmap', guests: { adults: 2, children: 1 } },
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

  describe('check_saved_search_alerts', () => {
    let snapshotDir = '';
    let snapshotFile = '';

    beforeEach(() => {
      snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'he-saved-search-'));
      snapshotFile = path.join(snapshotDir, 'saved-search-alerts.json');
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

    function savedSearch(externalId = 'search-1') {
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

    function expectNoSensitiveCopy(value: unknown) {
      const serialized = JSON.stringify(value);
      expect(serialized).not.toContain('redacted');
      expect(serialized).not.toContain('userId');
      expect(serialized).not.toContain('queryParams');
      expect(serialized).not.toContain('isLuxury');
      expect(serialized).not.toContain('babies');
      expect(serialized).not.toContain('flexibleSearch');
    }

    it('keeps the snapshot file gitignored and away from session and env files', () => {
      delete process.env['HOMEEXCHANGE_SAVED_SEARCH_SNAPSHOT'];
      const filePath = savedSearchSnapshotPath();
      expect(path.basename(filePath)).toBe('saved-search-alerts.json');
      const gitignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf8');
      expect(gitignore).toContain('saved-search-alerts.json');
      expect(searchTools.find((tool) => tool.name === 'check_saved_search_alerts')?.inputSchema)
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
      apiMock.bff.mockResolvedValue({ success: true, data: [savedSearch()] });
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

      const baseline = await handleSearch('check_saved_search_alerts', { limit: 25 });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(apiMock.bff).toHaveBeenCalledWith('/search/saved-searches', { limit: '25' });
      expect(apiMock.bffPost).toHaveBeenCalledWith('/search/homes', {
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
      expect(JSON.parse(fs.readFileSync(snapshotFile, 'utf8'))).toEqual({
        searches: {
          'search-2': { homeIds: ['99'] },
          'search-1': { homeIds: ['10', '11'] },
        },
      });
      expect(fs.statSync(snapshotFile).mode & 0o777).toBe(0o600);
      expect(fs.readdirSync(snapshotDir).some((name) => name.endsWith('.tmp'))).toBe(false);

      const updated = await handleSearch('check_saved_search_alerts', {});

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
      expect(JSON.parse(fs.readFileSync(snapshotFile, 'utf8'))).toEqual({
        searches: {
          'search-2': { homeIds: ['99'] },
          'search-1': { homeIds: ['11', '13'] },
        },
      });
      expectNoSensitiveCopy(JSON.parse(fs.readFileSync(snapshotFile, 'utf8')));
    });

    it('skips a saved search when locationId is missing and does not use the network', async () => {
      const search = savedSearch();
      delete (search.searchCriteria.location as { locationId?: string }).locationId;
      apiMock.bff.mockResolvedValue({ success: true, data: [search, savedSearch('search-2')] });

      const result = await handleSearch('check_saved_search_alerts', { saved_search_id: 'search-1' });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(apiMock.bffPost).not.toHaveBeenCalled();
      expect(apiMock.bff).toHaveBeenCalledWith('/search/saved-searches', { limit: '100' });
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
        data: [savedSearch(), savedSearch('search-2')],
      });
      apiMock.bffPost.mockResolvedValue({ results: [{ id: '4' }] });

      const result = await handleSearch('check_saved_search_alerts', { saved_search_id: 'search-2' });

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
      apiMock.bff.mockResolvedValue({ success: true, data: [savedSearch()] });

      await expect(handleSearch('check_saved_search_alerts', { saved_search_id: 'missing' }))
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
      apiMock.bff.mockResolvedValue({ success: true, data: [savedSearch()] });
      apiMock.bffPost.mockResolvedValueOnce({ results: [{ homeId: 7 }] });

      await expect(handleSearch('check_saved_search_alerts', {})).resolves.toMatchObject({
        results: [{ baseline: true, newHomeIds: [], homeIds: ['7'] }],
      });

      fs.writeFileSync(snapshotFile, JSON.stringify({
        searches: {
          'search-1': { homeIds: [7], email: 'redacted' },
          broken: null,
        },
      }));
      apiMock.bffPost.mockResolvedValueOnce({ results: [{ id: '8' }] });

      const result = await handleSearch('check_saved_search_alerts', {});
      expect(result).toMatchObject({
        results: [{ baseline: true, newHomeIds: [], homeIds: ['8'] }],
      });
      expectNoSensitiveCopy(JSON.parse(fs.readFileSync(snapshotFile, 'utf8')));
    });

    it('skips searches that cannot be re-run and ignores criteria the home search does not send', async () => {
      const undated = savedSearch('search-3');
      delete (undated.searchCriteria.location as { provider?: string }).provider;
      undated.searchCriteria.calendar = { dateRanges: [], flexibleSearch: { duration: 'P7D' } };
      const unnamed = savedSearch();
      delete (unnamed as { externalId?: string }).externalId;
      apiMock.bff.mockResolvedValueOnce({ success: true });
      apiMock.bff.mockResolvedValueOnce({ success: true, data: [unnamed, undated] });
      apiMock.bffPost.mockResolvedValue({ results: [{ id: '5' }] });

      await expect(handleSearch('check_saved_search_alerts', {})).resolves.toEqual({
        results: [{
          savedSearchId: '',
          baseline: false,
          skipped: true,
          reason: 'Saved searches response did not include a data array.',
          homeIds: [],
          newHomeIds: [],
        }],
      });

      const result = await handleSearch('check_saved_search_alerts', { saved_search_id: '   ' });
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

      await expect(handleSearch('check_saved_search_alerts', {})).rejects.toThrow(
        'session or environment files',
      );
      expect(apiMock.bff).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(snapshotDir, filename))).toBe(false);
    });
  });
});
