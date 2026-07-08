/**
 * Next.js instrumentation hook: draait één keer bij het opstarten van de
 * server. De daadwerkelijke migrate-on-boot + seed staan in een apart
 * node-only bestand dat we uitsluitend in de Node.js-runtime dynamisch
 * importeren. Zo blijft de native module `better-sqlite3` buiten de
 * edge-bundle (die o.a. voor de middleware wordt gecompileerd).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
