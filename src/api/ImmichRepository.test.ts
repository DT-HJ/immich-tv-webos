import {APIClient} from './client';
import {ImmichRepository} from './ImmichRepository';
import {AuthMethod, type ApiKeyConfig, type UserCredentialsConfig} from './types';

const apiKeyConfig: ApiKeyConfig = {
	method: AuthMethod.API_KEY,
	baseUrl: 'https://immich.example.com',
	apiKey: 'test-api-key',
};

const userCredentialsConfig: UserCredentialsConfig = {
	method: AuthMethod.USER_CREDENTIALS,
	baseUrl: 'https://immich.example.com',
	email: 'u@example.com',
	accessToken: 'test-session-token',
};

const repoWithFetch = (fetch: jest.Mock) => new ImmichRepository({fetch} as unknown as APIClient);

describe('ImmichRepository timeline endpoints', () => {
	test('getBuckets requests the main timeline with explicit visibility filters', async () => {
		const fetch = jest.fn().mockResolvedValue([{timeBucket: '2026-03-01', count: 2}]);
		const buckets = await repoWithFetch(fetch).getBuckets();
		// Without visibility=timeline the server defaults to ('archive','timeline') and
		// archived assets leak into the TV timeline.
		expect(fetch).toHaveBeenCalledWith('/timeline/buckets?visibility=timeline&withPartners=true&withStacked=true');
		expect(buckets).toEqual([{timeBucket: '2026-03-01', count: 2}]);
	});

	test('getBucketAssets fetches one month with the same filters and forwards the abort signal', async () => {
		const fetch = jest.fn().mockResolvedValue({
			id: ['march'],
			isImage: [true],
			ratio: [1.5],
			fileCreatedAt: ['2026-03-14T10:00:00.000Z'],
			duration: [null],
		});
		const controller = new AbortController();

		const assets = await repoWithFetch(fetch).getBucketAssets('2026-03-01', undefined, controller.signal);

		expect(fetch).toHaveBeenCalledWith('/timeline/bucket?timeBucket=2026-03-01&visibility=timeline&withPartners=true&withStacked=true', {
			signal: controller.signal,
		});
		expect(assets).toEqual([
			{id: 'march', type: 'IMAGE', ratio: 1.5, localDateTime: '2026-03-14T10:00:00.000Z', durationSeconds: null},
		]);
	});

	test('album and person scopes use the web client filters for that page', async () => {
		const fetch = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce({id: [], isImage: [], ratio: [], fileCreatedAt: [], duration: []});
		const repo = repoWithFetch(fetch);
		await repo.getBuckets({albumId: 'al1', order: 'asc'});
		await repo.getBucketAssets('2026-03-01', {personId: 'p1'});
		// Albums stay unfiltered (archived assets show inside albums) and honor the album order.
		expect(fetch).toHaveBeenNthCalledWith(1, '/timeline/buckets?albumId=al1&order=asc');
		expect(fetch).toHaveBeenNthCalledWith(2, '/timeline/bucket?timeBucket=2026-03-01&personId=p1&visibility=timeline', {signal: undefined});
	});

	test('getBucketAssets reconstructs localDateTime from localOffsetHours', async () => {
		const fetch = jest.fn().mockResolvedValue({
			id: ['night-shot'],
			isImage: [true],
			ratio: [1],
			// Taken 2026-03-01 00:30 local (UTC+1) = 2026-02-28 23:30 UTC: the server puts it in
			// the March bucket, so day grouping must land on March 1st too.
			fileCreatedAt: ['2026-02-28T23:30:00.000Z'],
			localOffsetHours: [1],
			duration: [null],
		});

		const assets = await repoWithFetch(fetch).getBucketAssets('2026-03-01');

		expect(assets[0]?.localDateTime).toBe('2026-03-01T00:30:00.000Z');
	});

	test('treats zone-less v3 timestamps as UTC whatever the TV timezone', async () => {
		const fetch = jest.fn().mockResolvedValue({
			id: ['late', 'zoned'],
			isImage: [true, true],
			ratio: [1, 1],
			fileCreatedAt: ['2026-08-21T00:14:11', '2026-08-21T00:14:11.000+00:00'],
			localOffsetHours: [0, 0],
			duration: [null, null],
		});
		const assets = await repoWithFetch(fetch).getBucketAssets('2026-08-01');
		expect(assets.map((a) => a.localDateTime)).toEqual(['2026-08-21T00:14:11.000Z', '2026-08-21T00:14:11.000Z']);
	});

	test('getBucketAssets falls back to a localDateTime column on older servers', async () => {
		const fetch = jest.fn().mockResolvedValue({
			id: ['legacy'],
			isImage: [false],
			ratio: [1.78],
			fileCreatedAt: ['2026-02-28T23:30:00.000Z'],
			localDateTime: ['2026-03-01T00:30:00.000Z'],
			duration: [4000],
		});

		const assets = await repoWithFetch(fetch).getBucketAssets('2026-03-01');

		expect(assets[0]).toEqual({id: 'legacy', type: 'VIDEO', ratio: 1.78, localDateTime: '2026-03-01T00:30:00.000Z', durationSeconds: 4});
	});

	test('reconstructs localDateTime byte-identically to toISOString across offset kinds', async () => {
		// The hand-rolled getUTC* formatter must stay byte-identical to the native toISOString it
		// replaced across whole, fractional, negative, and boundary-crossing offsets.
		const fileCreatedAt = [
			'2026-03-15T12:00:00.123Z',
			'2026-03-01T02:00:00.000Z',
			'2026-03-01T03:30:45.007Z', // -8h crosses back to Feb 28
			'2026-12-31T23:30:00.999Z', // +2h crosses the year boundary
		];
		const localOffsetHours = [2, 5.5, -8, 2];
		const fetch = jest.fn().mockResolvedValue({
			id: ['a', 'b', 'c', 'd'],
			isImage: [true, true, true, true],
			ratio: [1, 1, 1, 1],
			fileCreatedAt,
			localOffsetHours,
			duration: [null, null, null, null],
		});

		const assets = await repoWithFetch(fetch).getBucketAssets('2026-03-01');

		assets.forEach((asset, i) => {
			const reference = new Date(new Date(fileCreatedAt[i]!).getTime() + localOffsetHours[i]! * 3600 * 1000).toISOString();
			expect(asset.localDateTime).toBe(reference);
		});
		expect(assets[2]?.localDateTime).toBe('2026-02-28T19:30:45.007Z');
		expect(assets[3]?.localDateTime).toBe('2027-01-01T01:30:00.999Z');
	});
});

describe('ImmichRepository.getPlaces', () => {
	test('maps /search/cities assets to places sorted by city name', async () => {
		const fetch = jest.fn().mockResolvedValue([
			{id: 'asset-paris', exifInfo: {city: 'Paris', country: 'France'}},
			{id: 'asset-aegina', exifInfo: {city: 'Aegina', country: 'Greece'}},
			{id: 'asset-no-city', exifInfo: {}},
		]);
		const places = await repoWithFetch(fetch).getPlaces();
		expect(fetch).toHaveBeenCalledWith('/search/cities');
		expect(places).toEqual([
			{city: 'Aegina', country: 'Greece', thumbnailAssetId: 'asset-aegina'},
			{city: 'Paris', country: 'France', thumbnailAssetId: 'asset-paris'},
		]);
	});

	test('returns empty list on non-array response', async () => {
		const fetch = jest.fn().mockResolvedValue({error: 'unexpected'});
		await expect(repoWithFetch(fetch).getPlaces()).resolves.toEqual([]);
	});
});

describe('ImmichRepository.searchByCity', () => {
	test('walks metadata search pages until nextPage is null', async () => {
		const item = (id: string) => ({id, type: 'IMAGE', fileCreatedAt: '2026-03-01T00:00:00.000Z', duration: null, width: 2, height: 1});
		const fetch = jest
			.fn()
			.mockResolvedValueOnce({assets: {items: [item('a')], nextPage: '2'}})
			.mockResolvedValueOnce({assets: {items: [item('b')], nextPage: null}});
		const assets = await repoWithFetch(fetch).searchByCity('Paris');
		expect(assets.map((a) => a.id)).toEqual(['a', 'b']);
		expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({city: 'Paris', page: 2, size: 1000});
	});

	test('POSTs a city metadata search and maps items to timeline assets', async () => {
		const fetch = jest.fn().mockResolvedValue({
			assets: {
				items: [
					{id: 'a1', type: 'IMAGE', fileCreatedAt: '2025-09-19T11:18:30.838Z', duration: null, width: 200, height: 100},
					{id: 'a2', type: 'VIDEO', fileCreatedAt: '2025-09-19T11:20:00.000Z', duration: 4000, exifInfo: {exifImageWidth: 100, exifImageHeight: 200}},
					{id: 'a3', type: 'VIDEO', fileCreatedAt: '2025-09-19T11:21:00.000Z', duration: 2000, visibility: 'hidden'},
				],
			},
		});
		const assets = await repoWithFetch(fetch).searchByCity('Paris');
		expect(fetch).toHaveBeenCalledWith('/search/metadata', {
			method: 'POST',
			body: JSON.stringify({city: 'Paris', page: 1, size: 1000}),
		});
		expect(assets).toEqual([
			{id: 'a1', type: 'IMAGE', ratio: 2, localDateTime: '2025-09-19T11:18:30.838Z', durationSeconds: null},
			{id: 'a2', type: 'VIDEO', ratio: 0.5, localDateTime: '2025-09-19T11:20:00.000Z', durationSeconds: 4},
		]);
	});
});

describe('ImmichRepository.searchRandomImages', () => {
	test('filters random images by album, or by timeline visibility for the library and people', async () => {
		const fetch = jest.fn().mockResolvedValue([{id: 'r1', type: 'IMAGE', fileCreatedAt: '2026-03-01T00:00:00.000Z', duration: null, width: 3, height: 2}]);
		const repo = repoWithFetch(fetch);
		const assets = await repo.searchRandomImages({albumId: 'al1'}, 50);
		await repo.searchRandomImages({personId: 'p1'}, 50);
		await repo.searchRandomImages({}, 50);
		expect(assets).toEqual([{id: 'r1', type: 'IMAGE', ratio: 1.5, localDateTime: '2026-03-01T00:00:00.000Z', durationSeconds: null}]);
		expect(fetch.mock.calls.map(([, init]) => JSON.parse(init.body))).toEqual([
			{albumIds: ['al1'], type: 'IMAGE', size: 50},
			{visibility: 'timeline', personIds: ['p1'], type: 'IMAGE', size: 50},
			{visibility: 'timeline', type: 'IMAGE', size: 50},
		]);
	});
});

describe('ImmichRepository filters', () => {
	test('getCameraMakes folds case variants and drops placeholders', async () => {
		const fetch = jest.fn().mockResolvedValue(['SONY', 'Sony', 'none', 'samsung', 'SAMSUNG']);
		const makes = await repoWithFetch(fetch).getCameraMakes();
		expect(fetch).toHaveBeenCalledWith('/search/suggestions?type=camera-make');
		expect(makes).toEqual([
			{label: 'SAMSUNG', values: ['samsung', 'SAMSUNG']},
			{label: 'Sony', values: ['SONY', 'Sony']},
		]);
	});

	test('getCameraModels asks for each exact make spelling and merges the lists', async () => {
		const fetch = jest.fn().mockResolvedValueOnce(['ILCE-7CM2', 'DSC-W220']).mockResolvedValueOnce(['ILCE-7CM2']);
		const models = await repoWithFetch(fetch).getCameraModels(['SONY', 'Sony']);
		expect(fetch).toHaveBeenNthCalledWith(1, '/search/suggestions?type=camera-model&make=SONY');
		expect(fetch).toHaveBeenNthCalledWith(2, '/search/suggestions?type=camera-model&make=Sony');
		expect(models.map((m) => m.label)).toEqual(['DSC-W220', 'ILCE-7CM2']);
	});

	test('searchFiltered sends one structured query with every variant and pages by cursor', async () => {
		const fetch = jest.fn().mockResolvedValue({
			assets: {
				items: [
					{id: 'v1', type: 'VIDEO', fileCreatedAt: '2026-10-18T08:00:00Z', localDateTime: '2026-10-18T23:59:00.000Z', duration: 373373, width: 3840, height: 2160, visibility: 'timeline'},
					{id: 'motion', type: 'VIDEO', fileCreatedAt: '2026-10-18T08:00:00Z', duration: 2000, visibility: 'hidden'},
				],
				nextCursor: 'next',
			},
		});
		const controller = new AbortController();

		const page = await repoWithFetch(fetch).searchFiltered({type: 'VIDEO', makes: ['SONY', 'Sony']}, 'abc', controller.signal);

		const [endpoint, init] = fetch.mock.calls[0];
		expect(endpoint).toBe('/search/metadata');
		expect(init.method).toBe('POST');
		expect(init.signal).toBe(controller.signal);
		expect(JSON.parse(init.body)).toEqual({
			filter: {visibility: {eq: 'timeline'}, type: {eq: 'VIDEO'}, make: {in: ['SONY', 'Sony']}},
			orderBy: {field: 'localDateTime', direction: 'desc'},
			size: 500,
			cursor: 'abc',
		});
		expect(page).toEqual({
			assets: [{id: 'v1', type: 'VIDEO', ratio: 3840 / 2160, localDateTime: '2026-10-18T23:59:00.000Z', durationSeconds: 373.373}],
			nextCursor: 'next',
		});
	});

	test('searchFiltered omits the cursor on the first page and reports the last one', async () => {
		const fetch = jest.fn().mockResolvedValue({assets: {items: []}});
		const page = await repoWithFetch(fetch).searchFiltered({models: ['ILCE-7CM2']});
		const body = JSON.parse(fetch.mock.calls[0][1].body);
		expect(body.cursor).toBeUndefined();
		expect(body.filter).toEqual({visibility: {eq: 'timeline'}, model: {in: ['ILCE-7CM2']}});
		expect(page.nextCursor).toBeNull();
	});
});

describe('ImmichRepository image URLs', () => {
	test('request the edited rendition so Immich v3 crops/rotations show on the TV', () => {
		const repo = new ImmichRepository(new APIClient(apiKeyConfig));
		expect(repo.thumbnailUrl('a1')).toBe(
			'https://immich.example.com/api/assets/a1/thumbnail?size=thumbnail&edited=true&apiKey=test-api-key',
		);
		expect(repo.previewUrl('a1')).toBe(
			'https://immich.example.com/api/assets/a1/thumbnail?size=preview&edited=true&apiKey=test-api-key',
		);
	});
});

describe('ImmichRepository.videoPlaybackUrl', () => {
	test('returns Immich /video/playback URL with apiKey query param (API_KEY auth)', () => {
		const repo = new ImmichRepository(new APIClient(apiKeyConfig));
		expect(repo.videoPlaybackUrl('asset-id-42')).toBe(
			'https://immich.example.com/api/assets/asset-id-42/video/playback?apiKey=test-api-key',
		);
	});

	test('returns Immich /video/playback URL with sessionKey query param (USER_CREDENTIALS auth)', () => {
		const repo = new ImmichRepository(new APIClient(userCredentialsConfig));
		expect(repo.videoPlaybackUrl('asset-id-42')).toBe(
			'https://immich.example.com/api/assets/asset-id-42/video/playback?sessionKey=test-session-token',
		);
	});
});
