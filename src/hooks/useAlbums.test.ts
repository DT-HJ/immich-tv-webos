import {browsableAlbums} from './useAlbums';
import type {Album} from '../domain/types';

const album = (albumName: string, assetCount: number, endDate?: string | null): Album => ({
	id: albumName,
	albumName,
	description: '',
	albumThumbnailAssetId: null,
	assetCount,
	endDate,
});

test('empty albums are hidden; the rest go newest content first, then by name', () => {
	const albums = [album('Quick Share', 0), album('Camera', 67, '2026-10-20T00:00:00.000Z'), album('Trip', 5, '2026-10-28T00:00:00.000Z'), album('Old', 3, null), album('A', 3, null)];
	expect(browsableAlbums(albums).map((a) => a.albumName)).toEqual(['Trip', 'Camera', 'A', 'Old']);
});
