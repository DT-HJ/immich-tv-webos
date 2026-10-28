export type View = 'photos' | 'memories' | 'albums' | 'places' | 'search' | 'filter';

/** Shared props for every route-level panel mounted by AppLayout. */
export interface RoutePanelProps {
	contentWidth: number;
}
