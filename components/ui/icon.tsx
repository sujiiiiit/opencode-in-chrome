import {
  AiBrain01Icon,
  AiSearchLinesIcon,
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp02Icon,
  Attachment01Icon,
  BrowserIcon,
  Cancel01Icon,
  ComputerTerminal01Icon,
  CopyIcon,
  Delete02Icon,
  File01Icon,
  FileEditIcon,
  FileSearchIcon,
  Forward02Icon,
  Globe02Icon,
  HandIcon,
  HistoryIcon,
  Image01Icon,
  Image02Icon,
  ImageNotFound01Icon,
  SourceCodeIcon,
  LinkSquare02Icon,
  Loading03Icon,
  LoaderCircleIcon,
  MessageCirclePlusIcon,
  MoreHorizontalIcon,
  Pen01Icon,
  Pdf02Icon,
  AudioWaveformIcon,
  FilePlayIcon,
  ToolCaseIcon,
  PlusSignIcon,
  Search01Icon,
  Settings01Icon,
  SlidersHorizontalIcon,
  StarIcon,
  StopIcon,
  Tick02Icon,
  UserMultipleIcon,
  Wrench01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type HugeiconsIconProps } from '@hugeicons/react';

/**
 * Every icon the app uses, by name. Import icons here (only listed icons are bundled), then
 * render them anywhere with a single import: `<Icon name="arrow-up" />`.
 */
const icons = {
  'ai-search-lines': AiSearchLinesIcon,
  'arrow-left': ArrowLeft01Icon,
  'arrow-right': ArrowRight01Icon,
  'arrow-up': ArrowUp02Icon,
  agent: UserMultipleIcon,
  alert: Alert02Icon,
  attach: Attachment01Icon,
  browser: BrowserIcon,
  check: Tick02Icon,
  'chevron-down': ArrowDown01Icon,
  close: Cancel01Icon,
  copy: CopyIcon,
  delete: Delete02Icon,
  edit: Pen01Icon,
  file: File01Icon,
  'file-edit': FileEditIcon,
  'file-search': FileSearchIcon,
  forward: Forward02Icon,
  hand: HandIcon,
  'file-play': FilePlayIcon,
  'pdf': Pdf02Icon,
  'audio': AudioWaveformIcon,
  'video': FilePlayIcon,
  'tools': ToolCaseIcon,
  globe: Globe02Icon,
  history: HistoryIcon,
  code: SourceCodeIcon,
  image: Image01Icon,
  'image-off': ImageNotFound01Icon,
  'open-external': LinkSquare02Icon,
  terminal: ComputerTerminal01Icon,
  thinking: AiBrain01Icon,
  tool: Wrench01Icon,
  loader: Loading03Icon,
  'loader-circle': LoaderCircleIcon,
  more: MoreHorizontalIcon,
  'new-chat': MessageCirclePlusIcon,
  plus: PlusSignIcon,
  search: Search01Icon,
  settings: Settings01Icon,
  sliders: SlidersHorizontalIcon,
  star: StarIcon,
  stop: StopIcon,
} as const;

export type IconName = keyof typeof icons;

type IconProps = Omit<HugeiconsIconProps, 'icon' | 'altIcon'> & {
  name: IconName;
  /** Icon shown instead of `name` while `showAlt` is true (e.g. a toggled state). */
  altName?: IconName;
};

/**
 * Hugeicons wrapper: one component instead of `HugeiconsIcon` + an icon import. Decorative by
 * default (`aria-hidden`); pass `aria-hidden={false}` and an `aria-label` when the icon alone
 * carries meaning. Size is 16px unless a `size-*` class or `size` prop says otherwise.
 */
export function Icon({ name, altName, size = 16, ...props }: IconProps) {
  return (
    <HugeiconsIcon
      icon={icons[name]}
      altIcon={altName ? icons[altName] : undefined}
      size={size}
      aria-hidden
      {...props}
    />
  );
}

/** Solid check mark (openscreen `Tick2Icon`), used by the dropdown menu indicators. */
export function Tick2Icon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 50 50"
      aria-hidden
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        d="M 41.9375 8.625 C 41.273438 8.648438 40.664063 9 40.3125 9.5625 L 21.5 38.34375 L 9.3125 27.8125 C 8.789063 27.269531 8.003906 27.066406 7.28125 27.292969 C 6.5625 27.515625 6.027344 28.125 5.902344 28.867188 C 5.777344 29.613281 6.078125 30.363281 6.6875 30.8125 L 20.625 42.875 C 21.0625 43.246094 21.640625 43.410156 22.207031 43.328125 C 22.777344 43.242188 23.28125 42.917969 23.59375 42.4375 L 43.6875 11.75 C 44.117188 11.121094 44.152344 10.308594 43.78125 9.644531 C 43.410156 8.984375 42.695313 8.589844 41.9375 8.625 Z"
      />
    </svg>
  );
}
