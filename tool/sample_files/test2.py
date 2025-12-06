"""
Invoice processing service (v2).

This version adds basic logging, supports
a configurable currency filter, and tweaks the
discount logic to include threshold edge cases.
"""

import csv
from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class Invoice:
  id: str
  customer: str
  amount: float
  paid: bool = False
  currency: str = "USD"
  notes: str = ""  # NEW: optional free-form notes


def load_invoices(path: str, currency_filter: Optional[str] = None) -> List[Invoice]:
  """
  Load invoices from a CSV file.

  Expected columns:
    id,customer,amount,paid,currency,notes

  If currency_filter is provided, only invoices
  with that currency are included.
  """
  invoices: List[Invoice] = []

  with open(path, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
      inv_id = (row.get("id") or "").strip()
      if not inv_id:
        # skip rows without an id
        continue

      amount_str = (row.get("amount") or "0").strip()
      try:
        amount = float(amount_str)
      except ValueError:
        # log and skip invalid amount
        print(
          "Skipping invoice with invalid amount "
          f"(id={inv_id}, amount={amount_str})"
        )
        continue

      currency = (row.get("currency") or "USD").strip() or "USD"
      if currency_filter and currency != currency_filter:
        # filtered out by requested currency
        continue

      paid_flag = (row.get("paid") or "").strip().lower() == "true"
      customer = (row.get("customer") or "").strip()
      notes = (row.get("notes") or "").strip()

      invoices.append(
        Invoice(
          id=inv_id,
          customer=customer,
          amount=amount,
          paid=paid_flag,
          currency=currency,
          notes=notes,
        )
      )

  print(f"Loaded {len(invoices)} invoices from {path}")
  return invoices


def calculate_totals(invoices: List[Invoice]) -> Dict[str, float]:
  """
  Calculate total amounts for paid and unpaid invoices.

  Also returns a count of invoices.
  """
  total_paid = 0.0
  total_unpaid = 0.0
  count = 0

  for inv in invoices:
    count += 1
    if inv.paid:
      total_paid += inv.amount
    else:
      total_unpaid += inv.amount

  return {
    "total_paid": total_paid,
    "total_unpaid": total_unpaid,
    "grand_total": total_paid + total_unpaid,
    "count": float(count),
  }


def apply_discount(
  invoices: List[Invoice],
  threshold: float,
  percent: float,
  include_paid: bool = False,
) -> None:
  """
  Apply a percentage discount to invoices whose amount
  is greater than or equal to the threshold.

  If include_paid is True, the discount is also applied
  to invoices that are already paid.
  """
  if percent <= 0:
    print("Discount percent is non-positive; no discounts applied.")
    return

  for inv in invoices:
    if not include_paid and inv.paid:
      continue

    # NEW: >= instead of > for threshold comparison
    if inv.amount >= threshold:
      original = inv.amount
      inv.amount = round(inv.amount * (1 - percent / 100), 2)
      print(
        f"Applied {percent:.1f}% discount to invoice {inv.id} "
        f"(from {original:.2f} to {inv.amount:.2f}, "
        f"paid={inv.paid}, currency={inv.currency})"
      )


def export_report(invoices: List[Invoice], path: str, include_notes: bool = True) -> None:
  """
  Export a more detailed invoice report as CSV.
  """
  base_fields = ["id", "customer", "amount", "paid", "currency"]
  fieldnames = base_fields + (["notes"] if include_notes else [])

  with open(path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()

    for inv in invoices:
      row = {
        "id": inv.id,
        "customer": inv.customer,
        "amount": f"{inv.amount:.2f}",
        "paid": "true" if inv.paid else "false",
        "currency": inv.currency,
      }
      if include_notes:
        row["notes"] = inv.notes
      writer.writerow(row)


def print_summary(stats: Dict[str, float]) -> None:
  """
  Print a summary of invoice totals and count.
  """
  print(
    "Summary:"
  )
  print(
    f"  Paid: {stats['total_paid']:.2f}\n"
    f"  Unpaid: {stats['total_unpaid']:.2f}\n"
    f"  Grand Total: {stats['grand_total']:.2f}\n"
    f"  Count: {int(stats.get('count', 0))}"
  )


def main() -> None:
  invoices = load_invoices("invoices.csv", currency_filter=None)
  totals_before = calculate_totals(invoices)
  print("Totals before discounts (all currencies):")
  print_summary(totals_before)

  apply_discount(
    invoices,
    threshold=500.0,
    percent=12.5,
    include_paid=False,
  )

  totals_after = calculate_totals(invoices)
  print("Totals after discounts (unpaid invoices only):")
  print_summary(totals_after)

  export_report(invoices, "invoice_report_v2.csv", include_notes=True)
  print("Report exported to invoice_report_v2.csv")


if __name__ == "__main__":
  main()
