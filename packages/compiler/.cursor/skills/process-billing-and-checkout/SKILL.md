---
name: process-billing-and-checkout
description: "Documents the OpenEMR workflow Process Billing and Checkout, which has no matching operations in the spec. Use when the user asks to add billing codes to the fee sheet, record patient payment, and generate a receipt. Leaves add_fee_sheet_code, record_payment, generate_receipt unmapped because those endpoints are not in OpenEMR API 8.4.0."
---

# Process Billing and Checkout

Add billing codes to the fee sheet, record patient payment, and generate a receipt.

Grounded against **OpenEMR API 8.4.0**. Call only the operations below.
Copy method and path exactly. Do not invent endpoints or HTTP methods.

## Inputs

- `cpt_code`
- `payment_method`
- `payment_amount`

## API sequence

No operations in the spec cover this workflow. Do not invent fee-sheet, payment, receipt, or other missing paths.

## Out of spec

Do not call an API for these observed UI steps:

- `add_fee_sheet_code`: No fee-sheet endpoint in spec.

- `record_payment`: No payment endpoint in spec.

- `generate_receipt`: No receipt endpoint in spec.

## Auth

OpenEMR standard REST uses OAuth2 (`openemr_auth`).
Server base path is `/apis/default/` unless the spec says otherwise.
