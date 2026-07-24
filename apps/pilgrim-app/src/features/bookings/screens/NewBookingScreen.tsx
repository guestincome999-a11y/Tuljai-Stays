import { PilgrimCheckoutScreen } from '../../../pilgrim-ui/screens/PilgrimCheckoutScreen';

/**
 * Backward-compatible export for callers that still use the legacy feature path.
 * The route and this export intentionally share one checkout implementation so
 * booking validation and required ID-proof handling cannot drift apart again.
 */
export function NewBookingScreen() {
  return <PilgrimCheckoutScreen />;
}
