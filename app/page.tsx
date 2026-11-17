import { Suspense } from "react";
import Explorer from "@/components/Explorer";
import SiteHeader from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader current="/" />
      <Suspense fallback={<main className="flex-1" />}>
        <Explorer />
      </Suspense>
    </>
  );
}
