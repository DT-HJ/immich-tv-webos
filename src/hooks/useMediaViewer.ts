import {useCallback, useState} from 'react';
import type {TimelineAsset} from '../domain/types';

interface ViewerState {
	assetId: string;
	assetIndex: number;
	// Opened by the previous video ending, not by the user.
	autoplayed?: boolean;
}

interface OpenAsset {
	id: string;
	autoplayed: boolean;
}

interface MediaViewerControls {
	state: ViewerState | null;
	// The asset may not be loaded yet: the viewer shows up once it lands in `assets`.
	open: (assetId: string, options?: {autoplayed?: boolean}) => void;
	close: () => void;
	navigate: (direction: 'prev' | 'next') => void;
}

export const useMediaViewer = (assets: TimelineAsset[]): MediaViewerControls => {
	const [current, setCurrent] = useState<OpenAsset | null>(null);
	const assetIndex = current ? assets.findIndex((asset) => asset.id === current.id) : -1;
	const state = current && assetIndex >= 0 ? {assetId: current.id, assetIndex, ...(current.autoplayed ? {autoplayed: true} : {})} : null;

	const open = useCallback((assetId: string, options?: {autoplayed?: boolean}) => setCurrent({id: assetId, autoplayed: !!options?.autoplayed}), []);
	const close = useCallback(() => setCurrent(null), []);

	const navigate = useCallback(
		(direction: 'prev' | 'next') => {
			setCurrent((shown) => {
				if (!shown) return null;
				const currentIndex = assets.findIndex((asset) => asset.id === shown.id);
				if (currentIndex < 0) return shown;
				const newIndex = direction === 'prev' ? Math.max(0, currentIndex - 1) : Math.min(assets.length - 1, currentIndex + 1);
				const id = assets[newIndex]?.id;
				return id ? {id, autoplayed: false} : shown;
			});
		},
		[assets]
	);

	return {state, open, close, navigate};
};
