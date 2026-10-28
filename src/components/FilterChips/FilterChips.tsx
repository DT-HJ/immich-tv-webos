import React, {useCallback} from 'react';
import Scroller from '@enact/sandstone/Scroller';
import {spotlightDefaultClass} from '@enact/spotlight/SpotlightContainerDecorator';
import ri from '@enact/ui/resolution';
import {createSpotlightContainer, SpottableButton} from '../../utils/spotlight';
import css from './FilterChips.module.less';

// Each row is its own container: Up/Down moves row to row (never skipping a short row, as plain
// spatial navigation does from the far end of a long one) and lands on the selected chip.
const RowContainer = createSpotlightContainer({enterTo: 'default-element'});

// The row's fade mask covers its right end: keep the focused chip clear of it.
const centerInRow = (event: React.FocusEvent<HTMLButtonElement>) => event.currentTarget.scrollIntoView({block: 'nearest', inline: 'center'});

export interface FilterChipOption<T> {
	key: string;
	label: string;
	value: T;
}

interface FilterChipsProps<T> {
	label: string;
	options: FilterChipOption<T>[];
	// Several chips may be on (a multi-choice row); the row lands on the first of them.
	selectedKeys: readonly string[];
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
		<SpottableButton
			className={isSelected ? `${css.chip} ${css.selected} ${spotlightDefaultClass}` : css.chip}
			onClick={handleClick}
			onFocus={centerInRow}
		>
			{option.label}
		</SpottableButton>
	);
};

/** One labelled row of chips, scrolling sideways when it outgrows the screen. */
export const FilterChips = <T,>({label, options, selectedKeys, onSelect}: FilterChipsProps<T>) => (
	<RowContainer className={css.row}>
		<span className={css.label}>{label}</span>
		<div className={css.chipsWrapper}>
			<Scroller direction="horizontal" scrollMode="native" horizontalScrollbar="hidden" style={{height: ri.scale(112)}}>
				<div className={css.chips}>
					{options.map((option) => (
						<Chip key={option.key} option={option} isSelected={selectedKeys.indexOf(option.key) >= 0} onSelect={onSelect} />
					))}
					{/* Chromium < 91 leaves a flex scroller's end padding out of its scroll range. */}
					<div className={css.endSpacer} />
				</div>
			</Scroller>
		</div>
	</RowContainer>
);
