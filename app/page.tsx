import { Suspense } from "react";
import Explorer from "@/components/Explorer";

export default function Home() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-rule px-5 sm:px-10">
        <p className="text-[17px] font-bold tracking-[-0.02em]">
          Study<span className="rounded-[3px] bg-accent px-0.5">Scape</span>
        </p>
        <span className="h-4 w-px bg-rule-strong" aria-hidden="true" />
        <p className="text-[13px] font-medium text-graphite">Hunt Library</p>
        <p className="ml-auto hidden text-[12px] text-pencil sm:block">
          An independent NC State study-space explorer
        </p>
      </header>
      <Suspense fallback={<main className="flex-1" />}>
        <Explorer />
      </Suspense>
    </>
  );
}
