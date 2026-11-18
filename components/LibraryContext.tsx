"use client";

import { createContext, use } from "react";
import type { LibraryView } from "@/data/libraries";

// The library a page is about, set once by Explorer so a dozen components don't pass it along.
const LibraryContext = createContext<LibraryView | null>(null);

export const LibraryProvider = LibraryContext;

export function useLibrary(): LibraryView {
  const lib = use(LibraryContext);
  if (!lib) throw new Error("useLibrary outside LibraryProvider");
  return lib;
}
