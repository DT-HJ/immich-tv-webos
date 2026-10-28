import {useRepositoryQuery} from './queryConfig';
import type {Album} from '../domain/types';

// Empty albums (phone sync creates some: "Screen recordings", "Quick Share") have nothing to
// open; the rest go newest content first, then by name.
export function browsableAlbums(albums: readonly Album[]): Album[] {
	return albums
		.filter((album) => album.assetCount > 0)
		.sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? '') || a.albumName.localeCompare(b.albumName));
}

export const useAlbums = () => useRepositoryQuery(['albums'], async (r) => browsableAlbums(await r.getAlbums()));
