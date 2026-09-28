import { createKisProvider } from "./providers/kis";
import { createNaverProvider } from "./providers/naver";
import { createPykrxProvider } from "./providers/pykrx";
import { createYahooProvider } from "./providers/yahoo";
import type { QuoteProvider } from "./types";

export function defaultProviders(): QuoteProvider[] {
  return [createKisProvider(), createYahooProvider(), createPykrxProvider(), createNaverProvider()];
}
