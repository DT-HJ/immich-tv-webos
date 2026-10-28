import React, {useCallback, useState} from 'react';
import {AssetGridView} from '../components/AssetGridView';
import {useMemories} from '../hooks/useMemories';
import {memoryHeader} from '../domain/memories';
import {t} from '../i18n/i18n';
import {formatCount, formatMonthDay} from '../utils/FormattingService';
import type {RoutePanelProps} from '../types/navigation';

/** "On this day": today's date in every earlier year, newest first, each day headed "N years ago". */
const MemoriesPanel: React.FC<RoutePanelProps> = ({contentWidth}) => {
	// Fixed for the panel's lifetime, so a visit across midnight doesn't reshuffle what is on screen.
	const [today] = useState(() => new Date());
	const {memories, isLoading, error} = useMemories(today);
	const formatHeader = useCallback((timeBucket: string) => memoryHeader(timeBucket, today), [today]);

	const title = t(memories.window === 'week' ? 'memories.weekTitle' : 'memories.title');
	const subtitle = memories.count ? `${formatMonthDay(today.getMonth() + 1, today.getDate())} · ${formatCount(memories.count, 'item')}` : '';

	return (
		<AssetGridView
			title={title}
			subtitle={subtitle}
			groups={memories.groups}
			isLoading={isLoading}
			error={error}
			isEmpty={memories.groups.length === 0}
			emptyText={t('memories.empty')}
			loadingText={t('memories.loading')}
			spotlightId="memories-grid"
			contentWidth={contentWidth}
			formatHeader={formatHeader}
		/>
	);
};

export default MemoriesPanel;
