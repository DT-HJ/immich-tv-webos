import type {Album, AlbumDetails, AssetDetails, AssetFilter, AssetPage, CameraGroup, Person, Place, TimelineAsset, TimelineBucket, TimelineScope} from './types';

export interface PhotoRepository {
	getBuckets(scope?: TimelineScope): Promise<TimelineBucket[]>;
	getBucketAssets(timeBucket: string, scope?: TimelineScope, signal?: AbortSignal): Promise<TimelineAsset[]>;

	getAlbums(): Promise<Album[]>;
	getAssetDetails(assetId: string): Promise<AssetDetails>;
	getAlbum(albumId: string): Promise<AlbumDetails>;

	getPeople(): Promise<Person[]>;

	getPlaces(): Promise<Place[]>;

	searchSmart(query: string): Promise<TimelineAsset[]>;
	searchByCity(city: string): Promise<TimelineAsset[]>;
	searchRandomImages(scope: TimelineScope, size: number): Promise<TimelineAsset[]>;

	getCameraMakes(): Promise<CameraGroup[]>;
	getCameraModels(makes: string[]): Promise<CameraGroup[]>;
	searchFiltered(filter: AssetFilter, cursor?: string, signal?: AbortSignal): Promise<AssetPage>;
	countFiltered(filter: AssetFilter): Promise<number>;

	thumbnailUrl(assetId: string): string;
	previewUrl(assetId: string): string;
	videoPlaybackUrl(assetId: string): string;
	faceUrl(personId: string): string;
}
