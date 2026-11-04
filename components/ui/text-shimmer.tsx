'use client';
import React, { useMemo, type JSX } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';

export type TextShimmerProps = {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
};

/** `motion.create` makes a new component type, so one per tag is kept, not one per render (which would remount and restart the sweep). */
type MotionTag = React.ComponentType<HTMLMotionProps<'span'>>;
const motionTags = new Map<React.ElementType, MotionTag>();

function motionTag(tag: React.ElementType) {
  let created = motionTags.get(tag);
  if (!created) {
    created = motion.create(tag as keyof JSX.IntrinsicElements) as unknown as MotionTag;
    motionTags.set(tag, created);
  }
  return created;
}

/**
 * Two layers clipped to the text: a solid base colour, and over it a band that is transparent
 * at both sides and the shine colour at its centre, swept right to left across a 250% box.
 * Colours are the --shimmer-text-* tokens in global.css.
 */
function TextShimmerComponent({ children, as: Component = 'p', className, duration = 2, spread = 2 }: TextShimmerProps) {
  const MotionComponent = motionTag(Component);
  const reduced = useReducedMotion();

  const dynamicSpread = useMemo(() => {
    return children.length * spread;
  }, [children, spread]);

  // Reduced motion keeps the plain colour: no band, no sweep.
  if (reduced) {
    return (
      <Component data-slot="text-shimmer" className={cn('text-(--shimmer-text-highlight-color)', className)}>
        {children}
      </Component>
    );
  }

  return (
    <MotionComponent
      data-slot="text-shimmer"
      className={cn(
        'relative inline-block bg-[length:250%_100%,auto] bg-clip-text',
        'text-transparent [--base-color:var(--shimmer-text-highlight-color)] [--base-gradient-color:var(--shimmer-text-faded-color)]',
        '[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))]',
        className,
      )}
      initial={{ backgroundPosition: '100% center' }}
      animate={{ backgroundPosition: '0% center' }}
      transition={{
        repeat: Infinity,
        duration,
        ease: 'linear',
      }}
      style={
        {
          '--spread': `${dynamicSpread}px`,
          backgroundImage: `var(--bg), linear-gradient(var(--base-color), var(--base-color))`,
        } as React.CSSProperties
      }
    >
      {children}
    </MotionComponent>
  );
}

export const TextShimmer = React.memo(TextShimmerComponent);
