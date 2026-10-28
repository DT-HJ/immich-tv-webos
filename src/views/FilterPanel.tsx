import React, {useCallback, useMemo, useState} from 'react';
import {flushSync} from 'react-dom';
import Spotlight from '@enact/spotlight';
import {FilterChips, type FilterChipOption} from '../components/FilterChips/FilterChips';
import {DateRangePopup} from '../components/DateRangePopup/DateRangePopup';
import {QueryStateView} from '../components/QueryStateView';
import {TimelineGrid} from '../components/TimelineGrid/TimelineGrid';
import {useCameraMakes, useCameraModels, useFilteredAssets, useFilteredCount, useLibraryYears} from '../hooks/useFilteredAssets';
import {useFilterSelection} from '../hooks/useFilterSelection';
import {usePeople} from '../hooks/usePeople';
import {useAlbums} from '../hooks/useAlbums';
import {
	describeDate,
	describeSelection,
	EMPTY_SELECTION,
	formatDay,
	isEmptySelection,
	pruneSelection,
	rangeYear,
	resolveFilter,
	sameModel,
	toggleItem,
	toggleMake,
	yearRange,
	type DateRange,
	type ModelChoice,
} from '../domain/filterSelection';
import {createSpotlightContainer} from '../utils/spotlight';
import {formatCount, formatCountAtLeast} from '../utils/FormattingService';
import {t} from '../i18n/i18n';
import type {AssetFilter, AssetType, CameraGroup} from '../domain/types';
import type {RoutePanelProps} from '../types/navigation';
import css from './FilterPanel.module.less';

const Container = createSpotlightContainer({enterTo: 'last-focused'});

const ALL = '*';
const FAVORITES = 'favorites';
const CLEAR = 'clear';
const OTHERS = 'others';
const CUSTOM = 'custom';
const NO_CAMERAS: CameraGroup[] = [];

// Type row: the asset kind (one of three), an independent Favorites toggle, and (once anything is
// chosen) Clear, since the panel remembers its filter.
type TypeChip = {kind: 'type'; type: AssetType | null} | {kind: 'favorites'} | {kind: 'clear'};
const TYPE_OPTIONS: FilterChipOption<TypeChip>[] = [
	{key: ALL, label: t('filter.all'), value: {kind: 'type', type: null}},
	{key: 'IMAGE', label: t('filter.photos'), value: {kind: 'type', type: 'IMAGE'}},
	{key: 'VIDEO', label: t('filter.videos'), value: {kind: 'type', type: 'VIDEO'}},
	{key: FAVORITES, label: t('filter.favorites'), value: {kind: 'favorites'}},
];
const TYPE_OPTIONS_WITH_CLEAR: FilterChipOption<TypeChip>[] = [...TYPE_OPTIONS, {key: CLEAR, label: t('filter.clear'), value: {kind: 'clear'}}];

type DateChip = {kind: 'all'} | {kind: 'year'; year: number} | {kind: 'custom'};
type MakeChip = {kind: 'all'} | {kind: 'make'; label: string} | {kind: 'others'};
type ModelChip = {kind: 'all'} | {kind: 'model'; choice: ModelChoice};
type IdChip = {kind: 'all'} | {kind: 'id'; id: string};

const modelKey = (choice: ModelChoice) => `${choice.make}\u0000${choice.model ?? OTHERS}`;

const TYPE_ROW_ID = 'filter-type-row';
const DATE_ROW_ID = 'filter-date-row';

// A row whose focused control went away (the popup it opened, the Clear chip itself) takes focus
// back; it lands on its selected chip.
const focusRow = (rowId: string) => {
	Spotlight.setPointerMode(false);
	Spotlight.focus(rowId);
};

interface ResultsProps {
	filter: AssetFilter;
	title: string;
	contentWidth: number;
	onScrolledChange: (scrolled: boolean) => void;
}

const FilterResults: React.FC<ResultsProps> = ({filter, title, contentWidth, onScrolledChange}) => {
	const {groups, loadedCount, hasMore, isLoading, error, loadMore} = useFilteredAssets(filter);
	const {data: total} = useFilteredCount(filter);
	// Without the total, a partly loaded result reads "500+ items".
	const count = total !== undefined ? formatCount(total, 'item') : hasMore ? formatCountAtLeast(loadedCount) : formatCount(loadedCount, 'item');

	return (
		<>
			<div className={css.summary}>
				<span className={css.summaryTitle}>{title}</span>
				{!isLoading && !error && <span className={css.summaryCount}>{count}</span>}
			</div>
			<div className={css.results}>
				<QueryStateView isLoading={isLoading} error={error} isEmpty={groups.length === 0} loadingText={t('state.loading')} emptyText={t('filter.noMatch')}>
					<TimelineGrid groups={groups} contentWidth={contentWidth} onNearEnd={loadMore} totalCount={total} onScrolledChange={onScrolledChange} />
				</QueryStateView>
			</div>
		</>
	);
};

const FilterPanel: React.FC<RoutePanelProps> = ({contentWidth}) => {
	const [saved, update] = useFilterSelection();
	const [customOpen, setCustomOpen] = useState(false);
	// The chip rows fold away while the results are scrolled, giving the grid the screen; back at
	// the top of the results they return, so Up from the first row still reaches them. Tied to the
	// filter they were folded for: a new result set starts at the top, unfolded.
	const [foldedFor, setFoldedFor] = useState<string | null>(null);

	const {data: makes, isLoading: isMakesLoading} = useCameraMakes();
	const {data: years} = useLibraryYears();
	const {data: allPeople, isLoading: isPeopleLoading} = usePeople();
	const {data: albums, isLoading: isAlbumsLoading} = useAlbums();
	const people = useMemo(() => (allPeople ?? []).filter((person) => person.name), [allPeople]);

	const makeList = makes ?? NO_CAMERAS;
	const chosenMakes = useMemo(() => makeList.filter((make) => saved.makes.indexOf(make.label) >= 0), [makeList, saved.makes]);
	const {modelsByMake, isLoading: isModelsLoading} = useCameraModels(chosenMakes);

	// A restored choice whose make, model, person or album is gone no longer applies.
	const selection = useMemo(
		() =>
			pruneSelection(saved, {
				makes: makeList,
				modelsByMake,
				personIds: allPeople ? people.map((person) => person.id) : undefined,
				albumIds: albums ? albums.map((album) => album.id) : undefined,
			}),
		[saved, makeList, modelsByMake, allPeople, people, albums]
	);
	const filter = useMemo(() => resolveFilter(selection, {makes: makeList, modelsByMake}), [selection, makeList, modelsByMake]);
	const filterKey = JSON.stringify(filter);
	const folded = foldedFor === filterKey;
	const handleScrolledChange = useCallback((scrolled: boolean) => setFoldedFor(scrolled ? filterKey : null), [filterKey]);
	// Results wait for every list a choice depends on, so a restored filter is fetched once, whole.
	const ready =
		!isMakesLoading && !(selection.models.length && isModelsLoading) && !(selection.people.length && isPeopleLoading) && !(selection.albums.length && isAlbumsLoading);

	const handleType = useCallback(
		(chip: TypeChip) => {
			if (chip.kind !== 'clear') {
				update((s) => (chip.kind === 'favorites' ? {...s, favorites: !s.favorites} : {...s, type: chip.type}));
				return;
			}
			flushSync(() => update(() => EMPTY_SELECTION));
			focusRow(TYPE_ROW_ID);
		},
		[update]
	);
	const handleDate = useCallback(
		(chip: DateChip) => {
			if (chip.kind === 'custom') setCustomOpen(true);
			else update((s) => ({...s, date: chip.kind === 'year' ? (rangeYear(s.date) === chip.year ? null : yearRange(chip.year)) : null}));
		},
		[update]
	);
	const handleMake = useCallback(
		(chip: MakeChip) =>
			update((s) =>
				chip.kind === 'all' ? {...s, makes: [], models: [], noMake: false} : chip.kind === 'others' ? {...s, noMake: !s.noMake} : toggleMake(s, chip.label)
			),
		[update]
	);
	const handleModel = useCallback(
		(chip: ModelChip) => update((s) => ({...s, models: chip.kind === 'all' ? [] : toggleItem(s.models, chip.choice, sameModel)})),
		[update]
	);
	const handlePerson = useCallback((chip: IdChip) => update((s) => ({...s, people: chip.kind === 'all' ? [] : toggleItem(s.people, chip.id)})), [update]);
	const handleAlbum = useCallback((chip: IdChip) => update((s) => ({...s, albums: chip.kind === 'all' ? [] : toggleItem(s.albums, chip.id)})), [update]);

	const closeCustom = useCallback(() => {
		flushSync(() => setCustomOpen(false));
		focusRow(DATE_ROW_ID);
	}, []);
	const applyCustom = useCallback(
		(range: DateRange) => {
			flushSync(() => {
				setCustomOpen(false);
				update((s) => ({...s, date: range}));
			});
			focusRow(DATE_ROW_ID);
		},
		[update]
	);

	const customRange = selection.date && rangeYear(selection.date) === null ? selection.date : null;
	const dateOptions = useMemo<FilterChipOption<DateChip>[]>(
		() => [
			{key: ALL, label: t('filter.allTime'), value: {kind: 'all'}},
			...(years ?? []).map((year) => ({key: String(year), label: String(year), value: {kind: 'year', year} as DateChip})),
			{key: CUSTOM, label: customRange ? describeDate(customRange) : t('filter.custom'), value: {kind: 'custom'}},
		],
		[years, customRange]
	);
	const makeOptions = useMemo<FilterChipOption<MakeChip>[]>(
		() => [
			{key: ALL, label: t('filter.all'), value: {kind: 'all'}},
			...makeList.map((make) => ({key: make.label, label: make.label, value: {kind: 'make', label: make.label} as MakeChip})),
			{key: OTHERS, label: t('filter.others'), value: {kind: 'others'}},
		],
		[makeList]
	);
	// Each chosen make lists its own models and its "no model" chip; with several makes, the make
	// prefixes them so equal model names stay apart.
	const modelOptions = useMemo<FilterChipOption<ModelChip>[]>(() => {
		const prefixed = chosenMakes.length > 1;
		const options: FilterChipOption<ModelChip>[] = [];
		for (const make of chosenMakes) {
			const models = modelsByMake.get(make.label);
			if (!models?.length) continue;
			const name = (label: string) => (prefixed ? `${make.label} ${label}` : label);
			for (const model of models) {
				const choice = {make: make.label, model: model.label};
				options.push({key: modelKey(choice), label: name(model.label), value: {kind: 'model', choice}});
			}
			const others = {make: make.label, model: null};
			options.push({key: modelKey(others), label: name(t('filter.others')), value: {kind: 'model', choice: others}});
		}
		return options.length ? [{key: ALL, label: t('filter.all'), value: {kind: 'all'}}, ...options] : [];
	}, [chosenMakes, modelsByMake]);
	const peopleOptions = useMemo<FilterChipOption<IdChip>[]>(
		() => (people.length ? [{key: ALL, label: t('filter.all'), value: {kind: 'all'}}, ...people.map((p) => ({key: p.id, label: p.name, value: {kind: 'id', id: p.id} as IdChip}))] : []),
		[people]
	);
	const albumOptions = useMemo<FilterChipOption<IdChip>[]>(
		() =>
			albums?.length
				? [{key: ALL, label: t('filter.all'), value: {kind: 'all'}}, ...albums.map((a) => ({key: a.id, label: a.albumName, value: {kind: 'id', id: a.id} as IdChip}))]
				: [],
		[albums]
	);

	const typeKeys = [selection.type ?? ALL, ...(selection.favorites ? [FAVORITES] : [])];
	const dateKeys = [selection.date ? (customRange ? CUSTOM : String(rangeYear(selection.date))) : ALL];
	const makeKeys = [...selection.makes, ...(selection.noMake ? [OTHERS] : [])];
	const modelKeys = selection.models.map(modelKey);

	const names = useMemo(
		() => ({people: new Map(people.map((p) => [p.id, p.name])), albums: new Map((albums ?? []).map((a) => [a.id, a.albumName]))}),
		[people, albums]
	);
	const today = formatDay(new Date());
	const popupInitial = selection.date ?? {from: today, to: today};
	const minYear = years?.length ? years[years.length - 1]! : 1970;
	const maxYear = Math.max(new Date().getFullYear(), years?.[0] ?? 0);

	return (
		<Container className={css.filterPanel}>
			<div className={folded ? `${css.controls} ${css.folded}` : css.controls}>
				<FilterChips
					label={t('filter.type')}
					options={isEmptySelection(selection) ? TYPE_OPTIONS : TYPE_OPTIONS_WITH_CLEAR}
					selectedKeys={typeKeys}
					onSelect={handleType}
					spotlightId={TYPE_ROW_ID}
				/>
				<FilterChips label={t('filter.date')} options={dateOptions} selectedKeys={dateKeys} onSelect={handleDate} spotlightId={DATE_ROW_ID} />
				{!isMakesLoading && <FilterChips label={t('filter.camera')} options={makeOptions} selectedKeys={makeKeys.length ? makeKeys : [ALL]} onSelect={handleMake} />}
				{modelOptions.length > 0 && (
					<FilterChips label={t('filter.model')} options={modelOptions} selectedKeys={modelKeys.length ? modelKeys : [ALL]} onSelect={handleModel} />
				)}
				{peopleOptions.length > 0 && (
					<FilterChips label={t('filter.people')} options={peopleOptions} selectedKeys={selection.people.length ? selection.people : [ALL]} onSelect={handlePerson} />
				)}
				{albumOptions.length > 0 && (
					<FilterChips label={t('filter.albums')} options={albumOptions} selectedKeys={selection.albums.length ? selection.albums : [ALL]} onSelect={handleAlbum} />
				)}
			</div>
			{!ready ? null : isEmptySelection(selection) ? (
				<div className={css.results}>
					<QueryStateView isLoading={false} error={null} isEmpty emptyText={t('filter.prompt')}>
						{null}
					</QueryStateView>
				</div>
			) : (
				// Remounting the grid per filter starts each result set at the top.
				<FilterResults
					key={filterKey}
					filter={filter}
					title={describeSelection(selection, names)}
					contentWidth={contentWidth}
					onScrolledChange={handleScrolledChange}
				/>
			)}
			{customOpen && <DateRangePopup initial={popupInitial} minYear={minYear} maxYear={maxYear} onApply={applyCustom} onCancel={closeCustom} />}
		</Container>
	);
};

export default FilterPanel;
