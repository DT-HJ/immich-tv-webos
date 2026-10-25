import React, {useCallback} from 'react';
import Scroller from '@enact/sandstone/Scroller';
import ri from '@enact/ui/resolution';
import {SpottableButton} from '../../utils/spotlight';
import css from './FilterChips.module.less';

export interface FilterChipOption<T> {
	key: string;
	label: string;
	value: T;
}

interface FilterChipsProps<T> {
	label: string;
	options: FilterChipOption<T>[];
	selectedKey: string;
	onSelect: (value: T) => void;
}

interface ChipProps<T> {
	option: FilterChipOption<T>;
	isSelected: boolean;
	onSelect: (value: T) => void;
}

const Chip = <T,>({option, isSelected, onSelect}: ChipProps<T>) => {
	const handleClick = useCallback(() => onSelect(option.value), [option.value, onSelect]);
	return (
		<SpottableButton className={isSelected ? `${css.chip} ${css.selected}` : css.chip} onClick={handleClick}>
			{option.label}
		</SpottableButton>
	);
};

/** One labelled row of single-choice chips, scrolling sideways when it outgrows the screen. */
export const FilterChips = <T,>({label, options, selectedKey, onSelect}: FilterChipsProps<T>) => (
	<div className={css.row}>
		<span className={css.label}>{label}</span>
		<div className={css.chipsWrapper}>
			<Scroller direction="horizontal" scrollMode="native" horizontalScrollbar="hidden" style={{height: ri.scale(112)}}>
				<div className={css.chips}>
					{options.map((option) => (
						<Chip key={option.key} option={option} isSelected={option.key === selectedKey} onSelect={onSelect} />
					))}
				</div>
			</Scroller>
		</div>
	</div>
);
