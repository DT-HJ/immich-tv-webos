export type AssetType = 'IMAGE' | 'VIDEO';

export interface TimelineAsset {
	id: string;
	type: AssetType;
	ratio: number;
	// Local wall-clock time; day grouping must use it to match the server's month buckets,
	// which are cut on localDateTime, not UTC.
	localDateTime: string;
	durationSeconds: number | null;
	city?: string | null;
	country?: string | null;
}

export interface TimelineBucket {
	timeBucket: string;
	count: number;
}

export interface DayGroup {
	timeBucket: string;
	assets: TimelineAsset[];
	count: number;
}

export interface Album {
	id: string;
	albumName: string;
	description: string;
	albumThumbnailAssetId: string | null;
	assetCount: number;
}

export type AssetOrder = 'asc' | 'desc';

export interface AlbumDetails extends Album {
	order: AssetOrder;
}

// The empty scope is the main library timeline.
export interface TimelineScope {
	albumId?: string;
	personId?: string;
	order?: AssetOrder;
}

export const MAIN_TIMELINE: TimelineScope = {};

export interface Place {
	city: string;
	country: string | null;
	thumbnailAssetId: string;
}

export interface Person {
	id: string;
	name: string;
	assetCount: number;
}

// One camera make or model as shown to the user; `values` are the exact spellings stored by the
// server (EXIF case varies by firmware: 'Sony'/'SONY', 'samsung'/'Samsung'/'SAMSUNG').
export interface CameraGroup {
	label: string;
	values: string[];
}

// One chosen camera make (every spelling of it), optionally narrowed to some of its models and/or
// to its assets without a model. Neither set: the whole make.
export interface CameraFilter {
	makes: string[];
	models?: string[];
	noModel?: boolean;
}

// Library-wide filter; an unset field matches everything. Fields combine with AND; the camera
// choices (`cameras`, `noMake`) are alternatives to each other.
export interface AssetFilter {
	type?: AssetType;
	favorites?: boolean;
	// Capture instant bounds (ISO): `takenFrom` inclusive, `takenBefore` exclusive.
	takenFrom?: string;
	takenBefore?: string;
	cameras?: CameraFilter[];
	// Assets with no camera make (or a placeholder such as '' or 'none').
	noMake?: boolean;
	// Any of these people / albums.
	personIds?: string[];
	albumIds?: string[];
}

export interface AssetPage {
	assets: TimelineAsset[];
	nextCursor: string | null;
}
