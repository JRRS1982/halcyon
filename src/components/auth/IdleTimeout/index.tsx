"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef } from "react";
import { signOutIdle } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import {
  SESSION_TIMEOUT,
  type SessionTimeoutConfig,
} from "@/lib/auth/sessionTimeout";
import { useIdleTimer } from "@/lib/hooks/useIdleTimer";
import {
  Actions,
  Body,
  Countdown,
  Eyebrow,
  Message,
  Sheet,
  Title,
} from "./IdleTimeout.styled";

// Warns before the idle window closes and signs the user out when it does.
// Rendered by the root layout for signed-in users only.
//
// This is the courteous half of the timeout, not the enforcing half: the proxy
// (`src/lib/supabase/middleware.ts`) is what actually ends sessions, including
// for browsers that were closed rather than left idle. This exists so a session
// left open on screen closes itself, with a chance to say otherwise first.
export function IdleTimeout({
  config = SESSION_TIMEOUT,
}: {
  // Injectable so tests need not run out a real multi-hour window.
  config?: SessionTimeoutConfig;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  const handleExpire = useCallback(() => {
    void signOutIdle();
  }, []);

  const { warning, secondsRemaining, extend } = useIdleTimer({
    onExpire: handleExpire,
    config,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (warning && !dialog.open) dialog.showModal();
    if (!warning && dialog.open) dialog.close();
  }, [warning]);

  const staySignedIn = () => {
    extend();
    // Every request passes through the proxy, which rewrites the activity
    // cookie — so a refresh is all it takes to reset the server's clock too.
    // No dedicated action needed.
    router.refresh();
  };

  return (
    <Sheet
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      // Escape would dismiss the warning while the clock kept running, which
      // reads as "handled" and is not. Force an explicit choice.
      onCancel={(event) => event.preventDefault()}
    >
      <Body>
        <Eyebrow>Session</Eyebrow>
        <Title id={titleId}>Still there?</Title>
        <Message id={messageId}>
          You have been inactive for a while. For your security we will sign you
          out in <Countdown>{secondsRemaining}</Countdown> seconds.
        </Message>
      </Body>
      <Actions>
        <Button
          type="button"
          variant="outline"
          onClick={() => void signOutIdle()}
        >
          Sign out
        </Button>
        <Button type="button" onClick={staySignedIn}>
          Stay signed in
        </Button>
      </Actions>
    </Sheet>
  );
}
