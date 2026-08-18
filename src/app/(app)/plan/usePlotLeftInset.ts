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
export function usePlotLeftInset(): number {
  const [inset, setInset] = useState(PLOT_LEFT_INSET);

  useEffect(() => {
    const mq = window.matchMedia(PHONE_PLOT_QUERY);
    const update = () =>
      setInset(mq.matches ? PLOT_LEFT_INSET_PHONE : PLOT_LEFT_INSET);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return inset;
}
