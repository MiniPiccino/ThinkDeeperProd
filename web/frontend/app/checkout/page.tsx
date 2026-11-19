import { Suspense } from "react";

import { CheckoutClient } from "./CheckoutClient";
import { CheckoutShell } from "./CheckoutShell";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutShell message="Preparing secure checkout…" />}>
      <CheckoutClient />
    </Suspense>
  );
}
