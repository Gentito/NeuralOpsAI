---
name: "skill_invoice_generation"
description: "Generates an invoice template and totals with payment terms. Invoke when user asks for an invoice, pricing summary, or billing document."
---

# skill_invoice_generation

## Purpose

Create consistent invoices for services delivered by NeuralOps AI, including clear line items, totals, and payment terms.

## When to Invoke

- User asks: "generate an invoice", "bill the client", "pricing", "statement"
- You need an invoice draft from a scope of work or completed tasks

## Required Inputs

- Client name
- Services / line items (description, quantity, unit price)
- Currency
- Due date / payment terms (e.g., Net 7, Net 14)

## Optional Inputs

- Tax/VAT rules
- Discount
- Purchase order / reference number
- Notes (support contact, warranty, etc.)

## Output Format

- Invoice header (issuer, client, invoice #, issue date, due date)
- Line items table
- Subtotal, tax, discount, total
- Payment terms (explicitly state no payment processing without approval)

