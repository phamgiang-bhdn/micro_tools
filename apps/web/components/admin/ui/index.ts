// ===== Data fetching =====
export { adminGet } from "./admin-fetch";

// ===== Layout =====
export { PageHeader } from "./page-header";
export { SectionCard } from "./card";
export { ListPageShell } from "./list-page-shell";
export { OverviewStats, type OverviewStat } from "./overview-stats";
export { AdminEmptyState } from "./empty-state";

// ===== Status / badge =====
export { StatusPill, NetworkBadge, type Tone } from "./status-pill";

// ===== Table =====
export { DataTable, type ColumnDef } from "./data-table";
export { Pagination, paginateRows } from "./pagination";

// ===== Form fields (legacy uncontrolled) =====
export {
  Field,
  TextField,
  SelectField,
  TextareaField,
  adminInputClass,
  adminInputMonoClass,
  adminInputCompactClass
} from "./form-field";

// ===== Form fields (RHF + zod) =====
export {
  ControlledTextField,
  ControlledTextareaField,
  ControlledNumberField,
  ControlledSelectField,
  ControlledDateField,
  ControlledCheckboxField
} from "./controlled-fields";
export { useAdminForm, type AdminFormResult } from "./use-admin-form";
export { FormDialog } from "./form-dialog";

// ===== Buttons =====
export {
  AdminButton,
  AdminLinkButton,
  type AdminButtonVariant,
  type AdminButtonSize,
  type AdminButtonProps,
  ADMIN_BUTTON_STYLES
} from "./admin-button";
export { ConfirmButton, SubmitButton } from "./confirm-button";
export { IconButton } from "./icon-button";
export { RowActions, type RowActionItem } from "./row-actions";

// ===== Filter =====
export {
  FilterBar,
  FilterPills,
  NativeFilterSelect,
  NativeFilterInput
} from "./filter-bar";

// ===== Radix primitives =====
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogContent,
  DialogFooter
} from "./dialog";
export { Tooltip, TooltipProvider } from "./tooltip";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuPortal,
  DropdownMenuSub
} from "./dropdown-menu";
export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator
} from "./select";
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose } from "./popover";
export { DatePicker } from "./date-picker";
export { ConfirmProvider, useConfirm } from "./confirm-dialog";
