import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customerAddressSnapshot,
  fillBlankCustomerAddress,
  invoiceAddressEmpty,
  withCustomerAddressFallback,
} from "../lib/customer-address.ts";
import type { Invoice } from "../lib/types.ts";

const customer = {
  street: "Pekařská 5",
  city: "Brno",
  zip: "60200",
  country: "Česká republika",
};

test("invoiceAddressEmpty detects missing street/city/zip", () => {
  assert.equal(invoiceAddressEmpty({ customerStreet: "", customerCity: "", customerZip: "" }), true);
  assert.equal(invoiceAddressEmpty({ customerStreet: "Ulice 1", customerCity: "", customerZip: "" }), false);
});

test("fillBlankCustomerAddress copies only empty snapshot fields", () => {
  const filled = fillBlankCustomerAddress(
    {
      customerStreet: "",
      customerCity: "Praha",
      customerZip: "",
      customerCountry: "",
    },
    customer,
  );
  assert.equal(filled.customerStreet, "Pekařská 5");
  assert.equal(filled.customerCity, "Praha");
  assert.equal(filled.customerZip, "60200");
  assert.equal(filled.customerCountry, "Česká republika");
});

test("withCustomerAddressFallback leaves complete snapshot untouched", () => {
  const invoice = {
    customerStreet: "Jinde 2",
    customerCity: "Ostrava",
    customerZip: "70000",
    customerCountry: "Česká republika",
  } as Invoice;
  const next = withCustomerAddressFallback(invoice, customer);
  assert.equal(next.customerStreet, "Jinde 2");
  assert.equal(next.customerCity, "Ostrava");
  assert.equal(next.customerZip, "70000");
});

test("customerAddressSnapshot normalizes country", () => {
  assert.deepEqual(customerAddressSnapshot({ street: "A", city: "B", zip: "1", country: "" }), {
    customerStreet: "A",
    customerCity: "B",
    customerZip: "1",
    customerCountry: "Česká republika",
  });
});
