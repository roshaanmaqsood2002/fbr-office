import PDFDocument from "pdfkit";
import { Response } from "express";

const money = (minor: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(
    minor / 100,
  );

interface PdfInvoice {
  invoiceNumber?: string | null;
  status: string;
  issueDate: Date;
  dueDate?: Date | null;
  notes?: string | null;
  fbrInvoiceNumber?: string | null;
  buyer: {
    name: string;
    ntn?: string | null;
    address?: string | null;
    province?: string | null;
    registrationType: string;
  };
  lines: {
    description: string;
    hsCode?: string | null;
    uom: string;
    quantity: number;
    unitPrice: number;
    taxRatePercent: number;
    net: number;
    tax: number;
    gross: number;
  }[];
  totals: { net: number; tax: number; gross: number };
}

export function streamInvoicePdf(
  res: Response,
  inv: PdfInvoice,
  seller: { name: string; ntn: string; strn?: string | null; firmName: string },
) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const fileName = (inv.invoiceNumber ?? "draft-invoice").replace(
    /[^\w-]/g,
    "_",
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName}.pdf"`,
  );
  doc.pipe(res);

  doc.fontSize(18).fillColor("#01411c").text("TAX INVOICE", { align: "right" });
  doc.fontSize(14).fillColor("#000").text(seller.name, 40, 40);
  doc
    .fontSize(9)
    .fillColor("#555")
    .text(`NTN: ${seller.ntn}${seller.strn ? `   STRN: ${seller.strn}` : ""}`);
  doc.text(`Prepared by ${seller.firmName}`);

  doc.moveDown(1.5).fillColor("#000").fontSize(10);
  doc.text(`Invoice no: ${inv.invoiceNumber ?? "DRAFT (not numbered)"}`);
  doc.text(`Issue date: ${inv.issueDate.toLocaleDateString("en-GB")}`);
  if (inv.dueDate)
    doc.text(`Due date: ${inv.dueDate.toLocaleDateString("en-GB")}`);
  doc.text(`Status: ${inv.status.replace(/_/g, " ")}`);
  doc.text(`FBR invoice no: ${inv.fbrInvoiceNumber ?? "pending submission"}`);
  doc.moveDown().fontSize(11).text("Bill to", { underline: true });
  doc.fontSize(10).text(inv.buyer.name);
  if (inv.buyer.ntn) doc.text(`NTN / CNIC: ${inv.buyer.ntn}`);
  doc.text(`Buyer type: ${inv.buyer.registrationType}`);
  const addr = [inv.buyer.address, inv.buyer.province]
    .filter(Boolean)
    .join(", ");
  if (addr) doc.text(addr);

  // Table
  const cols = [
    { label: "Description", x: 40, w: 150 },
    { label: "HS code", x: 190, w: 60 },
    { label: "Qty", x: 250, w: 50 },
    { label: "Price", x: 300, w: 70 },
    { label: "Tax", x: 370, w: 40 },
    { label: "Net", x: 410, w: 70 },
    { label: "Total", x: 480, w: 75 },
  ];
  const header = (y: number) => {
    doc
      .rect(40, y - 4, 515, 18)
      .fill("#e6ede9")
      .fillColor("#000")
      .fontSize(9);
    cols.forEach((c) => doc.text(c.label, c.x + 2, y, { width: c.w - 4 }));
    return y + 20;
  };
  let y = header(doc.y + 20);
  inv.lines.forEach((l) => {
    if (y > 740) {
      doc.addPage();
      y = header(40);
    }
    const cells = [
      l.description,
      l.hsCode ?? "",
      `${l.quantity} ${l.uom}`,
      money(l.unitPrice),
      `${l.taxRatePercent}%`,
      money(l.net),
      money(l.gross),
    ];
    doc.fontSize(8.5).fillColor("#000");
    const startY = y;
    let rowH = 12;
    cells.forEach((t, i) => {
      doc.text(t, cols[i].x + 2, startY, { width: cols[i].w - 4 });
      rowH = Math.max(rowH, doc.y - startY + 4);
    });
    y = startY + rowH;
  });

  if (y > 700) {
    doc.addPage();
    y = 40;
  }
  doc.fontSize(10).fillColor("#000");
  doc.text(`Net: ${money(inv.totals.net)}`, 340, y + 10, {
    width: 215,
    align: "right",
  });
  doc.text(`Tax: ${money(inv.totals.tax)}`, 340, doc.y, {
    width: 215,
    align: "right",
  });
  doc
    .fontSize(12)
    .fillColor("#01411c")
    .text(`Total: ${money(inv.totals.gross)}`, 340, doc.y + 2, {
      width: 215,
      align: "right",
    });

  if (inv.notes)
    doc
      .fontSize(9)
      .fillColor("#555")
      .text(`Notes: ${inv.notes}`, 40, doc.y + 20, { width: 515 });
  if (!inv.invoiceNumber)
    doc
      .fontSize(9)
      .fillColor("#dc2626")
      .text("DRAFT: not valid for submission", 40, 780);

  doc.end();
}
