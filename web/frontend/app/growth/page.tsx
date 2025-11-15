import { Suspense } from "react";
import type { Metadata } from "next";

import { GrowthClient } from "./GrowthClient";

export const metadata: Metadata = {
  title: "Growth — Deep",
  description: "Replay your yearly streak timeline and share it with friends.",
};

export default function GrowthPage() {
  return (
    <Suspense fallback={null}>
      <GrowthClient />
    </Suspense>
  );
}
