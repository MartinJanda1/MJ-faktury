import type { Customer, Invoice, InvoiceDraft } from "./types";

type AddressFields = {
  customerStreet: string;
  customerCity: string;
  customerZip: string;
  customerCountry: string;
};

/** True when the invoice snapshot has no usable street / city / ZIP. */
export function invoiceAddressEmpty(invoice: Pick<AddressFields, "customerStreet" | "customerCity" | "customerZip">): boolean {
  return !invoice.customerStreet.trim() && !invoice.customerCity.trim() && !invoice.customerZip.trim();
}

/**
 * Fill blank buyer address fields on an invoice from the linked customer.
 * Existing non-empty snapshot values win (invoice remains a point-in-time copy).
 */
export function fillBlankCustomerAddress<T extends AddressFields>(
  invoice: T,
  customer: Pick<Customer, "street" | "city" | "zip" | "country"> | null | undefined,
): T {
  if (!customer) return invoice;
  return {
    ...invoice,
    customerStreet: invoice.customerStreet.trim() || customer.street.trim(),
    customerCity: invoice.customerCity.trim() || customer.city.trim(),
    customerZip: invoice.customerZip.trim() || customer.zip.trim(),
    customerCountry: invoice.customerCountry.trim() || customer.country.trim() || "Česká republika",
  };
}

/** Apply linked-customer address fallback for display / PDF when the snapshot is incomplete. */
export function withCustomerAddressFallback(
  invoice: Invoice,
  customer: Pick<Customer, "street" | "city" | "zip" | "country"> | null | undefined,
): Invoice {
  return fillBlankCustomerAddress(invoice, customer);
}

export function customerAddressSnapshot(
  customer: Pick<Customer, "street" | "city" | "zip" | "country">,
): Pick<InvoiceDraft, "customerStreet" | "customerCity" | "customerZip" | "customerCountry"> {
  return {
    customerStreet: customer.street.trim(),
    customerCity: customer.city.trim(),
    customerZip: customer.zip.trim(),
    customerCountry: customer.country.trim() || "Česká republika",
  };
}
