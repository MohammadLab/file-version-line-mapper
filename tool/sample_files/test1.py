"""
Simple invoice processing service (v1).

This module loads invoices, calculates totals,
applies discounts, and exports a basic report.
"""

import csv
from dataclasses import dataclass
from typing import List, Dict


@dataclass
class Invoice:
  id: str
  customer: str
  amount: float
  paid: bool = False
  currency: str = "USD"


def load_invoices(path: str) -> List[Invoice]:
  """
  Load invoices from a CSV file.
  Expected columns: id,customer,amount,paid,currency
  """
  invoices: List[Invoice] = []

  with open(path, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
      if not row.get("id"):
        # skip rows without an id
        continue

      amount_str = (row.get("amount") or "0").strip()
      try:
        amount = float(amount_str)
      except ValueError:
        # log and skip invalid amount
        print(f"Skipping invoice with invalid amount: {amount_str}")
        continue

      paid_flag = (row.get("paid") or "").strip().lower() == "true"
      currency = (row.get("currency") or "USD").strip() or "USD"

      invoices.append(
        Invoice(
          id=row["id"].strip(),
          customer=(row.get("customer") or "").strip(),
          amount=amount,
          paid=paid_flag,
          currency=currency,
        )
      )

  return invoices


def calculate_totals(invoices: List[Invoice]) -> Dict[str, float]:
  """
  Calculate total amounts for paid and unpaid invoices.
  """
  total_paid = 0.0
  total_unpaid = 0.0

  for inv in invoices:
    if inv.paid:
      total_paid += inv.amount
    else:
      total_unpaid += inv.amount

  return {
    "total_paid": total_paid,
    "total_unpaid": total_unpaid,
    "grand_total": total_paid + total_unpaid,
  }


def apply_discount(invoices: List[Invoice], threshold: float, percent: float) -> None:
  """
  Apply a percentage discount to invoices whose amount
  is strictly greater than the threshold.
  """
  if percent <= 0:
    return

  for inv in invoices:
    if inv.amount > threshold:
      original = inv.amount
      inv.amount = round(inv.amount * (1 - percent / 100), 2)
      print(
        f"Applied {percent:.1f}% discount to invoice "
        f"{inv.id} (from {original:.2f} to {inv.amount:.2f})"
      )


def export_report(invoices: List[Invoice], path: str) -> None:
  """
  Export a simple invoice report as CSV.
  """
  fieldnames = ["id", "customer", "amount", "paid", "currency"]

  with open(path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()

    for inv in invoices:
      writer.writerow(
        {
          "id": inv.id,
          "customer": inv.customer,
          "amount": f"{inv.amount:.2f}",
          "paid": "true" if inv.paid else "false",
          "currency": inv.currency,
        }
      )


def print_summary(stats: Dict[str, float]) -> None:
  """
  Print a summary of invoice totals.
  """
  print(
    f"Paid: {stats['total_paid']:.2f}, "
    f"Unpaid: {stats['total_unpaid']:.2f}, "
    f"Grand Total: {stats['grand_total']:.2f}"
  )


def main() -> None:
  invoices = load_invoices("invoices.csv")
  totals_before = calculate_totals(invoices)
  print("Totals before discounts:")
  print_summary(totals_before)

  apply_discount(invoices, threshold=500.0, percent=10.0)

  totals_after = calculate_totals(invoices)
  print("Totals after discounts:")
  print_summary(totals_after)

  export_report(invoices, "invoice_report.csv")
  print("Report exported to invoice_report.csv")


if __name__ == "__main__":
  main()
