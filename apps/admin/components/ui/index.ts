/**
 * The admin panel's shared component kit.
 *
 * Every screen builds from here. A screen that needs something this does not
 * have adds it here first — the rule is not that all eighteen components in the
 * specification exist today, it is that no screen invents its own. Twelve
 * editors had already hand-rolled fourteen separate list implementations before
 * this existed.
 *
 * Still to arrive, each with its first real consumer rather than speculatively:
 *   DataTable, Pagination, FilterBar  — the CRM's request list
 *   ImageField                        — the media library
 *   RichTextField                     — the blog editor
 *   PermissionGate                    — the user roles screen
 *   Drawer, Modal                     — the CRM's request detail
 */

export {
  ToastProvider,
  useToast,
  EmptyState,
  Skeleton,
  SkeletonRows,
  ConfirmDialog,
} from './feedback';

export { SelectField, NumberField, DateField, SwitchField, SearchBar } from './form';

// Existing primitives, re-exported so screens have one import path for the kit
// rather than two. fields.tsx keeps the editor-specific pieces until the
// editors themselves are rebuilt.
export {
  TextField,
  TextAreaField,
  LocalizedField,
  ColorField,
  Panel,
  MetaFields,
  IconButton,
  AddButton,
  EditorHeader,
  useSaver,
  type SaveResult,
} from '../fields';
