import {useRepositoryQuery} from './queryConfig';

/** The viewer's details panel data, fetched only while the panel is open. */
export const useAssetDetails = (assetId: string | undefined, enabled: boolean) =>
	useRepositoryQuery(['asset-details', assetId], (r) => r.getAssetDetails(assetId!), {enabled: enabled && !!assetId, staleTime: 10 * 60 * 1000});
