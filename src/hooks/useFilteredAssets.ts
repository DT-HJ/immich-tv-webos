import {useInfiniteQuery} from '@tanstack/react-query';
import {useCallback, useMemo} from 'react';
import {ASSETS_QUERY_CONFIG, useRepositoryQuery} from './queryConfig';
import {useRepository} from '../domain/RepositoryContext';
import {groupAssetsByDay} from '../domain/transforms';
import type {AssetFilter, DayGroup} from '../domain/types';

const filterKey = ({type, makes, models}: AssetFilter) => [type ?? '', (makes ?? []).join('\u0000'), (models ?? []).join('\u0000')];

export const useCameraMakes = () => useRepositoryQuery(['camera-makes'], (r) => r.getCameraMakes(), {staleTime: 30 * 60 * 1000});

// `null` while no make is chosen: models only make sense within one.
export const useCameraModels = (makes: string[] | null) =>
	useRepositoryQuery(['camera-models', (makes ?? []).join('\u0000')], (r) => r.getCameraModels(makes!), {
		enabled: !!makes,
		staleTime: 30 * 60 * 1000,
	});

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
