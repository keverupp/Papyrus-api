"use strict";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function sanitizeNumericString(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") {
    return Number.isFinite(value) ? Number(value) : NaN;
  }

  const normalized = value
    .replace(/[^0-9.,-]+/g, "")
    .replace(/(?!^)-/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(/,/g, ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function extractDigits(value) {
  return (value ?? "")
    .toString()
    .replace(/\D+/g, "");
}

function formatCurrencyBRL(value) {
  const parsed = sanitizeNumericString(value);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return currencyFormatter.format(safeValue);
}

function formatPhoneNumber(value) {
  if (value === null || value === undefined) return "";

  let digits = extractDigits(value);

  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  if (digits.length > 11) {
    return formatPhoneNumber(digits.slice(0, 11));
  }

  return value.toString();
}

function formatCnpj(value) {
  const digits = extractDigits(value);
  if (digits.length !== 14) {
    return value ?? "";
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(
    5,
    8
  )}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCpf(value) {
  const digits = extractDigits(value);
  if (digits.length !== 11) {
    return value ?? "";
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
    6,
    9
  )}-${digits.slice(9)}`;
}

function formatCpfCnpj(value) {
  const digits = extractDigits(value);

  if (digits.length === 11) {
    return formatCpf(digits);
  }

  if (digits.length === 14) {
    return formatCnpj(digits);
  }

  return value ?? "";
}

function formatCep(value) {
  const digits = extractDigits(value);
  if (digits.length !== 8) {
    return value ?? "";
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

module.exports = {
  formatCurrencyBRL,
  formatPhoneNumber,
  formatCnpj,
  formatCpf,
  formatCpfCnpj,
  formatCep,
};
