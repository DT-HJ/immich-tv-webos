import React, {useCallback, useState} from 'react';
import {PlaceCard, placeCardSpotlightId} from '../components/PlaceCard';
import {CollectionGrid} from '../components/CollectionGrid/CollectionGrid';
import {QueryStateView} from '../components/QueryStateView';
import PlaceView from './PlaceView';
import {usePlaces} from '../hooks/usePlaces';
import {useFocusOnReturn} from '../hooks/useFocusOnReturn';
import type {RoutePanelProps} from '../types/navigation';
import {formatCount} from '../utils/FormattingService';
import {t} from '../i18n/i18n';

const PlacesPanel: React.FC<RoutePanelProps> = ({contentWidth}) => {
	const [selectedCity, setSelectedCity] = useState<string | null>(null);
	const {data: places, isLoading, error} = usePlaces();

	const handleSelectPlace = useCallback((city: string) => {
		setSelectedCity(city);
	}, []);

	const handleBack = useCallback(() => setSelectedCity(null), []);
	useFocusOnReturn(selectedCity, placeCardSpotlightId);

	if (selectedCity) {
		return <PlaceView city={selectedCity} onBack={handleBack} contentWidth={contentWidth} />;
	}

	return (
		<QueryStateView
			isLoading={isLoading}
			error={error}
			isEmpty={!places?.length}
			loadingText={t('places.loading')}
			emptyText={t('places.empty')}
		>
			<CollectionGrid title={t('places.title')} subtitle={places ? formatCount(places.length, 'place') : undefined}>
				{places?.map((place) => (
					<PlaceCard key={place.city} place={place} onSelect={handleSelectPlace} />
				))}
			</CollectionGrid>
		</QueryStateView>
	);
};

export default PlacesPanel;
