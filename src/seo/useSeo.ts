import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocale } from '../hooks/useLocaleRoute';
import { applyHead, serverHead, type HeadData } from './head';

/** Sets the page title, description, canonical/hreflang links and JSON-LD for the current page. */
export function useSeo(meta: { title: string; description: string; noindex?: boolean; isRoot?: boolean }): void {
  const locale = useLocale();
  const { pathname } = useLocation();
  const path = meta.isRoot ? '' : pathname.replace(/^\/[^/]+/, '').replace(/\/$/, '');
  const head: HeadData = { ...meta, locale, path };

  if (import.meta.env.SSR) serverHead.current = head;

  const { title, description, noindex, isRoot } = meta;
  useEffect(() => {
    applyHead({ title, description, noindex, isRoot, locale, path });
  }, [title, description, noindex, isRoot, locale, path]);
}
