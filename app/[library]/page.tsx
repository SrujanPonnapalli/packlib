import { Suspense } from "react";
import { notFound } from "next/navigation";
import Explorer from "@/components/Explorer";
import SiteHeader from "@/components/SiteHeader";
import { isLibrary, libraryParams } from "@/data/libraries";

export const generateStaticParams = libraryParams;

export default async function LibraryPage({ params }: PageProps<"/[library]">) {
  const { library } = await params;
  if (!isLibrary(library)) notFound();
  return (
    <>
      <SiteHeader library={library} current="find" />
      <Suspense fallback={<main className="flex-1" />}>
        <Explorer />
      </Suspense>
    </>
  );
}
