import { Suspense } from "react";
import { notFound } from "next/navigation";
import Explorer from "@/components/Explorer";
import SiteHeader from "@/components/SiteHeader";
import type { Metadata } from "next";
import { isLibrary, libraryParams, LIBRARIES } from "@/data/libraries";
import { libraryView } from "@/data/library-view";

export const generateStaticParams = libraryParams;

export async function generateMetadata({ params }: PageProps<"/[library]">): Promise<Metadata> {
  const { library } = await params;
  if (!isLibrary(library)) return {};
  const { name, full } = LIBRARIES[library];
  return {
    title: `StudyScape — find a place to study in ${name} Library`,
    description: `An independent NC State study-space explorer: every room and reading space in ${full}, with live headcounts.`,
  };
}

// both libraries are prerendered, so awaiting params here doesn't actually block navigation
export const instant = false;

export default async function LibraryPage({ params }: PageProps<"/[library]">) {
  const { library } = await params;
  if (!isLibrary(library)) notFound();
  return (
    <>
      <SiteHeader library={library} current="find" />
      <Suspense fallback={<main className="flex-1" />}>
        <Explorer lib={libraryView(library)} />
      </Suspense>
    </>
  );
}
