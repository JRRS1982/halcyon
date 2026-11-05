"use client";

import { useEffect, useState } from "react";
import {
  PHONE_PLOT_QUERY,
  PLOT_LEFT_INSET,
  PLOT_LEFT_INSET_PHONE,
} from "./axisGeometry";

// The chart Y-axis width is a recharts prop, so the phone-sized gutter can't
// come from a media query — this mirrors PHONE_PLOT_QUERY in JS. Initialised
// to the desktop inset and corrected in an effect so server and first client
// render agree (the charts are client-only, but the hook stays hydration-safe
// for any future SSR'd consumer).
/** True while the plan's charts are laid out for a phone (PHONE_PLOT_QUERY). */
export function useIsPhonePlot(): boolean {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(PHONE_PLOT_QUERY);
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isPhone;
}

export function usePlotLeftInset(): number {
  return useIsPhonePlot() ? PLOT_LEFT_INSET_PHONE : PLOT_LEFT_INSET;
}
