'use client';

import {
  Children,
  useEffect,
  useState,
  useCallback,
  createContext,
  useContext,
  isValidElement,
  cloneElement,
  type CSSProperties,
  type ReactNode
} from 'react';
import { Button } from './button';
import { cn } from 'cn';

interface TabsProps {
  defaultValue: string;
  children: ReactNode;
  className?: string;
  /** Controlled mode: external value state */
  value?: string;
  /** Controlled mode: value change handler */
  onValueChange?: (value: string) => void;
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  /**
   * Indicator style for the active tab
   * - "pill": Rounded background indicator (default)
   * - "underline": Bottom border indicator
   * - "none": No visual indicator beyond color change
   */
  indicator?: 'pill' | 'underline' | 'none';
  /** Button variant to use (forwarded to Button component) */
  variant?:
    | 'default'
    | 'secondary'
    | 'tertiary'
    | 'outline'
    | 'ghost'
    | 'destructive';
  /** Button size to use (forwarded to Button component) */
  size?:
    | 'default'
    | 'sm'
    | 'xs'
    | 'icon-xl'
    | 'icon-lg'
    | 'icon'
    | 'icon-sm'
    | 'icon-xs';
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
}

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

type TabsInjectedProps = {
  activeTab?: string;
  onChange?: (v: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

/**
 * Whether the nearest enclosing tab panel is the active (visible) one.
 *
 * Under the `lazy`/`all` mount strategies inactive panels stay mounted at
 * `opacity:0` + `absolute inset-0` (so they keep their state and cross-fade),
 * which means they remain geometrically inside the viewport — an
 * IntersectionObserver alone can't tell a descendant its tab is hidden.
 * Descendants that run continuous work (e.g. looping preview iframes) read
 * this to pause themselves while their tab is in the background.
 *
 * Defaults to `true` so components used outside a Tabs are unaffected.
 */
const TabPanelActiveContext = createContext<boolean>(true);

export function useTabPanelActive(): boolean {
  return useContext(TabPanelActiveContext);
}

/** For a container that shows one panel at a time without being a `Tabs`. */
export const TabPanelActiveProvider = TabPanelActiveContext.Provider;

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs must be used within a Tabs component.');
  }
  return context;
}

/**
 * Hook to access tab state from within a Tabs component.
 * Use this to create custom tab triggers.
 *
 * @example
 * ```tsx
 * function CustomTabTrigger({ value, children }) {
 *   const { activeTab, setActiveTab } = useTabs();
 *   return (
 *     <button
 *       onClick={() => setActiveTab(value)}
 *       className={activeTab === value ? 'active' : ''}
 *     >
 *       {children}
 *     </button>
 *   );
 * }
 * ```
 */
export const useTabs = useTabsContext;

/**
 * Tabs component - provides context for tab state management.
 * Supports both uncontrolled (defaultValue) and controlled (value + onValueChange) modes.
 *
 * @example Uncontrolled with native triggers
 * ```tsx
 * <Tabs defaultValue="tab1">
 *   <TabsList>
 *     <TabsTrigger value="tab1">Tab 1</TabsTrigger>
 *     <TabsTrigger value="tab2">Tab 2</TabsTrigger>
 *   </TabsList>
 *   <TabsContentWrapper>
 *     <TabsContent value="tab1">Content 1</TabsContent>
 *     <TabsContent value="tab2">Content 2</TabsContent>
 *   </TabsContentWrapper>
 * </Tabs>
 * ```
 *
 * @example Uncontrolled with custom triggers
 * ```tsx
 * <Tabs defaultValue="tab1">
 *   <CustomTriggers />
 *   <TabsContentWrapper>
 *     <TabsContent value="tab1">Content 1</TabsContent>
 *     <TabsContent value="tab2">Content 2</TabsContent>
 *   </TabsContentWrapper>
 * </Tabs>
 *
 * function CustomTriggers() {
 *   const { activeTab, setActiveTab } = useTabs();
 *   return (
 *     <div>
 *       <button onClick={() => setActiveTab("tab1")}>Custom Tab 1</button>
 *       <button onClick={() => setActiveTab("tab2")}>Custom Tab 2</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Controlled mode
 * ```tsx
 * const [tab, setTab] = useState("tab1");
 * <Tabs value={tab} onValueChange={setTab} defaultValue="tab1">
 *   <CustomTriggers />
 *   <TabsContentWrapper>
 *     <TabsContent value="tab1">Content 1</TabsContent>
 *     <TabsContent value="tab2">Content 2</TabsContent>
 *   </TabsContentWrapper>
 * </Tabs>
 * ```
 */
export function Tabs({
  defaultValue,
  children,
  className,
  value: controlledValue,
  onValueChange
}: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultValue);

  // Use controlled value if provided, otherwise use internal state
  const activeTab = controlledValue ?? internalActiveTab;

  const setActiveTab = useCallback(
    (value: string) => {
      if (onValueChange) {
        onValueChange(value);
      } else {
        setInternalActiveTab((prev) => (prev === value ? prev : value));
      }
    },
    [onValueChange]
  );

  function processChildren(child: ReactNode): ReactNode {
    if (!isValidElement(child)) {
      return child;
    }
    const childElement = child as React.ReactElement<TabsInjectedProps>;
    if (childElement.type === TabsList) {
      return cloneElement(childElement, {
        activeTab,
        onChange: setActiveTab
      });
    }
    if (childElement.type === TabsContentWrapper) {
      return cloneElement(childElement, { activeTab });
    }
    return child;
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('flex w-full min-w-0 flex-col gap-6', className)}>
        {Children.map(children, processChildren)}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className,
  activeTab,
  onChange
}: TabsListProps & { activeTab?: string; onChange?: (v: string) => void }) {
  const context = useContext(TabsContext);
  const resolvedActiveTab = activeTab ?? context?.activeTab;
  const resolvedOnChange = onChange ?? context?.setActiveTab;

  function processChild(child: ReactNode): ReactNode {
    if (!isValidElement(child)) return child;
    return cloneElement(child as React.ReactElement<TabsInjectedProps>, {
      activeTab: resolvedActiveTab,
      onChange: resolvedOnChange
    });
  }

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {Children.map(children, processChild)}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  indicator = 'pill',
  variant = 'ghost',
  size = 'default',
  className,
  activeTab,
  onChange,
  ...props
}: TabsTriggerProps &
  Omit<React.ComponentProps<typeof Button>, 'onClick' | 'children'> & {
    activeTab?: string;
    onChange?: (v: string) => void;
  }) {
  const context = useContext(TabsContext);
  const resolvedActiveTab = activeTab ?? context?.activeTab;
  const resolvedOnChange = onChange ?? context?.setActiveTab;
  const isActive = value === resolvedActiveTab;

  // Determine active state styling based on indicator type
  const getActiveStyles = () => {
    if (!isActive) return '';

    switch (indicator) {
      case 'pill':
        return cn(
          'bg-background-secondary-transparent text-text-primary',
          'hover:bg-[rgb(from_var(--color-background-secondary-transparent)_r_g_b_/_calc(alpha_*_(1_+_0.3_*_1)))]'
        );
      case 'underline':
        return cn(
          'text-text-primary',
          'after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-[2px] after:rounded-full after:bg-accent-acc-primary'
        );
      case 'none':
        return 'text-text-primary';
      default:
        return '';
    }
  };

  // Inactive state styling
  const getInactiveStyles = () => {
    if (isActive) return '';

    switch (indicator) {
      case 'pill':
        return cn(
          'text-text-tertiary',
          'hover:bg-background-secondary-transparent hover:text-text-secondary'
        );
      case 'underline':
        return cn(
          'text-text-tertiary',
          'hover:text-text-secondary',
          'after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-[2px] after:rounded-full after:bg-transparent hover:after:bg-border-primary-transparent'
        );
      case 'none':
        return cn('text-text-tertiary', 'hover:text-text-secondary');
      default:
        return '';
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => resolvedOnChange?.(value)}
      className={cn(
        // Base positioning and layout
        'relative',
        indicator === 'pill' && 'rounded-full',
        // Active/inactive state styles
        getActiveStyles(),
        getInactiveStyles(),
        className
      )}
      data-state={isActive ? 'active' : 'inactive'}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      {...props}
    >
      {children}
    </Button>
  );
}

export function TabsContentWrapper({
  children,
  className,
  activeTab,
  mountStrategy = 'all',
  fillHeight = false,
  style
}: {
  children: ReactNode;
  className?: string;
  activeTab?: string;
  mountStrategy?: 'all' | 'lazy' | 'active-only';
  /**
   * Stretch the ACTIVE panel to the wrapper's full height instead of letting it
   * be sized by its content.
   *
   * Inactive panels are already `absolute inset-0` (full-size), but the active
   * one is `relative` with NO height — it's sized by what's inside it. That's
   * right when the wrapper grows to fit the active tab (the default), and wrong
   * when the wrapper has a fixed height and the panel should fill it: content
   * sized with `h-full` (an iframe, a scroll box) resolves against a zero-height
   * parent and collapses. Turn this on for full-height panes.
   */
  fillHeight?: boolean;
  style?: CSSProperties;
}) {
  const context = useContext(TabsContext);
  const resolvedActiveTab = activeTab ?? context?.activeTab;
  const tabContents: { value: string; content: ReactNode }[] = [];
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(
    () => new Set(resolvedActiveTab ? [resolvedActiveTab] : [])
  );

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === TabsContent) {
      const childProps = child.props as TabsContentProps;
      tabContents.push({
        value: childProps.value,
        content: childProps.children
      });
    }
  });

  useEffect(() => {
    if (mountStrategy !== 'lazy' || !resolvedActiveTab) {
      return;
    }

    setMountedTabs((prev) => {
      if (prev.has(resolvedActiveTab)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(resolvedActiveTab);
      return next;
    });
  }, [mountStrategy, resolvedActiveTab]);

  const reducedMotion = usePrefersReducedMotion();

  function getSlideOffset(
    tabIndex: number,
    activeIndex: number,
    isActive: boolean
  ): number {
    if (isActive || activeIndex === -1 || reducedMotion) return 0;
    return tabIndex > activeIndex ? 32 : -32;
  }

  return (
    <div className={cn('relative w-full min-w-0', className)} style={style}>
      {tabContents.map(({ value, content }) => {
        const isActive = value === resolvedActiveTab;
        const tabIndex = tabContents.findIndex((tab) => tab.value === value);
        const activeIndex = resolvedActiveTab
          ? tabContents.findIndex((tab) => tab.value === resolvedActiveTab)
          : -1;
        const shouldRenderContent =
          mountStrategy === 'all' ||
          isActive ||
          (mountStrategy === 'lazy' && mountedTabs.has(value));

        if (mountStrategy === 'active-only' && !isActive) {
          return null;
        }

        return (
          <div
            key={value}
            // Inactive panels stay in the DOM (opacity 0) for the cross-fade,
            // but `inert` removes them from the tab order and a11y tree so
            // keyboard/screen-reader users can't land on hidden content.
            inert={!isActive}
            // Marks the one panel that contributes layout height, so a parent
            // can measure it to size/animate itself to the active tab.
            data-panel-active={isActive ? '' : undefined}
            className={panelClassName(isActive, fillHeight)}
            style={panelStyle(isActive, getSlideOffset(tabIndex, activeIndex, isActive))}
          >
            <TabPanelActiveContext.Provider value={isActive}>
              {shouldRenderContent ? content : null}
            </TabPanelActiveContext.Provider>
          </div>
        );
      })}
    </div>
  );
}

function panelClassName(isActive: boolean, fillHeight: boolean): string {
  return cn(
    'w-full min-w-0',
    isActive
      ? 'relative z-10'
      : // Top/left/right only, so an outgoing panel keeps its own
        // height instead of stretching to a container that is still
        // animating to the next panel's size — pinning `bottom` made
        // it deform in the frame before it faded. `fillHeight` panes
        // (h-full iframes, scroll boxes) still need all four edges.
        cn('absolute top-0 right-0 left-0', fillHeight ? 'bottom-0' : 'h-auto'),
    isActive && fillHeight && 'h-full'
  );
}

/**
 * The incoming panel glides in on the calm curve (fast start, soft settle) while the outgoing
 * one fades quickly, so the two never read as a muddle. Reduced motion passes no offset: fade only.
 */
function panelStyle(isActive: boolean, offset: number): CSSProperties {
  return {
    opacity: isActive ? 1 : 0,
    transform: `translateX(${offset}px)`,
    pointerEvents: isActive ? 'auto' : 'none',
    transition: isActive
      ? 'opacity 260ms var(--ease-calm), transform 260ms var(--ease-calm)'
      : 'opacity 140ms ease-out, transform 260ms var(--ease-calm)'
  };
}

/** True while the user asks for reduced motion (OS setting); follows changes live. */
function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true
  );
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function TabsContent(_props: TabsContentProps) {
  return null;
}
