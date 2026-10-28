import React, {useCallback} from 'react';
import Button from '@enact/sandstone/Button';
import Spinner from '@enact/sandstone/Spinner';
import {useQueryClient} from '@tanstack/react-query';
import {t} from '../i18n/i18n';
import {presentError} from '../utils/presentError';
import css from './QueryStateView.module.less';

interface QueryStateViewProps {
	isLoading: boolean;
	error: unknown;
	isEmpty?: boolean;
	loadingText?: string;
	errorText?: string;
	emptyText?: string;
	className?: string;
	children: React.ReactNode;
}

// Sandstone types Spinner with ui/Spinner's required `component`, which it supplies itself at
// runtime: same `as any` pattern as VideoPlayer.
const SPINNER_PROPS = {size: 'small', transparent: true} as any;

// Refetches whatever is on screen: a server that was off (or restarting) needs no app restart.
const RetryButton: React.FC = () => {
	const queryClient = useQueryClient();
	const handleRetry = useCallback(() => void queryClient.resetQueries({type: 'active'}), [queryClient]);
	return (
		<Button size="small" className={css.retry} onClick={handleRetry}>
			{t('state.retry')}
		</Button>
	);
};

export const QueryStateView: React.FC<QueryStateViewProps> = ({
	isLoading,
	error,
	isEmpty = false,
	loadingText = t('state.loading'),
	errorText,
	emptyText = t('state.empty'),
	className,
	children,
}) => {
	const stateClass = className ? `${css.state} ${className}` : css.state;
	if (isLoading) {
		return (
			<div className={stateClass}>
				<Spinner {...SPINNER_PROPS}>{loadingText}</Spinner>
			</div>
		);
	}
	if (error) {
		return (
			<div className={`${stateClass} ${css.column}`}>
				<div>{errorText ?? presentError(error)}</div>
				<RetryButton />
			</div>
		);
	}
	if (isEmpty) return <div className={stateClass}>{emptyText}</div>;
	return <>{children}</>;
};

QueryStateView.displayName = 'QueryStateView';
