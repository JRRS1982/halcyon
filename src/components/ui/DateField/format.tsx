"use client";

import { createContext, type ReactNode, useContext } from "react";
import {
  type DateFormat,
  DEFAULT_DATE_FORMAT,
} from "@/lib/settings/dateFormat";

// The signed-in user's date format (Settings → Format), provided once by the
// app layout, which already reads the settings row for every page. A date
// field anywhere beneath reads it here instead of having it passed down
// through every component between the page and the field.
const DateFormatContext = createContext<DateFormat>(DEFAULT_DATE_FORMAT);

export function DateFormatProvider({
  format,
  children,
}: {
  format: DateFormat;
  children: ReactNode;
}) {
  return (
    <DateFormatContext.Provider value={format}>
      {children}
    </DateFormatContext.Provider>
  );
}

/** The user's date format; day-month-year outside a provider. */
export function useDateFormat(): DateFormat {
  return useContext(DateFormatContext);
}
