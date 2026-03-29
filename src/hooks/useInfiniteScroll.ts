import { useState, useEffect, useRef, useCallback } from 'react';

export function useInfiniteScroll<T>(items: T[], itemsPerPage: number = 20) {
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);
  const observerTarget = useRef<HTMLDivElement | null>(null);

  // Reset visible count when items change significantly (e.g. filtering)
  useEffect(() => {
    setVisibleCount(itemsPerPage);
  }, [items, itemsPerPage]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && visibleCount < items.length) {
        setVisibleCount((prev) => Math.min(prev + itemsPerPage, items.length));
      }
    },
    [visibleCount, items.length, itemsPerPage]
  );

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '200px',
      threshold: 0.1,
    });

    observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return { visibleItems, hasMore, observerTarget };
}
