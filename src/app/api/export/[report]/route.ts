import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { boekjaren } from "@/db/schema";
import type { Richting } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { getActiefBoekjaar } from "@/lib/boekjaar";
import { getBedrijfsnaam } from "@/lib/settings";
import { bouwRapport, isRapportNaam } from "@/lib/export/reports";
import { tabelNaarCsv } from "@/lib/export/csv";
import { tabelNaarXlsx } from "@/lib/export/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Maakt een bestandsnaam veilig (ascii, geen spaties/rare tekens). */
function veiligeBestandsnaam(naam: string): string {
  return (
    naam
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}

/**
 * Route handler voor exports: `/api/export/[report]?jaar=…&formaat=csv|xlsx`.
 * Rapporten: transacties (met optionele `richting`), btw, wv, balans.
 * Vereist een sessie (redirect naar /login zonder sessie).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ report: string }> },
) {
  await requireSession();

  const { report } = await params;
  if (!isRapportNaam(report)) {
    return NextResponse.json(
      { error: "Onbekend rapport." },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const formaat = url.searchParams.get("formaat") === "xlsx" ? "xlsx" : "csv";
  const richtingParam = url.searchParams.get("richting");
  const richting: Richting | undefined =
    richtingParam === "verkoop" || richtingParam === "inkoop"
      ? richtingParam
      : undefined;

  // Boekjaar bepalen: expliciete `jaar` of het actieve boekjaar.
  const jaarParam = url.searchParams.get("jaar");
  let boekjaar;
  if (jaarParam != null && /^\d+$/.test(jaarParam)) {
    boekjaar = db
      .select()
      .from(boekjaren)
      .where(eq(boekjaren.jaar, Number(jaarParam)))
      .get();
  } else {
    boekjaar = (await getActiefBoekjaar()) ?? undefined;
  }

  if (!boekjaar) {
    return NextResponse.json(
      { error: "Boekjaar niet gevonden." },
      { status: 404 },
    );
  }

  const bedrijfsnaam = getBedrijfsnaam();
  const tabel = bouwRapport(db, report, boekjaar.id, boekjaar.jaar, richting);
  const basisnaam = `${veiligeBestandsnaam(tabel.titel)}-${boekjaar.jaar}`;

  if (formaat === "xlsx") {
    const buffer = await tabelNaarXlsx(tabel, bedrijfsnaam);
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${basisnaam}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = tabelNaarCsv(tabel, bedrijfsnaam);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${basisnaam}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
