import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  deps?: ReadonlyArray<unknown>;
  step?: number;
}

export function useHorizontalBoardNav({ deps = [], step = 320 }: Options = {}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScrollState = useCallback(() => {
    const node = viewportRef.current;
    if (!node) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    const nextLeft = node.scrollLeft > 8;
    const nextRight = node.scrollLeft < maxScrollLeft - 8;

    setCanScrollLeft(nextLeft);
    setCanScrollRight(nextRight);
  }, []);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    syncScrollState();

    const handleScroll = () => syncScrollState();
    node.addEventListener('scroll', handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => syncScrollState());
    resizeObserver.observe(node);

    return () => {
      node.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [syncScrollState, ...deps]);

  const scrollByDirection = useCallback((direction: -1 | 1) => {
    const node = viewportRef.current;
    if (!node) return;

    node.scrollBy({
      left: direction * step,
      behavior: 'smooth',
    });
  }, [step]);

  const handleViewportKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollByDirection(-1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollByDirection(1);
    }
  }, [scrollByDirection]);

  return {
    viewportRef,
    canScrollLeft,
    canScrollRight,
    scrollLeft: () => scrollByDirection(-1),
    scrollRight: () => scrollByDirection(1),
    handleViewportKeyDown,
  };
}
