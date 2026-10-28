import React, {useCallback, useState} from 'react';
import Button from '@enact/sandstone/Button';
import DatePicker from '@enact/sandstone/DatePicker';
import Popup from '@enact/sandstone/Popup';
import {useWebOSKeys} from '../../hooks/useWebOSKeys';
import {formatDay, parseDay, type DateRange} from '../../domain/filterSelection';
import css from './DateRangePopup.module.less';
import {t} from '../../i18n/i18n';

interface DateRangePopupProps {
	initial: DateRange;
	minYear: number;
	maxYear: number;
	onApply: (range: DateRange) => void;
	onCancel: () => void;
}

/**
 * From / To day pickers in a popup. Mounted only while open: our Back bridge preempts Sandstone's
 * Cancelable, so Back is routed to `onCancel` here instead of leaving the panel.
 */
export const DateRangePopup: React.FC<DateRangePopupProps> = ({initial, minYear, maxYear, onApply, onCancel}) => {
	const [from, setFrom] = useState(() => parseDay(initial.from));
	const [to, setTo] = useState(() => parseDay(initial.to));

	useWebOSKeys({onBack: onCancel});

	const handleFrom = useCallback(({value}: {value: Date}) => setFrom(value), []);
	const handleTo = useCallback(({value}: {value: Date}) => setTo(value), []);
	// Picked backwards: still the range between the two days.
	const handleApply = useCallback(() => {
		const [start, end] = from <= to ? [from, to] : [to, from];
		onApply({from: formatDay(start), to: formatDay(end)});
	}, [from, to, onApply]);

	// Sandstone's typings omit the runtime onChange payload; same `as any` pattern as VideoPlayer.
	const fromProps = {value: from, onChange: handleFrom, minYear, maxYear} as any;
	const toProps = {value: to, onChange: handleTo, minYear, maxYear} as any;

	// One row: a picker owns Up/Down (they change its value), so From, To and the buttons are
	// reached with Left/Right alone.
	return (
		<Popup open position="center" scrimType="translucent" noAnimation onClose={onCancel}>
			<div className={css.content}>
				<div className={css.heading}>{t('filter.rangeTitle')}</div>
				<div className={css.row}>
					<div className={css.field}>
						<div className={css.caption}>{t('filter.rangeFrom')}</div>
						<DatePicker {...fromProps} />
					</div>
					<div className={css.field}>
						<div className={css.caption}>{t('filter.rangeTo')}</div>
						<DatePicker {...toProps} />
					</div>
					<div className={css.actions}>
						<Button size="small" onClick={handleApply}>
							{t('filter.apply')}
						</Button>
						<Button size="small" onClick={onCancel}>
							{t('filter.cancel')}
						</Button>
					</div>
				</div>
				<div className={css.hint}>{t('filter.rangeHint')}</div>
			</div>
		</Popup>
	);
};
