// src/contexts/HighlightContext.tsx
'use client';

import { createContext, useContext } from 'react';

export const HighlightContext = createContext<{
  highlightedPostId: string | null;
  setHighlightedPostId: (id: string | null) => void;
}>({
  highlightedPostId: null,
  setHighlightedPostId: () => {},
});

export const useHighlight = () => useContext(HighlightContext);