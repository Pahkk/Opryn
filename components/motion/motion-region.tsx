"use client";
import {
  Children,
  forwardRef,
  isValidElement,
  useLayoutEffect,
  useRef,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useAnimate,
  useIsPresent,
} from "motion/react";
import { motionTokens, uiTransition } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
const immediate =
  '[role="alert"], [aria-invalid="true"], [data-motion-immediate]';

/** Preserves children, forms and route timing. Never retains a previous private route. */
export function MotionRegion({
  children,
  changeKey,
  variant = "page",
  className = "",
}: {
  children: ReactNode;
  changeKey?: string | number;
  variant?: "page" | "step" | "status" | "quiet";
  className?: string;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const [, animate] = useAnimate<HTMLDivElement>();
  const reduced = useProductReducedMotion();
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    let disposed = false;
    const reset = () => {
      root.style.opacity = "1";
      root.style.transform = "none";
    };
    if (
      reduced ||
      root.closest("[data-motion-immediate]") ||
      root.querySelector(immediate)
    ) {
      reset();
      return;
    }
    const playback = animate(
      root,
      {
        opacity: [0, 1],
        x: variant === "step" ? [10, 0] : 0,
        y: variant === "page" ? [8, 0] : variant === "status" ? [4, 0] : 0,
      },
      uiTransition(
        false,
        variant === "quiet" || variant === "status"
          ? motionTokens.duration.micro
          : motionTokens.duration.standard,
      ),
    );
    const observer = new MutationObserver(() => {
      if (root.querySelector(immediate)) {
        playback.stop();
        reset();
      }
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "aria-invalid"],
    });
    void playback.then(() => {
      if (disposed) return;
      reset();
      observer.disconnect();
    });
    return () => {
      disposed = true;
      playback.stop();
      observer.disconnect();
      reset();
    };
  }, [animate, scope, changeKey, variant, reduced]);
  return (
    <div
      ref={scope}
      className={className}
      data-motion-owner="motion"
      data-motion-region={variant}
    >
      {children}
    </div>
  );
}

const rowTags: Record<string, ElementType> = {
  div: motion.div,
  button: motion.button,
  article: motion.article,
  section: motion.section,
  li: motion.li,
  a: motion.a,
  label: motion.label,
};
const ListItem = forwardRef<
  HTMLElement,
  {
    child: ReactElement<Record<string, unknown>>;
    index: number;
    reduced: boolean;
    large: boolean;
  }
>(function ListItem({ child, index, reduced, large }, ref) {
  const present = useIsPresent();
  const Tag = rowTags[String(child.type)];
  if (!Tag) return child;
  return (
    <Tag
      {...child.props}
      ref={ref}
      data-motion-owner="motion"
      inert={!present ? true : undefined}
      aria-hidden={!present ? true : child.props["aria-hidden"]}
      layout={reduced || large ? false : "position"}
      initial={
        reduced || large ? false : { opacity: 0, y: motionTokens.distance.row }
      }
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: reduced ? 0 : -4,
        transition: uiTransition(reduced, motionTokens.duration.micro),
      }}
      transition={{
        ...uiTransition(reduced, motionTokens.duration.fast),
        delay: Math.min(index * motionTokens.stagger, 0.12),
        layout: reduced ? { duration: 0 } : motionTokens.layout,
      }}
    />
  );
});

/** Keyed results, bounded entry and layout work. Original tags preserve CSS and semantics. */
export function StaggerList({
  children,
  changeKey,
  className = "",
}: {
  children: ReactNode;
  changeKey: string;
  className?: string;
}) {
  const reduced = useProductReducedMotion();
  const rows = Children.toArray(children);
  return (
    <div
      className={className}
      data-motion-list
      data-motion-owner="motion"
      data-results-key={changeKey}
      style={{ position: "relative" }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((child, index) =>
          isValidElement<Record<string, unknown>>(child) &&
          rowTags[String(child.type)] ? (
            <ListItem
              key={child.key ?? index}
              child={child}
              index={index}
              reduced={reduced}
              large={rows.length > 40}
            />
          ) : (
            child
          ),
        )}
      </AnimatePresence>
    </div>
  );
}
