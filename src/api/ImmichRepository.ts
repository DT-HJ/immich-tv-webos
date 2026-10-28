import {APIError, type APIClient} from './client';
import type {ColumnarAssetResponse, ImmichAlbum, ImmichAlbumDetails, ImmichAsset, ImmichPerson, PeopleResponse} from './types';
import type {PhotoRepository} from '../domain/PhotoRepository';
import {groupCaseVariants} from '../domain/cameraGroups';
import {
	MAIN_TIMELINE,
	type Album,
	type AlbumDetails,
	type AssetFilter,
	type AssetPage,
	type CameraGroup,
	type Person,
	type Place,
	type TimelineAsset,
	type TimelineBucket,
	type TimelineScope,
} from '../domain/types';
import {toDurationSeconds} from '../utils/FormattingService';

interface ImmichSearchResponse {
	// nextCursor: structured (`filter`) requests, Immich v3.2+
	assets: {items: ImmichAsset[]; nextPage?: string | null; nextCursor?: string | null};
}

const PEOPLE_LIMIT = 50;
const SEARCH_PAGE_SIZE = 500;
// Pages are fetched sequentially and laid out in one go (cities have no timeline scope): keep it TV-sized.
const METADATA_SEARCH_PAGE_SIZE = 1000;
const METADATA_SEARCH_MAX_PAGES = 3;
// Filter results page on demand as the grid scrolls, so a page only has to fill a few screens.
const FILTER_PAGE_SIZE = 500;
// Matches the official web client's main timeline: without visibility=timeline the server
// defaults to ('archive','timeline') and archived assets leak in.
const TIMELINE_FILTER_PARAMS = 'visibility=timeline&withPartners=true&withStacked=true';

function timelineScopeParams(scope: TimelineScope): string {
	// Unfiltered like the web client: archived assets stay visible inside albums.
	if (scope.albumId) return `albumId=${scope.albumId}&order=${scope.order ?? 'desc'}`;
	if (scope.personId) return `personId=${scope.personId}&visibility=timeline`;
	return TIMELINE_FILTER_PARAMS;
}

// Immich v3.2+ structured search. Exact-match lists carry every case variant of a make or model
// in one request; visibility matches the main timeline (no archive, no live-photo motion parts).
// Unlike the legacy flat search, a `filter` request includes trashed assets unless told not to.
// Spellings some cameras and apps store instead of leaving the tag empty. The server matches
// exactly, so "no make / no model" is NULL or one of these.
const EXIF_PLACEHOLDERS = ['', 'none', 'None', 'NONE', 'unknown', 'Unknown', 'UNKNOWN'];

const missing = (field: 'make' | 'model', base: object = {}) => [
	{...base, [field]: {eq: null}},
	{...base, [field]: {in: EXIF_PLACEHOLDERS}},
];

// The camera choices are alternatives: they go in the single `or` list structured search allows,
// each branch being itself an AND.
function cameraBranches(filter: AssetFilter): object[] {
	const branches: object[] = [];
	for (const camera of filter.cameras ?? []) {
		const make = {make: {in: camera.makes}};
		if (camera.models?.length) branches.push({...make, model: {in: camera.models}});
		if (camera.noModel) branches.push(...missing('model', make));
		if (!camera.models?.length && !camera.noModel) branches.push(make);
	}
	if (filter.noMake) branches.push(...missing('make'));
	return branches;
}

function structuredFilter(filter: AssetFilter) {
	const or = cameraBranches(filter);
	return {
		visibility: {eq: 'timeline'},
		trashedAt: {eq: null},
		...(filter.type ? {type: {eq: filter.type}} : {}),
		...(filter.favorites ? {isFavorite: {eq: true}} : {}),
		...(filter.takenFrom || filter.takenBefore
			? {takenAt: {...(filter.takenFrom ? {gte: filter.takenFrom} : {}), ...(filter.takenBefore ? {lt: filter.takenBefore} : {})}}
			: {}),
		...(filter.personIds?.length ? {personIds: {any: filter.personIds}} : {}),
		...(filter.albumIds?.length ? {albumIds: {any: filter.albumIds}} : {}),
		...(or.length ? {or} : {}),
	};
}

const pad2 = (n: number): string => (n < 10 ? '0' + n : '' + n);
const pad3 = (n: number): string => (n < 10 ? '00' + n : n < 100 ? '0' + n : '' + n);

// ISO-8601 UTC string, byte-identical to Date.toISOString for years 0000–9999. Hand-formatted via
// getUTC* (not toISOString) because this runs per asset on every month load and the timeline only
// reads it back as YYYY-MM / YYYY-MM-DD — skipping sub-second formatting drops ~27%/asset.
function utcMillisToIso(ms: number): string {
	const d = new Date(ms);
	return (
		String(d.getUTCFullYear()).padStart(4, '0') +
		'-' + pad2(d.getUTCMonth() + 1) +
		'-' + pad2(d.getUTCDate()) +
		'T' + pad2(d.getUTCHours()) +
		':' + pad2(d.getUTCMinutes()) +
		':' + pad2(d.getUTCSeconds()) +
		'.' + pad3(d.getUTCMilliseconds()) + 'Z'
	);
}

// Immich v3 omits the zone on UTC timestamps, which Date would parse as TV-local time.
function parseUtcMillis(iso: string): number {
	const zoned = iso.endsWith('Z') || iso.indexOf('+', 19) >= 0 || iso.indexOf('-', 19) >= 0;
	return new Date(zoned ? iso : iso + 'Z').getTime();
}

// The server buckets months on localDateTime but its columnar payload only carries UTC
// fileCreatedAt (+ localOffsetHours on recent servers, localDateTime array on older ones).
function columnarLocalDateTime(columnar: ColumnarAssetResponse, i: number): string {
	const fileCreatedAt = columnar.fileCreatedAt[i]!;
	const offsetHours = columnar.localOffsetHours?.[i];
	if (typeof offsetHours === 'number') {
		return utcMillisToIso(parseUtcMillis(fileCreatedAt) + offsetHours * 3600 * 1000);
	}
	return columnar.localDateTime?.[i] ?? fileCreatedAt;
}

// Immich's bucket timeline returns assets column-wise (parallel arrays).
function transformColumnarResponse(columnar: ColumnarAssetResponse): TimelineAsset[] {
	const len = columnar.id.length;
	const ratios = columnar.ratio?.length === len ? columnar.ratio : null;
	return columnar.id.map((id, i) => ({
		id,
		type: columnar.isImage[i]! ? 'IMAGE' : 'VIDEO',
		ratio: ratios ? ratios[i]! : 1,
		localDateTime: columnarLocalDateTime(columnar, i),
		durationSeconds: toDurationSeconds(columnar.duration[i]),
		city: columnar.city?.[i],
		country: columnar.country?.[i],
	}));
}

export class ImmichRepository implements PhotoRepository {
	private client: APIClient;

	constructor(client: APIClient) {
		this.client = client;
	}

	private mapAlbum(a: ImmichAlbum): Album {
		return {
			id: a.id,
			albumName: a.albumName,
			description: a.description,
			albumThumbnailAssetId: a.albumThumbnailAssetId,
			assetCount: a.assetCount,
		};
	}

	private mapPerson(p: ImmichPerson): Person {
		return {id: p.id, name: p.name, assetCount: p.assetCount ?? 0};
	}

	public async getBuckets(scope: TimelineScope = MAIN_TIMELINE): Promise<TimelineBucket[]> {
		return this.client.fetch<TimelineBucket[]>(`/timeline/buckets?${timelineScopeParams(scope)}`);
	}

	public async getBucketAssets(timeBucket: string, scope: TimelineScope = MAIN_TIMELINE, signal?: AbortSignal): Promise<TimelineAsset[]> {
		const columnar = await this.client.fetch<ColumnarAssetResponse>(
			`/timeline/bucket?timeBucket=${timeBucket}&${timelineScopeParams(scope)}`,
			{signal}
		);
		return transformColumnarResponse(columnar);
	}

	public async getAlbums(): Promise<Album[]> {
		const albums = await this.client.fetch<ImmichAlbum[]>('/albums');
		return albums.map((a) => this.mapAlbum(a));
	}

	// Assets load through the album-scoped timeline; withoutAssets stops pre-v3 servers embedding them.
	public async getAlbum(albumId: string): Promise<AlbumDetails> {
		const details = await this.client.fetch<ImmichAlbumDetails>(`/albums/${albumId}?withoutAssets=true`);
		return {
			...this.mapAlbum(details),
			order: details.order ?? 'desc',
		};
	}

	private assetFromImmichAsset(a: ImmichAsset): TimelineAsset {
		const w = a.exifInfo?.exifImageWidth ?? a.width;
		const h = a.exifInfo?.exifImageHeight ?? a.height;
		return {
			id: a.id,
			type: a.type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
			ratio: w && h ? w / h : 1,
			localDateTime: a.localDateTime ?? a.fileCreatedAt,
			durationSeconds: toDurationSeconds(a.duration),
			city: a.exifInfo?.city,
			country: a.exifInfo?.country,
		};
	}

	public async getPeople(): Promise<Person[]> {
		const response = await this.client.fetch<PeopleResponse>('/people');
		return response.people
			.filter((p) => !p.isHidden)
			.sort((a, b) => (b.assetCount ?? 0) - (a.assetCount ?? 0))
			.slice(0, PEOPLE_LIMIT)
			.map((p) => this.mapPerson(p));
	}

	public async getPlaces(): Promise<Place[]> {
		// One representative asset per city, exifInfo populated on every server version
		const assets = await this.client.fetch<ImmichAsset[]>('/search/cities');
		if (!Array.isArray(assets)) return [];
		return assets
			.flatMap((a) => {
				const city = a.exifInfo?.city;
				if (!city) return [];
				return [{city, country: a.exifInfo?.country ?? null, thumbnailAssetId: a.id}];
			})
			.sort((a, b) => a.city.localeCompare(b.city));
	}

	public async searchSmart(query: string): Promise<TimelineAsset[]> {
		const response = await this.client.fetch<ImmichSearchResponse>('/search/smart', {
			method: 'POST',
			body: JSON.stringify({query, size: SEARCH_PAGE_SIZE}),
		});
		return this.searchItemsToAssets(response);
	}

	public async searchByCity(city: string): Promise<TimelineAsset[]> {
		const assets: TimelineAsset[] = [];
		let page: string | null | undefined = '1';
		for (let i = 0; page && i < METADATA_SEARCH_MAX_PAGES; i++) {
			const response: ImmichSearchResponse = await this.client.fetch<ImmichSearchResponse>('/search/metadata', {
				method: 'POST',
				body: JSON.stringify({city, page: Number(page), size: METADATA_SEARCH_PAGE_SIZE}),
			});
			assets.push(...this.searchItemsToAssets(response));
			page = response.assets?.nextPage;
		}
		return assets;
	}

	public async searchRandomImages(scope: TimelineScope, size: number): Promise<TimelineAsset[]> {
		// Same visibility rules as timelineScopeParams.
		const filter = scope.albumId
			? {albumIds: [scope.albumId]}
			: {visibility: 'timeline', personIds: scope.personId ? [scope.personId] : undefined};
		const items = await this.client.fetch<ImmichAsset[]>('/search/random', {
			method: 'POST',
			body: JSON.stringify({...filter, type: 'IMAGE', size}),
		});
		return this.visibleAssets(items);
	}

	public async getCameraMakes(): Promise<CameraGroup[]> {
		const makes = await this.client.fetch<string[]>('/search/suggestions?type=camera-make');
		return groupCaseVariants(Array.isArray(makes) ? makes : []);
	}

	// Suggestions are per exact make spelling ('Sony' and 'SONY' list different bodies): ask for each.
	public async getCameraModels(makes: string[]): Promise<CameraGroup[]> {
		const lists = await Promise.all(
			makes.map((make) => this.client.fetch<string[]>(`/search/suggestions?type=camera-model&make=${encodeURIComponent(make)}`))
		);
		return groupCaseVariants(lists.flatMap((models) => (Array.isArray(models) ? models : [])));
	}

	public async searchFiltered(filter: AssetFilter, cursor?: string, signal?: AbortSignal): Promise<AssetPage> {
		const response = await this.client.fetch<ImmichSearchResponse>('/search/metadata', {
			method: 'POST',
			// Day grouping uses localDateTime, so pages are cut on it too.
			body: JSON.stringify({
				filter: structuredFilter(filter),
				orderBy: {field: 'localDateTime', direction: 'desc'},
				size: FILTER_PAGE_SIZE,
				cursor,
			}),
			signal,
		});
		return {assets: this.searchItemsToAssets(response), nextCursor: response.assets?.nextCursor ?? null};
	}

	public async countFiltered(filter: AssetFilter): Promise<number> {
		const response = await this.client.fetch<{total: number}>('/search/statistics', {
			method: 'POST',
			body: JSON.stringify({filter: structuredFilter(filter)}),
		});
		return response.total;
	}

	private searchItemsToAssets(response: ImmichSearchResponse): TimelineAsset[] {
		return this.visibleAssets(response.assets?.items);
	}

	private visibleAssets(items: ImmichAsset[] | undefined): TimelineAsset[] {
		if (!Array.isArray(items)) return [];
		return items
			// Search returns hidden assets (live-photo companion videos) whose thumbnails 404
			.filter((a) => a.visibility !== 'hidden' && a.visibility !== 'locked')
			.map((a) => this.assetFromImmichAsset(a));
	}

	public thumbnailUrl(assetId: string): string {
		return this.client.getThumbnailUrl(assetId, 'thumbnail');
	}

	public previewUrl(assetId: string): string {
		return this.client.getThumbnailUrl(assetId, 'preview');
	}

	public videoPlaybackUrl(assetId: string): string {
		return this.client.getVideoPlaybackUrl(assetId);
	}

	public faceUrl(personId: string): string {
		return this.client.getFaceThumbnailUrl(personId);
	}
}

export async function validateAuth(client: APIClient): Promise<boolean> {
	try {
		await client.fetch('/users/me');
		return true;
	} catch (error) {
		if (error instanceof APIError && error.status === 401) return false;
		throw error;
	}
}
