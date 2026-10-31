# Gap analysis: original faktura-app → MJ-faktury (Next/Blob)

Compared against `/tmp/faktura-app-orig` (`web/`, especially `stats.html`, `app-stats.js`, `invoice-stats.js`, `invoice.html`, `index.html`, `help.html`).

## Present and working (this pass + prior ports)

| Area | Status |
|------|--------|
| Invoice list filters (year/month/customer/status/search) + column sort | OK |
| List row actions (detail, edit, PDF, paid, copy, storno) | OK (this pass) |
| Invoice editor: ARES, layout classic/idoklad, payment method, order no., VS/KS/SS | OK (SS this pass) |
| Document preview + html2pdf + QR (SPAYD) | OK |
| Readonly paid / cancelled | OK |
| Bank from company settings, vatNote, footer | OK |
| Numbering suggestions | OK |
| Stats: filters, KPIs, table, customer donut, revenue bars | OK (fixed this pass) |
| Stats filter prefs in `localStorage` | OK (this pass) |
| Import CSV/XLSX/ISDOC/JSON + iDoklad API | OK |
| JSON backup export `/api/export/json` | OK (this pass) |
| Help page | OK (shorter than original) |
| Customers CRUD | OK |

## Intentionally not ported (architecture)

- **Electron / desktop portable `.exe`** — out of scope for Vercel Next app.
- **SQLite / PostgreSQL / Docker NAS** — replaced by JSON Blob store.
- **Session IČO multi-supplier switcher** — original filtered by active supplier IČO; MJ-faktury is single-company (settings). Multi-tenant would need auth + data model.
- **Inline WYSIWYG invoice editor** (edit fields directly on the paper) — replaced by form + document preview.
- **Per-invoice bank account override** — company settings are the source of payment details.

## Still missing or thinner than original

| Feature | Why deferred |
|---------|----------------|
| Day-level date filter on list | Month/year covers most use; day filter is low demand |
| Bulk select + bulk storno/delete | Needs multi-select UX; actions exist per row |
| Delete-only-last-in-series rule | Original numbering safety; not enforced yet |
| Filter/sort prefs persisted on list (`localStorage`) | Stats prefs done; list still URL-only (shareable, but no restore) |
| Dark theme toggle | next-themes may be wired; original had explicit toggle on every page |
| Bank name auto-fill from IBAN on document | IBAN/SWIFT shown; bank name label not shown |
| Full iDoklad layout pixel-perfect quirks | Layout exists; some original CSS-only slots differ |
| Parties file (`parties.json`) as separate template storage | Customers + company settings cover the need |
| Desktop `printToPDF` margins | Browser html2pdf only |

## Stats bugs that were broken in production

1. **React hydration #418** — `toLocaleString("cs-CZ")` NBSP differed between Node SSR and browser → client-only dashboard (`dynamic(..., { ssr: false })` + mount gate).
2. **Empty monthly bars** — CSS `%` height inside nested flex collapsed; replaced with **SVG bar geometry** (explicit pixel heights).
3. Filters/KPIs/table already matched original logic in `lib/invoice-stats.ts`; charts now render when monthly totals exist.
