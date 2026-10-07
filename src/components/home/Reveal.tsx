import { useEffect, useRef, useState, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

type Props = HTMLAttributes<HTMLElement> & { as?: ElementType; children: ReactNode };

/**
 * Fades its content in once, the first time it scrolls into view (see .reveal in index.css).
 * One-shot rather than scroll-linked, so content is never left half-transparent.
 */
export function Reveal({ as: Tag = 'section', className = '', children, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`reveal ${shown ? 'is-shown' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
