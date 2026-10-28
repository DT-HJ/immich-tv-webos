import React, {useCallback, useEffect, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Button from '@enact/sandstone/Button';
import ri from '@enact/ui/resolution';
import {useWebOSKeys} from '../hooks/useWebOSKeys';
import {createSpotlightContainer} from '../utils/spotlight';
import {GRID_INSET_LEFT_PX} from '../utils/constants';
import {TimelineGrid, type TimelineGridHandle, type TimelineGridTimeline} from './TimelineGrid/TimelineGrid';
import {QueryStateView} from './QueryStateView';
import type {DayGroup} from '../domain/types';
import css from './AssetGridView.module.less';
import {t} from '../i18n/i18n';

const Container = createSpotlightContainer({enterTo: 'last-focused'});
const GridContainer = createSpotlightContainer({enterTo: 'last-focused'});

interface AssetGridViewProps {
	title: string;
	subtitle: string;
	groups?: DayGroup[];
	timeline?: TimelineGridTimeline;
	isLoading: boolean;
	error: unknown;
	isEmpty: boolean;
	emptyText?: string;
	loadingText?: string;
	spotlightId: string;
	// Detail views (album, place) go back to their list; a root view (Memories) has no back.
	onBack?: () => void;
	contentWidth: number;
	formatHeader?: (timeBucket: string) => string;
}

/** Shared layout for asset collections (album, place, memories): header + day-grouped grid. */
export const AssetGridView: React.FC<AssetGridViewProps> = ({
	title,
	subtitle,
	groups,
	timeline,
	isLoading,
	error,
	isEmpty,
	emptyText = '',
	loadingText,
	spotlightId,
	onBack,
	contentWidth,
	formatHeader,
}) => {
	useWebOSKeys({onBack});
	const gridRef = useRef<TimelineGridHandle>(null);
	const startSlideshow = useCallback(() => gridRef.current?.startSlideshow(), []);

	// When assets finish loading, move focus into the photo grid so the user can start
	// navigating photos right away (its cards mount in the same commit as the data). The back
	// button remains reachable via remote Back (above) and via D-pad up from the top row. Keyed
	// on a boolean so later month loads don't steal focus mid-scroll.
	const hasContent = timeline ? timeline.loadedMonths.size > 0 : !!groups?.length;
	useEffect(() => {
		if (hasContent) Spotlight.focus(spotlightId);
	}, [hasContent, spotlightId]);

	// Empty or failed collections have no grid to land on: rest focus on the back button.
	const backSpotlightId = `${spotlightId}-back`;
	const hasNothingToShow = !isLoading && (!!error || isEmpty);
	useEffect(() => {
		if (!hasNothingToShow || !onBack) return;
		const raf = requestAnimationFrame(() => Spotlight.focus(backSpotlightId));
		return () => cancelAnimationFrame(raf);
	}, [hasNothingToShow, backSpotlightId, onBack]);

	return (
		<Container className={css.view}>
			<div className={css.header} style={{paddingLeft: ri.scale(GRID_INSET_LEFT_PX)}}>
				{onBack && (
					<div className={css.back}>
						<Button icon="arrowlargeleft" size="small" backgroundOpacity="transparent" spotlightId={backSpotlightId} onClick={onBack} />
					</div>
				)}
				<div className={onBack ? css.heading : `${css.heading} ${css.headingRoot}`}>
					<span className={css.title}>{title}</span>
					{subtitle && !isLoading && <span className={css.count}>{subtitle}</span>}
				</div>
				{hasContent && (
					<Button icon="play" size="small" backgroundOpacity="transparent" onClick={startSlideshow}>
						{t('slideshow.start')}
					</Button>
				)}
			</div>
			<GridContainer spotlightId={spotlightId} className={css.listContainer}>
				<QueryStateView isLoading={isLoading} error={error} isEmpty={isEmpty} loadingText={loadingText ?? t('state.loading')} emptyText={emptyText}>
					<TimelineGrid ref={gridRef} groups={groups} timeline={timeline} contentWidth={contentWidth} formatHeader={formatHeader} />
				</QueryStateView>
			</GridContainer>
		</Container>
	);
};

AssetGridView.displayName = 'AssetGridView';
