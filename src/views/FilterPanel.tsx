import React, {useCallback, useMemo, useState} from 'react';
import {FilterChips, type FilterChipOption} from '../components/FilterChips/FilterChips';
import {QueryStateView} from '../components/QueryStateView';
import {TimelineGrid} from '../components/TimelineGrid/TimelineGrid';
import {useCameraMakes, useCameraModels, useFilteredAssets, useFilteredCount} from '../hooks/useFilteredAssets';
import {createSpotlightContainer} from '../utils/spotlight';
import {formatCount} from '../utils/FormattingService';
import type {AssetFilter, AssetType, CameraGroup} from '../domain/types';
import type {RoutePanelProps} from '../types/navigation';
import css from './FilterPanel.module.less';

const Container = createSpotlightContainer({enterTo: 'last-focused'});

const ALL = '*';

const TYPE_OPTIONS: FilterChipOption<AssetType | null>[] = [
	{key: ALL, label: 'All', value: null},
	{key: 'IMAGE', label: 'Photos', value: 'IMAGE'},
	{key: 'VIDEO', label: 'Videos', value: 'VIDEO'},
];

const groupOptions = (groups: CameraGroup[] | undefined): FilterChipOption<CameraGroup | null>[] => [
	{key: ALL, label: 'All', value: null},
	...(groups ?? []).map((group) => ({key: group.label, label: group.label, value: group})),
];

const isEmptyFilter = (filter: AssetFilter) => !filter.type && !filter.makes && !filter.models;

const describe = (type: AssetType | null, make: CameraGroup | null, model: CameraGroup | null): string => {
	const kind = type === 'IMAGE' ? 'Photos' : type === 'VIDEO' ? 'Videos' : 'Photos & videos';
	const camera = model ? `${make?.label ?? ''} ${model.label}`.trim() : make?.label;
	return camera ? `${kind} · ${camera}` : kind;
};

interface ResultsProps {
	filter: AssetFilter;
	title: string;
	contentWidth: number;
}

const FilterResults: React.FC<ResultsProps> = ({filter, title, contentWidth}) => {
	const {groups, loadedCount, hasMore, isLoading, error, loadMore} = useFilteredAssets(filter);
	const {data: total} = useFilteredCount(filter);
	// Without the total, a partly loaded result reads "500+ items".
	const count =
		total !== undefined ? formatCount(total, 'item') : hasMore ? `${loadedCount.toLocaleString('en-US')}+ items` : formatCount(loadedCount, 'item');

	return (
		<>
			<div className={css.summary}>
				<span className={css.summaryTitle}>{title}</span>
				{!isLoading && !error && <span className={css.summaryCount}>{count}</span>}
			</div>
			<div className={css.results}>
				<QueryStateView isLoading={isLoading} error={error} isEmpty={groups.length === 0} loadingText="Loading…" emptyText="Nothing matches this filter.">
					<TimelineGrid groups={groups} contentWidth={contentWidth} onNearEnd={loadMore} totalCount={total} />
				</QueryStateView>
			</div>
		</>
	);
};

const FilterPanel: React.FC<RoutePanelProps> = ({contentWidth}) => {
	const [type, setType] = useState<AssetType | null>(null);
	const [make, setMake] = useState<CameraGroup | null>(null);
	const [model, setModel] = useState<CameraGroup | null>(null);

	const {data: makes, isLoading: isMakesLoading} = useCameraMakes();
	const {data: models} = useCameraModels(make ? make.values : null);

	const handleMake = useCallback((next: CameraGroup | null) => {
		setMake(next);
		setModel(null);
	}, []);

	const filter = useMemo<AssetFilter>(
		() => ({
			type: type ?? undefined,
			makes: make ? make.values : undefined,
			models: model ? model.values : undefined,
		}),
		[type, make, model]
	);
	const makeOptions = useMemo(() => groupOptions(makes), [makes]);
	const modelOptions = useMemo(() => groupOptions(models), [models]);
	// Remounting the grid per filter starts each result set at the top.
	const resultsKey = `${type ?? ALL}|${make?.label ?? ALL}|${model?.label ?? ALL}`;

	return (
		<Container className={css.filterPanel}>
			<div className={css.controls}>
				<FilterChips label="Type" options={TYPE_OPTIONS} selectedKey={type ?? ALL} onSelect={setType} />
				{!isMakesLoading && <FilterChips label="Camera" options={makeOptions} selectedKey={make?.label ?? ALL} onSelect={handleMake} />}
				{make && models && models.length > 0 && (
					<FilterChips label="Model" options={modelOptions} selectedKey={model?.label ?? ALL} onSelect={setModel} />
				)}
			</div>
			{isEmptyFilter(filter) ? (
				<div className={css.results}>
					<QueryStateView isLoading={false} error={null} isEmpty emptyText="Choose a type or a camera">
						{null}
					</QueryStateView>
				</div>
			) : (
				<FilterResults key={resultsKey} filter={filter} title={describe(type, make, model)} contentWidth={contentWidth} />
			)}
		</Container>
	);
};

export default FilterPanel;
