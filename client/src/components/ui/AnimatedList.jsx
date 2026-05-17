import { motion } from 'framer-motion';
import { listContainer, listItem } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * AnimatedList — orchestrated staggered children.
 *
 * Replaces the pattern of per-item `transition={{ delay: i * 0.06 }}`
 * across the app. The container variant controls the stagger so
 * children don't need to know their index.
 *
 * Stagger caps at ~12 items so long lists don't animate for seconds.
 *
 * Usage:
 *   <AnimatedList style={{ display: 'grid', gap: '1rem' }}>
 *     {items.map(i => (
 *       <AnimatedItem key={i.id}>
 *         <Card data={i} />
 *       </AnimatedItem>
 *     ))}
 *   </AnimatedList>
 * ═════════════════════════════════════════════════════════════════
 */
export function AnimatedList({
  children,
  className,
  style,
  ...rest
}) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={listContainer}
      initial="hidden"
      animate="visible"
      exit="exit"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedItem({
  children,
  className,
  style,
  ...rest
}) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={listItem}
      {...rest}
    >
      {children}
    </motion.div>
  );
}