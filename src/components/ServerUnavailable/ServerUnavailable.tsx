import React, {useCallback, useEffect, useRef} from 'react';
import Button from '@enact/sandstone/Button';
import Icon from '@enact/sandstone/Icon';
import Spotlight from '@enact/spotlight';
import {spotlightDefaultClass} from '@enact/spotlight/SpotlightContainerDecorator';
import {t} from '../../i18n/i18n';
import {createSpotlightContainer} from '../../utils/spotlight';
import css from './ServerUnavailable.module.less';

interface ServerUnavailableProps {
	serverUrl: string;
	retrying: boolean;
	onRetry: () => void;
	onOpenAccounts: () => void;
}

const Container = createSpotlightContainer({enterTo: 'default-element'});
const RETRY_SPOTLIGHT_ID = 'server-unavailable-retry';
// The server is off for a while when it is (another service has the machine): retry quietly.
const RETRY_EVERY_MS = 15000;

/** The active account's server didn't answer: say so, and reconnect as soon as it does. */
export const ServerUnavailable: React.FC<ServerUnavailableProps> = ({serverUrl, retrying, onRetry, onOpenAccounts}) => {
	const retryingRef = useRef(retrying);
	useEffect(() => {
		retryingRef.current = retrying;
	}, [retrying]);

	const retryNow = useCallback(() => {
		if (!retryingRef.current) onRetry();
	}, [onRetry]);

	useEffect(() => {
		const timer = window.setInterval(retryNow, RETRY_EVERY_MS);
		return () => window.clearInterval(timer);
	}, [retryNow]);

	useEffect(() => {
		Spotlight.setPointerMode(false);
		Spotlight.focus(RETRY_SPOTLIGHT_ID);
	}, []);

	return (
		<Container className={css.screen}>
			<Icon className={css.icon}>exclamation</Icon>
			<div className={css.title}>{t('offline.title')}</div>
			<div className={css.body}>{t('offline.body')}</div>
			<div className={css.url}>{serverUrl}</div>
			<div className={css.actions}>
				<Button spotlightId={RETRY_SPOTLIGHT_ID} className={spotlightDefaultClass} onClick={retryNow}>
					{retrying ? t('offline.retrying') : t('offline.retry')}
				</Button>
				<Button onClick={onOpenAccounts}>{t('offline.accounts')}</Button>
			</div>
		</Container>
	);
};
