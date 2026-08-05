/**
 * The Nexuva design system.
 *
 * Applications import from `@nexuva/ui` and nothing else — never a file path
 * inside this package. That is what lets a component move between folders
 * without touching a single consumer.
 *
 * Components carry their own styles (src/styles/components.css, imported by
 * each app's globals.css) and take colour from the semantic tokens the app
 * defines, so the same component renders correctly in the marketing site's
 * theme and the panel's.
 *
 * Layout of src/components:
 *   feedback/    Toast, EmptyState, Skeleton, ConfirmDialog
 *   forms/       SelectField, NumberField, DateField, SwitchField, SearchBar
 *   layout/      (Panel arrives with the editor rebuild)
 *   navigation/  (Breadcrumb, Tabs — Faz 2.6)
 *   tables/      (DataTable, Pagination, FilterBar — Faz 4, with the CRM)
 *   charts/      (Faz 5, with analytics)
 *   icons/
 *
 * A folder is created when its first real component arrives, not before: a
 * component with no consumer is a guess, and guesses are what the modules then
 * have to work around.
 */

export {
  ToastProvider,
  useToast,
  EmptyState,
  Skeleton,
  SkeletonRows,
  ConfirmDialog,
} from './components/feedback';

export {
  SelectField,
  NumberField,
  DateField,
  SwitchField,
  SearchBar,
} from './components/forms';

export { ImageField, type PickableImage } from './components/forms/image-field';

export { cn } from './lib/cn';
