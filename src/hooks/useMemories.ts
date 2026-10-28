import {useMemo} from 'react';
import {useRepositoryQuery} from './queryConfig';
import {useLibraryYears} from './useFilteredAssets';
import {groupAssetsByDay} from '../domain/transforms';
import {memoryRanges, type MemoryWindow} from '../domain/memories';
import type {DayGroup, TimelineAsset} from '../domain/types';
import type {PhotoRepository} from '../domain/PhotoRepository';

export interface Memories {
	window: MemoryWindow;
	groups: DayGroup[];
	count: number;
}

const NO_GROUPS: DayGroup[] = [];

async function collect(repository: PhotoRepository, today: Date, years: readonly number[], span: MemoryWindow): Promise<TimelineAsset[]> {
	// One request per earlier year: each is a single day (or week), so the first page holds it.
	const pages = await Promise.all(
		memoryRanges(today, years, span).map((range) => repository.searchFiltered({takenFrom: range.from.toISOString(), takenBefore: range.before.toISOString()}))
	);
	return pages.flatMap((page) => page.assets);
}

/**
 * "On this day": what was taken on today's date in each earlier year of the library, newest
 * year first. A day with nothing in any year widens to the surrounding week.
 */
export const useMemories = (today: Date) => {
	const {data: years, isLoading: isYearsLoading, error: yearsError} = useLibraryYears();
	const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
	const query = useRepositoryQuery(
		['memories', dayKey, ...(years ?? [])],
		async (repository): Promise<{window: MemoryWindow; assets: TimelineAsset[]}> => {
			const sameDay = await collect(repository, today, years ?? [], 'day');
			if (sameDay.length) return {window: 'day', assets: sameDay};
			return {window: 'week', assets: await collect(repository, today, years ?? [], 'week')};
		},
		{enabled: !!years, staleTime: 30 * 60 * 1000}
	);

	const memories = useMemo<Memories>(() => {
		const assets = query.data?.assets;
		return {window: query.data?.window ?? 'day', groups: assets ? groupAssetsByDay(assets) : NO_GROUPS, count: assets?.length ?? 0};
	}, [query.data]);

	return {memories, isLoading: isYearsLoading || query.isLoading, error: yearsError ?? query.error};
};
