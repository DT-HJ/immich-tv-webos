import React, {useMemo} from 'react';
import {detailRows} from '../../domain/assetDetails';
import {useAssetDetails} from '../../hooks/useAssetDetails';
import {t} from '../../i18n/i18n';
import type {TimelineAsset} from '../../domain/types';
import css from './InfoPanel.module.less';

interface InfoPanelProps {
	asset: TimelineAsset;
}

/** Details of the asset on screen, beside it (display only: Up or Back closes it). */
export const InfoPanel: React.FC<InfoPanelProps> = React.memo(({asset}) => {
	const {data: details, isLoading} = useAssetDetails(asset.id, true);
	const rows = useMemo(() => detailRows(asset, details), [asset, details]);
	return (
		<aside className={css.panel} aria-live="polite">
			<div className={css.heading}>
				{t('info.title')}
				{asset.isFavorite && <span className={css.favorite}>♥</span>}
			</div>
			{rows.map((row) => (
				<div key={row.label} className={css.row}>
					<div className={css.label}>{t(row.label)}</div>
					<div className={css.value}>
						{row.lines.map((line, index) => (
							<div key={index} className={index ? css.secondary : undefined}>
								{line}
							</div>
						))}
					</div>
				</div>
			))}
			{isLoading && <div className={css.loading}>{t('info.loading')}</div>}
			<div className={css.hint}>{`▲ ${t('viewer.close')}`}</div>
		</aside>
	);
});

InfoPanel.displayName = 'InfoPanel';
