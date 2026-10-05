# FasTrack Shop — multi-tenant + India launch plan

Decisions (confirmed with the owner):

| Question | Decision |
|---|---|
| Tenant model | India is a **separate tenant**: its own admin, suppliers, riders, products, orders, reports |
| India payments at launch | **Cash on delivery only**; Razorpay (UPI/cards) is phase 2 |
| Languages | **English only** for India (Arabic stays for Saudi) |
| Domain | Same **shop.fastrack.cloud**; country/tenant suggested on first visit, customer can change it |
| Launch target | India live about one month from now |

## Architecture

One Supabase project, shared tables, `tenant_id` on every business row.

* **Isolation** is enforced in the database with *restrictive* RLS policies layered on the existing policies (draft: `supabase/drafts/0044_multi_tenant_foundation.sql`). Existing policies keep working and are additionally fenced by tenant.
* **Who is in which tenant**
  * Staff (admin, supplier/merchant, rider, warehouse staff) are pinned to `profiles.tenant_id`.
  * Shoppers/visitors use the market they chose, sent as the `x-tenant-id` header by the app; default tenant if none.
  * `super_admin` (platform owner) sees all tenants. `admin` becomes *tenant admin*.
* **Customers** have one login. Their addresses, cart and wishlist are theirs; orders and payments carry the tenant of the shop they bought from. (Supabase Auth emails are unique per project, so truly separate logins per tenant for the same email is not possible; this is the standard workaround.)

## Phases (4 weeks)

### Week 1 — foundation (database + app plumbing)
1. Run migration 0043 (Express/Standard delivery), then review and run 0044 on a Supabase **branch** first.
2. Tenant resolution in the app: cookie `fs_tenant`, sent as `x-tenant-id` by the browser, server and middleware Supabase clients.
3. Country detection on first visit (`cf-ipcountry`, already available) → suggest market; manual switcher in Account and header.
4. Registration stores the tenant (`signUp` options.data.tenant_id); profile trigger reads it.

### Week 2 — country configuration (money, tax, forms)
1. `formatMoney(amount, currency)` replaces `formatSAR` everywhere (₹ for INR).
2. Tax from config: per-product `tax_rate` (GST 0/5/12/18 %), country default, tax label (VAT/GST) on screens and invoices; `orders` already carry currency/country/tax label.
3. India address form: state, PIN code (6 digits), landmark; phone default +91 with Indian mobile validation (10 digits, starts 6–9).
4. Supplier onboarding for India: **GSTIN** (15 chars, with checksum), **PAN**, FSSAI licence (food), bank **IFSC + account number** instead of IBAN; Saudi keeps CR/VAT/IBAN.
5. Rider onboarding for India: Aadhaar/PAN/Driving Licence instead of Iqama/national ID.

### Week 3 — tenant admin, super admin, invoices
1. Super Admin dashboard: create tenant, activate/suspend, countries, users, platform revenue, audit log.
2. Tenant Admin = the current admin, scoped to its tenant (settings, categories, suppliers, riders, zones, settlements).
3. India tax invoice (GST): GSTIN, HSN, place of supply, CGST+SGST or IGST split, per-line rates; business settings per tenant.
4. Supplier settlement and rider settlement in INR; commission per tenant.

### Week 4 — launch readiness
1. Seed India catalog, categories, one test supplier, delivery zones (Express radius + Standard areas), riders.
2. End-to-end test: customer (India market) → supplier → rider → delivery → settlement.
3. Isolation tests: Saudi staff can never read India rows and vice-versa (automated SQL checks).
4. Legal: GST registration, FSSAI licence, supplier/rider agreements, India privacy and terms pages.

## Not in the first India release
Online payments (Razorpay), Hindi/regional languages, tenant plans/subscriptions billing, per-tenant custom domains.

## Risks / things only the owner can unblock
* **GST registration + FSSAI licence** are legal prerequisites for selling food/grocery in India; the software supports them, it cannot replace them.
* GST invoicing rules are detailed (rates by HSN, e-invoicing thresholds); a chartered accountant should confirm the invoice template before launch.
* Indian delivery partners/riders are often gig workers: confirm the payout model (per-order fee vs salary).
* Cash on delivery in India needs a cash-reconciliation routine; the rider settlement ledger already supports it.
