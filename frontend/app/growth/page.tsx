import type { Metadata } from "next";

import { GrowthClient } from "./GrowthClient";

export const metadata: Metadata = {
  title: "Growth — Deep",
  description: "See your streak tree grow and share it with friends.",
};

export default function GrowthPage() {
  return <GrowthClient />;
}
