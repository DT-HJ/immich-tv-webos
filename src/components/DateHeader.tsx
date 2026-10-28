import React, {useMemo} from 'react';
import {formatBucketDate} from '../utils/FormattingService';
import css from './DateHeader.module.less';

interface DateHeaderProps {
	timeBucket: string;
	// Replaces the plain date (e.g. "2 years ago · …" in Memories).
	format?: (timeBucket: string) => string;
}

export const DateHeader: React.FC<DateHeaderProps> = React.memo(({timeBucket, format}) => {
	const displayDate = useMemo(() => (format ? format(timeBucket) : formatBucketDate(timeBucket)), [timeBucket, format]);
	return (
		<div className={css.dateHeader} data-spotlight-disabled="true">
			{displayDate}
		</div>
	);
});

DateHeader.displayName = 'DateHeader';
