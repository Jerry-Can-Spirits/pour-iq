export const EXTRACT_INVOICE_SYSTEM_PROMPT = `You are an extraction engine inside Pour IQ. You receive a UK trade-supplier invoice (drinks, ingredients, food) addressed to a bar, pub, restaurant, or hotel. Return every billable product line with its per-unit net price.

What counts as a line:
- Each billable product on the invoice. Capture the product name as written, including brand and size when shown ("Smirnoff Red Label 1L" keeps the 1L).
- Skip section headers, subtotals, totals, VAT lines, delivery charges, fuel surcharges, deposits, returns, and any line that isn't a billable product the venue is buying.

Price rules — extract NET of VAT per unit:
- Pour IQ stores ex-VAT costs because trade venues reclaim VAT. Always extract the per-unit (per-bottle, per-pack, per-case-unit) NET price.
- If the line shows both net and gross, use net.
- If the line only shows gross (inc-VAT), divide by 1.20 and round to the nearest pence. Don't return gross.
- Never return the line total. Never return the total of multiple units bought.
- Express prices in integer pence: £14.50 = 1450.

Quantity:
- Capture how many units were bought on the line if visible (12 bottles, 6 cases, etc). Informational only; not used in the cost calculation.

Header data:
- supplier_name: the company billing the venue. Null if not clearly visible.
- invoice_number: the supplier's reference for this invoice. Null if not clearly visible.
- invoice_date: ISO YYYY-MM-DD. Null if not clearly visible or ambiguous.

If a line is unreadable or ambiguous, skip it rather than guess.

Output: call the pouriq_extract_invoice tool with the structured result.`

export interface ExtractedInvoiceLine {
  extracted_name: string
  extracted_quantity: number | null
  extracted_unit_price_p: number
  extracted_line_total_p: number | null
}

export interface ExtractInvoiceResult {
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  lines: ExtractedInvoiceLine[]
}

export const EXTRACT_INVOICE_TOOL = {
  name: 'pouriq_extract_invoice',
  description: 'Return the structured invoice header and line items extracted from the supplier invoice',
  input_schema: {
    type: 'object',
    required: ['supplier_name', 'invoice_number', 'invoice_date', 'lines'],
    properties: {
      supplier_name: { type: ['string', 'null'] },
      invoice_number: { type: ['string', 'null'] },
      invoice_date: { type: ['string', 'null'] },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          required: ['extracted_name', 'extracted_unit_price_p'],
          properties: {
            extracted_name: { type: 'string' },
            extracted_quantity: { type: ['integer', 'null'] },
            extracted_unit_price_p: { type: 'integer' },
            extracted_line_total_p: { type: ['integer', 'null'] },
          },
        },
      },
    },
  },
} as const
