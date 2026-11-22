"use client";

import { initializePaddle, type PaddleEventData } from "@paddle/paddle-js";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { CheckoutShell } from "./CheckoutShell";
import { useAuth } from "@/app/providers";
import { confirmPaddleTransaction } from "@/lib/api";
import { assertStagingPublicConfiguration } from "@/lib/environment";

const TRANSACTION_PATTERN = /^txn_[a-z0-9]{26}$/;

export function CheckoutClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const openedRef = useRef(false);
  const [message, setMessage] = useState("Preparing secure checkout…");
  const transactionId = searchParams.get("_ptxn");
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const environment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
  const configurationError = useMemo(() => {
    if (authLoading) {
      return null;
    }
    if (!user) {
      return "Your session expired. Sign in again before starting checkout.";
    }
    try {
      assertStagingPublicConfiguration();
    } catch {
      return "Sandbox checkout configuration is invalid.";
    }
    if (!transactionId || !TRANSACTION_PATTERN.test(transactionId)) {
      return "This checkout link is invalid or incomplete.";
    }
    if (!token || environment !== "sandbox") {
      return "Paddle sandbox is not configured.";
    }
    return null;
  }, [authLoading, environment, token, transactionId, user]);

  useEffect(() => {
    if (authLoading || configurationError || openedRef.current) {
      return;
    }
    if (!transactionId || !token) return;

    openedRef.current = true;
    let active = true;
    const onEvent = async (event: PaddleEventData) => {
      if (!active || event.name !== "checkout.completed") {
        return;
      }
      const completedTransactionId = event.data?.transaction_id;
      if (completedTransactionId !== transactionId) {
        setMessage("Checkout completed with an unexpected transaction.");
        return;
      }
      setMessage("Payment accepted. Confirming premium access…");
      try {
        await confirmPaddleTransaction(transactionId);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["billing-status"] }),
          queryClient.invalidateQueries({ queryKey: ["reflections"] }),
        ]);
        router.replace("/growth?plan=premium");
      } catch {
        setMessage("Payment was accepted, but activation is still processing. Refresh Growth shortly.");
      }
    };

    void initializePaddle({
      environment: "sandbox",
      token,
      eventCallback: (event) => void onEvent(event),
    })
      .then((paddle) => {
        if (!active || !paddle) {
          throw new Error("Paddle unavailable");
        }
        setMessage("Complete the test checkout in the secure Paddle overlay.");
        paddle.Checkout.open({
          transactionId,
          settings: {
            displayMode: "overlay",
            theme: "dark",
            variant: "one-page",
          },
        });
      })
      .catch(() => {
        if (active) {
          openedRef.current = false;
          setMessage("Paddle sandbox checkout could not be opened.");
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, configurationError, queryClient, router, token, transactionId]);

  return <CheckoutShell message={configurationError ?? message} />;
}
