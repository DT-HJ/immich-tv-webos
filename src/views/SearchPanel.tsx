import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {flushSync} from 'react-dom';
import Input from '@enact/sandstone/Input';
import Spotlight from '@enact/spotlight';
import {FilterChips, type FilterChipOption} from '../components/FilterChips/FilterChips';
import {PeopleRibbon} from '../components/PeopleRibbon/PeopleRibbon';
import {QueryStateView} from '../components/QueryStateView';
import {TimelineGrid} from '../components/TimelineGrid/TimelineGrid';
import {usePeople} from '../hooks/usePeople';
import {useRecentSearches} from '../hooks/useRecentSearches';
import {RELEVANCE_GROUP, useSearch} from '../hooks/useSearch';
import {useTimeline} from '../hooks/useTimeline';
import {useWebOSKeys} from '../hooks/useWebOSKeys';
import {suggestedTerms, termFromInput, type SearchTerm} from '../domain/searchTerms';
import {getLanguage, t} from '../i18n/i18n';
import {formatBucketDate, formatCount} from '../utils/FormattingService';
import {createSpotlightContainer} from '../utils/spotlight';
import type {Person} from '../domain/types';
import type {RoutePanelProps} from '../types/navigation';
import css from './SearchPanel.module.less';

const Container = createSpotlightContainer({enterTo: 'default-element'});
const ResultsContainer = createSpotlightContainer({enterTo: 'last-focused'});
// Sandstone's Input doesn't put a spotlightId on its DOM node: focus goes to it through this.
const InputArea = createSpotlightContainer({enterTo: 'default-element'});

const SEARCH_INPUT_ID = 'search-input';
const RESULTS_ID = 'search-results';
const NONE: readonly string[] = [];
const NO_PEOPLE: Person[] = [];

type ActiveSearch = {type: 'smart'; term: SearchTerm} | {type: 'person'; personId: string};

const formatResultsHeader = (timeBucket: string) => (timeBucket === RELEVANCE_GROUP ? t('search.bestMatches') : formatBucketDate(timeBucket));

const toOptions = (terms: SearchTerm[]): FilterChipOption<SearchTerm>[] => terms.map((term) => ({key: term.label, label: term.label, value: term}));

const Summary: React.FC<{title: string; detail?: string}> = ({title, detail}) => (
	<div className={css.summary}>
		<span className={css.summaryTitle}>{title}</span>
		{detail && <span className={css.summaryDetail}>{detail}</span>}
	</div>
);

interface ResultsProps {
	contentWidth: number;
	onScrolledChange: (scrolled: boolean) => void;
}

const SmartResults: React.FC<ResultsProps & {term: SearchTerm}> = ({term, contentWidth, onScrolledChange}) => {
	const query = useMemo(() => ({type: 'smart' as const, value: term.query}), [term.query]);
	const {groups, isLoading, error} = useSearch(query);
	const count = groups.reduce((sum, group) => sum + group.count, 0);
	const hasResults = count > 0;

	// The results replace the chips that started the search: move into them once they are in.
	useEffect(() => {
		if (hasResults) Spotlight.focus(RESULTS_ID);
	}, [hasResults]);

	// A translated search names what was sent, so a miss can be told from a bad translation.
	const sent = term.query !== term.label ? `“${term.query}”` : '';
	const detail = [sent, !isLoading && !error ? formatCount(count, 'item') : ''].filter(Boolean).join(' · ');
	return (
		<>
			<Summary title={t('search.results', {q: term.label})} detail={detail} />
			<ResultsContainer spotlightId={RESULTS_ID} className={css.results}>
				<QueryStateView isLoading={isLoading} error={error} isEmpty={!hasResults} loadingText={t('state.searching')} emptyText={t('state.noResults')}>
					<TimelineGrid groups={groups} contentWidth={contentWidth} formatHeader={formatResultsHeader} onScrolledChange={onScrolledChange} />
				</QueryStateView>
			</ResultsContainer>
		</>
	);
};

const PersonResults: React.FC<ResultsProps & {person: Person | undefined; personId: string}> = ({person, personId, contentWidth, onScrolledChange}) => {
	const scope = useMemo(() => ({personId}), [personId]);
	const {timeline, isLoading, isError, error} = useTimeline(scope);
	const count = timeline.allBuckets.reduce((sum, bucket) => sum + bucket.count, 0);
	return (
		<>
			<Summary title={person?.name || t('search.people')} detail={isLoading ? '' : formatCount(count, 'item')} />
			<div className={css.results}>
				<QueryStateView
					isLoading={isLoading}
					error={isError ? error : null}
					isEmpty={timeline.allBuckets.length === 0}
					loadingText={t('state.searching')}
					emptyText={t('state.noResults')}
				>
					<TimelineGrid timeline={timeline} contentWidth={contentWidth} onScrolledChange={onScrolledChange} />
				</QueryStateView>
			</div>
		</>
	);
};

const SearchPanel: React.FC<RoutePanelProps> = ({contentWidth}) => {
	const [active, setActive] = useState<ActiveSearch | null>(null);
	const [inputValue, setInputValue] = useState('');
	const [recent, remember] = useRecentSearches();
	// Like the filter's chips, the search bar folds away while results are scrolled, for the search
	// it was folded for (a new search starts unfolded).
	const activeKey = active ? (active.type === 'smart' ? `q:${active.term.query}` : `p:${active.personId}`) : null;
	const [foldedFor, setFoldedFor] = useState<string | null>(null);
	const folded = !!activeKey && foldedFor === activeKey;
	const handleScrolledChange = useCallback((scrolled: boolean) => setFoldedFor(scrolled ? activeKey : null), [activeKey]);

	const {data: people = NO_PEOPLE, isLoading: isPeopleLoading} = usePeople();
	// Named people first; the unnamed follow as faces only.
	const orderedPeople = useMemo(() => [...people.filter((p) => p.name), ...people.filter((p) => !p.name)], [people]);

	const runTerm = useCallback(
		(term: SearchTerm) => {
			remember(term);
			setInputValue(term.label);
			setActive({type: 'smart', term});
			// The chip that was pressed goes away with the suggestions: hold focus on the input
			// until the results arrive and take it.
			Spotlight.setPointerMode(false);
			Spotlight.focus(SEARCH_INPUT_ID);
		},
		[remember]
	);

	const handleInputChange = useCallback((e: {value?: string}) => setInputValue(e.value ?? ''), []);
	const handleComplete = useCallback(
		(e: {value?: string}) => {
			const term = termFromInput(e.value ?? '');
			if (term) runTerm(term);
		},
		[runTerm]
	);

	const handlePersonSearch = useCallback((personId: string) => {
		setActive({type: 'person', personId});
		setInputValue('');
	}, []);

	// Back first clears a search, back to the suggestions; with none, it leaves the panel. The bar
	// may be folded away: render it back before focusing it.
	const clearSearch = useCallback(() => {
		flushSync(() => {
			setActive(null);
			setInputValue('');
		});
		Spotlight.setPointerMode(false);
		Spotlight.focus(SEARCH_INPUT_ID);
	}, []);
	useWebOSKeys({onBack: active ? clearSearch : undefined});

	const suggestionOptions = useMemo(() => toOptions(suggestedTerms(getLanguage())), []);
	const recentOptions = useMemo(() => toOptions(recent), [recent]);
	const selectedPersonId = active?.type === 'person' ? active.personId : null;

	return (
		<Container className={css.searchPanel}>
			<div className={folded ? `${css.searchBar} ${css.folded}` : css.searchBar}>
				<InputArea spotlightId={SEARCH_INPUT_ID} className={css.inputWrapper}>
					{/* Sandstone's typings omit onComplete, which Input forwards at runtime. */}
					<Input
						placeholder={t('search.placeholder')}
						value={inputValue}
						onChange={handleInputChange}
						size="small"
						iconBefore="search"
						data-spotlight-default-element
						className={css.searchInput}
						{...({onComplete: handleComplete} as any)}
					/>
				</InputArea>
				<PeopleRibbon people={orderedPeople} selectedPersonId={selectedPersonId} onSelectPerson={handlePersonSearch} isLoading={isPeopleLoading} />
			</div>
			{active?.type === 'smart' ? (
				<SmartResults key={active.term.query} term={active.term} contentWidth={contentWidth} onScrolledChange={handleScrolledChange} />
			) : active?.type === 'person' ? (
				<PersonResults
					key={active.personId}
					personId={active.personId}
					person={people.find((p) => p.id === active.personId)}
					contentWidth={contentWidth}
					onScrolledChange={handleScrolledChange}
				/>
			) : (
				<div className={css.suggestions}>
					{recentOptions.length > 0 && <FilterChips label={t('search.recent')} options={recentOptions} selectedKeys={NONE} onSelect={runTerm} />}
					<FilterChips label={t('search.suggested')} options={suggestionOptions} selectedKeys={NONE} onSelect={runTerm} />
					<div className={css.prompt}>{t('search.prompt')}</div>
				</div>
			)}
		</Container>
	);
};

export default SearchPanel;
