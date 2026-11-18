"use client";

import { createContext, use } from "react";
import type { LibraryView } from "@/data/libraries";

// the library the page is for, set once in Explorer so a bunch of components don't have to pass it down
const LibraryContext = createContext<LibraryView | null>(null);

export const LibraryProvider = LibraryContext;

export function useLibrary(): LibraryView {
  const lib = use(LibraryContext);
  if (!lib) throw new Error("useLibrary outside LibraryProvider");
  return lib;
}
