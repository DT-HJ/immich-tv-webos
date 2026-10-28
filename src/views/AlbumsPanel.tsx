import React, {useCallback, useState} from 'react';
import {AlbumCard, albumCardSpotlightId} from '../components/AlbumCard';
import {CollectionGrid} from '../components/CollectionGrid/CollectionGrid';
import {QueryStateView} from '../components/QueryStateView';
import AlbumView from './AlbumView';
import {useAlbums} from '../hooks/useAlbums';
import {useFocusOnReturn} from '../hooks/useFocusOnReturn';
import type {RoutePanelProps} from '../types/navigation';
import {formatCount} from '../utils/FormattingService';
import {t} from '../i18n/i18n';

const AlbumsPanel: React.FC<RoutePanelProps> = ({contentWidth}) => {
	const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
	const {data: albums, isLoading, error} = useAlbums();

	const handleSelectAlbum = useCallback((albumId: string) => {
		setSelectedAlbumId(albumId);
	}, []);

	const handleBack = useCallback(() => setSelectedAlbumId(null), []);
	useFocusOnReturn(selectedAlbumId, albumCardSpotlightId);

	if (selectedAlbumId) {
		return <AlbumView albumId={selectedAlbumId} onBack={handleBack} contentWidth={contentWidth} />;
	}

	return (
		<QueryStateView
			isLoading={isLoading}
			error={error}
			isEmpty={!albums?.length}
			loadingText={t('albums.loading')}
			emptyText={t('albums.empty')}
		>
			<CollectionGrid title={t('albums.title')} subtitle={albums ? formatCount(albums.length, 'album') : undefined}>
				{albums?.map((album) => (
					<AlbumCard key={album.id} album={album} onSelect={handleSelectAlbum} />
				))}
			</CollectionGrid>
		</QueryStateView>
	);
};

export default AlbumsPanel;
