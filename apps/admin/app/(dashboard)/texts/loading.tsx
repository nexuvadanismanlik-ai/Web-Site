import { EditorSkeleton } from '../../../components/skeletons';

/**
 * Shown the instant a navigation starts, so a click always produces movement.
 * See components/skeletons for why this file exists at all.
 */
export default function Loading() {
  return <EditorSkeleton panels={4} fields={5} />;
}
