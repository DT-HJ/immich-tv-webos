import {useInfiniteQuery} from '@tanstack/react-query';
import {useCallback, useMemo} from 'react';
import {ASSETS_QUERY_CONFIG, useRepositoryQuery} from './queryConfig';
import {useRepository} from '../domain/RepositoryContext';
import {groupAssetsByDay} from '../domain/transforms';
import type {AssetFilter, CameraGroup, DayGroup} from '../domain/types';

// Every field of the filter: a narrower date, person or album must not reuse a cached result.
const filterKey = (filter: AssetFilter) => [JSON.stringify(filter)];

export const useCameraMakes = () => useRepositoryQuery(['camera-makes'], (r) => r.getCameraMakes(), {staleTime: 30 * 60 * 1000});

const NO_MODELS: ReadonlyMap<string, CameraGroup[]> = new Map();

/** Models of each chosen make, by make label (each make keeps its own list, for per-make chips). */
export const useCameraModels = (makes: readonly CameraGroup[]) => {
	const query = useRepositoryQuery(
		['camera-models', ...makes.map((make) => make.values.join('\u0000'))],
		async (r) => new Map(await Promise.all(makes.map(async (make) => [make.label, await r.getCameraModels(make.values)] as const))),
		{enabled: makes.length > 0, staleTime: 30 * 60 * 1000}
	);
	return {modelsByMake: (query.data as ReadonlyMap<string, CameraGroup[]> | undefined) ?? NO_MODELS, isLoading: makes.length > 0 && query.isLoading};
};

/** Years with at least one asset, newest first. */
export const useLibraryYears = () =>
	useRepositoryQuery(['filter-years'], async (r) => {
		const years = (await r.getBuckets()).map((bucket) => Number(bucket.timeBucket.slice(0, 4)));
		return years.filter((year, i) => year > 0 && years.indexOf(year) === i).sort((a, b) => b - a);
	}, {staleTime: 30 * 60 * 1000});

// Library-wide total for the filter. Optional: the API key needs `asset.statistics`, and the
// panel falls back to the loaded count without it.
export const useFilteredCount = (filter: AssetFilter) =>
	useRepositoryQuery(['filtered-count', ...filterKey(filter)], (r) => r.countFiltered(filter), {retry: false});

/** Filter results, a page at a time: `loadMore` is called as the grid nears its end. */
export const useFilteredAssets = (
	filter: AssetFilter
): {
	groups: DayGroup[];
	loadedCount: number;
	hasMore: boolean;
	isLoading: boolean;
	error: unknown;
	loadMore: () => void;
} => {
	const repository = useRepository();
	const result = useInfiniteQuery({
		queryKey: ['filtered', ...filterKey(filter)],
		queryFn: ({pageParam, signal}) => repository.searchFiltered(filter, pageParam, signal),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		...ASSETS_QUERY_CONFIG,
	});

	const assets = useMemo(() => result.data?.pages.flatMap((page) => page.assets) ?? [], [result.data]);
	const groups = useMemo(() => groupAssetsByDay(assets), [assets]);

	const {hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage} = result;
	// A failed page is not retried by scrolling (that would hammer a broken server); the panel
	// is re-entered or the filter changed instead.
	const loadMore = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
	}, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

	return {
		groups,
		loadedCount: assets.length,
		hasMore: !!hasNextPage,
		isLoading: result.isLoading,
		// A later page failing keeps the pages already shown.
		error: result.data ? null : result.error,
		loadMore,
	};
};
