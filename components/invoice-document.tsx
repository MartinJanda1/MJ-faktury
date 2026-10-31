import { buildSpaydString, resolveIban } from "@/lib/payment-qr";
import { formatDate, formatQuantity } from "@/lib/money";
import type { Company, Invoice } from "@/lib/types";
import "./invoice-document.css";

function formatCzechAmount(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function accountLabel(company: Company): string {
  if (company.bankAccount && company.bankCode) {
    return `${company.bankAccount}/${company.bankCode}`;
  }
  return company.bankAccount || "";
}

function cityLine(zip: string, city: string): string {
  return [zip, city].filter(Boolean).join(" ");
}

export type InvoiceDocumentProps = {
  invoice: Invoice;
  company: Company;
  /** Hide QR canvas host when SPAYD cannot be built (still reserves structure when true). */
  showQr?: boolean;
};

export function InvoiceDocument({ invoice, company, showQr }: InvoiceDocumentProps) {
  const account = accountLabel(company);
  const iban = resolveIban(account, company.iban);
  const amount = invoice.totalGross;
  const layout = invoice.layout === "idoklad" ? "idoklad" : "classic";
  const paymentMethod = invoice.paymentMethod || "Převodem";
  const showQrForTransfer = paymentMethod.toLowerCase().includes("převod") || paymentMethod.toLowerCase().includes("prevod");
  const spayd = buildSpaydString({
    iban,
    amount,
    variableSymbol: invoice.variableSymbol,
    constantSymbol: invoice.constantSymbol,
    dueDate: invoice.dueDate,
    message: invoice.number ? `Faktura ${invoice.number}` : "Faktura",
  });
  const qrVisible = showQr !== false && showQrForTransfer && Boolean(spayd && amount > 0);
  const totalText = formatCzechAmount(amount);

  return (
    <article
      id="invoice-document"
      className={`invoice-document layout-${layout}`}
      data-layout={layout}
      data-spayd={qrVisible ? spayd ?? undefined : undefined}
      data-invoice-number={invoice.number}
    >
      <section className="inv-section inv-section-ident">
        <div className="section-label">
          <span>IDENTIFIKAČNÍ ÚDAJE</span>
        </div>
        <div className="section-body">
          <div className="ident-columns">
            <div className="supplier-top">
              <h3 className="party-heading">Dodavatel</h3>
              <span className="party-name">{company.name || "Doplňte firmu v nastavení"}</span>
              {company.street ? <span className="party-line">{company.street}</span> : null}
              {cityLine(company.zip, company.city) ? (
                <span className="party-line">{cityLine(company.zip, company.city)}</span>
              ) : null}
              <span className="party-line">{company.country || "Česká republika"}</span>
              {company.ico ? (
                <div className="party-ids">
                  <span>IČ:</span>
                  <span>{company.ico}</span>
                </div>
              ) : null}
              {company.dic ? (
                <div className="party-ids">
                  <span>DIČ:</span>
                  <span>{company.dic}</span>
                </div>
              ) : null}
              {company.vatNote ? <span className="supplier-vat-note">{company.vatNote}</span> : null}
              {(company.email || company.phone) && (
                <>
                  <strong className="contact-block-title">Kontaktní údaje</strong>
                  {company.email ? (
                    <div className="contact-row">
                      <span>E-mail:</span>
                      <span>{company.email}</span>
                    </div>
                  ) : null}
                  {company.phone ? (
                    <div className="contact-row">
                      <span>Telefon:</span>
                      <span>{company.phone}</span>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="invoice-header-row">
              <span className="invoice-title">Faktura</span>
              <span className="invoice-number-box">{invoice.number}</span>
            </div>

            <div className="customer-details">
              <h3 className="party-heading">Odběratel</h3>
              <span className="party-name">{invoice.customerName || "—"}</span>
              {invoice.customerStreet ? (
                <span className="party-line">{invoice.customerStreet}</span>
              ) : null}
              {cityLine(invoice.customerZip, invoice.customerCity) ? (
                <span className="party-line">
                  {cityLine(invoice.customerZip, invoice.customerCity)}
                </span>
              ) : null}
              <span className="party-line">{invoice.customerCountry || "Česká republika"}</span>
              {(invoice.customerIco || invoice.customerDic) && (
                <div className="party-ids">
                  {invoice.customerIco ? (
                    <>
                      <span>IČ:</span>
                      <span>{invoice.customerIco}</span>
                    </>
                  ) : null}
                  {invoice.customerDic ? (
                    <>
                      <span style={{ marginLeft: invoice.customerIco ? "0.5rem" : 0 }}>DIČ:</span>
                      <span>{invoice.customerDic}</span>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="inv-section inv-section-payment">
        <div className="section-label">
          <span>PLATEBNÍ ÚDAJE</span>
        </div>
        <div className="section-body">
          <div className="payment-bar">
            <div className="payment-col">
              <div className="payment-line">
                <span>Bankovní účet:</span>
                <span>{account || "—"}</span>
              </div>
              <div className="payment-line">
                <span>IBAN:</span>
                <span>{company.iban || iban || "—"}</span>
              </div>
              <div className="payment-line">
                <span>SWIFT:</span>
                <span>{company.swift || "—"}</span>
              </div>
            </div>
            <div className="payment-col">
              <div className="payment-line">
                <span>Symbol</span>
              </div>
              <div className="payment-line indent">
                <span>variabilní:</span>
                <span>{invoice.variableSymbol || "—"}</span>
              </div>
              <div className="payment-line indent">
                <span>konstantní:</span>
                <span>{invoice.constantSymbol || "—"}</span>
              </div>
            </div>
            <div className="payment-col">
              <div className="payment-line">
                <span>Způsob platby:</span>
                <span>{paymentMethod}</span>
              </div>
              {invoice.orderNumber ? (
                <div className="payment-line">
                  <span>Objednávka:</span>
                  <span>{invoice.orderNumber}</span>
                </div>
              ) : null}
            </div>
            <div className="payment-total-col">
              <span className="label">K úhradě</span>
              <span className="amount">
                {totalText} Kč
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="inv-section inv-section-dates">
        <div className="section-label">
          <span>&nbsp;</span>
        </div>
        <div className="section-body">
          <div className="inv-dates-row">
            <div className="date-item">
              <span>Datum vystavení:</span>
              <strong>{formatDate(invoice.issueDate)}</strong>
            </div>
            <div className="date-item">
              <span>Datum splatnosti:</span>
              <strong>{formatDate(invoice.dueDate)}</strong>
            </div>
            {invoice.orderNumber ? (
              <div className="date-item layout-classic-extra">
                <span>Číslo objednávky:</span>
                <strong>{invoice.orderNumber}</strong>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="inv-section inv-section-items">
        <div className="section-label">
          <span>FAKTURUJEME VÁM</span>
        </div>
        <div className="section-body">
          <p className="items-intro">Fakturujeme Vám za dodané zboží či služby:</p>
          {invoice.description ? <p className="items-intro">{invoice.description}</p> : null}
          <table className="items-table">
            <thead>
              <tr>
                <th className="col-desc">Označení dodávky</th>
                <th className="col-qty">Počet</th>
                <th className="col-unit">m.j.</th>
                <th className="col-price">Cena za m.j.</th>
                <th className="col-total">Celkem</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.length === 0 ? (
                <tr>
                  <td className="col-desc">—</td>
                  <td className="col-qty">—</td>
                  <td className="col-unit">—</td>
                  <td className="col-price">—</td>
                  <td className="col-total">—</td>
                </tr>
              ) : (
                invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="col-desc">{item.name}</td>
                    <td className="col-qty">{formatQuantity(item.quantity)}</td>
                    <td className="col-unit">{item.unit || "ks"}</td>
                    <td className="col-price">{formatCzechAmount(item.unitPrice)}</td>
                    <td className="col-total">{formatCzechAmount(item.totalNet)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="inv-section section-recap inv-section-recap">
        <div className="section-label">
          <span>REKAPITULACE</span>
        </div>
        <div className="section-body">
          <div className="recap-row">
            {qrVisible ? (
              <div id="payment-qr-wrap" className="payment-qr-frame" data-qr-host>
                <div className="payment-qr-body">
                  <canvas id="payment-qr-canvas" width={120} height={120} aria-hidden="true" />
                </div>
                <div className="payment-qr-caption">
                  <span className="payment-qr-line" aria-hidden="true" />
                  <span className="payment-qr-label">QR platba</span>
                  <span className="payment-qr-line" aria-hidden="true" />
                </div>
              </div>
            ) : null}
            <div className="recap-bar">
              <span>Celkem k úhradě:</span>
              <strong>
                {totalText} Kč
              </strong>
            </div>
          </div>
          {invoice.note ? (
            <p style={{ width: "100%", margin: "0.75rem 0 0", fontSize: 12, color: "#444" }}>
              {invoice.note}
            </p>
          ) : null}
        </div>
      </section>

      {company.footerNote ? (
        <footer className="inv-footer-note">
          <p>{company.footerNote}</p>
        </footer>
      ) : null}
    </article>
  );
}
