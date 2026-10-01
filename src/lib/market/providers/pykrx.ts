import { spawn } from "node:child_process";
import path from "node:path";
import { asNumber } from "../chain";
import type { IndexMove, LiveQuote, QuoteProvider } from "../types";

function scriptPath() {
  return path.join(process.cwd(), "scripts", "pykrx_quotes.py");
}

function runPykrx(args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [scriptPath(), ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("pykrx timeout"));
    }, 25_000);
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(err.trim() || `pykrx exit ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(out));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function createPykrxProvider(): QuoteProvider {
  return {
    name: "pykrx",
    async quotes(tickers) {
      if (!tickers.length) return [];
      try {
        const data = (await runPykrx(["--tickers", tickers.join(",")])) as {
          quotes?: Array<Record<string, unknown>>;
        };
        return (data.quotes ?? [])
          .map((row) => {
            const ticker = String(row.ticker ?? "");
            const lastPrice = asNumber(row.lastPrice);
            const changePct = asNumber(row.changePct);
            const volume = asNumber(row.volume) ?? 0;
            if (!/^[0-9A-Z]{6}$/.test(ticker) || !(lastPrice && lastPrice > 0) || changePct == null) return null;
            return { ticker, lastPrice, changePct, volume } satisfies LiveQuote;
          })
          .filter((row): row is LiveQuote => Boolean(row));
      } catch {
        return [];
      }
    },
    async indexes(): Promise<IndexMove> {
      try {
        const data = (await runPykrx(["--indexes"])) as IndexMove;
        return {
          kospi: asNumber(data.kospi),
          kosdaq: asNumber(data.kosdaq),
        };
      } catch {
        return { kospi: null, kosdaq: null };
      }
    },
  };
}
