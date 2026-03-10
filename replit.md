# cdz-pedidos

A web-based order management system for Cruce del Zorro (CDZ), a winery/wine distributor. Sales representatives use it to submit orders; administrators manage and track them in real time.

## Tech Stack

- **Frontend:** React 19 + Vite 8
- **Backend:** Firebase (Auth, Firestore, Storage) — no dedicated server
- **Package Manager:** npm
- **Language:** JavaScript (ESM)

## Project Structure

```
index.html          — HTML entry point
src/
  main.jsx          — React app mount
  App.jsx           — Main component (Firebase init, Login, FormVendedor, PanelAdmin)
  App.css / index.css
public/             — Static assets
```

## Key Features

- Vendor login via email/password or Google Sign-In, restricted to @crucedelzorro.com accounts (Firebase Auth)
- Order entry form (FormVendedor) with product catalog and payment method selection
- "BAJAS" channel option: disables payment/cobro fields, shows "Tipo de Baja de Producto" dropdown (Bonificación, Muestra, Degustación)
- Admin panel (PanelAdmin) with real-time Firestore updates, filtering, and status management
- User roles: `admin` (full access), `comm` (admin panel without factura access), `vendedor` (order form)
- Admin authorization fields: "Autorizar Baja" (for BAJAS orders), "Autorizar Crédito" (for credit orders) — one-time modifiable
- Excel export via `xlsx` library
- Image upload for receipts via Firebase Storage

## Development

```bash
npm run dev    # starts Vite dev server on 0.0.0.0:5000
npm run build  # builds to dist/
```

## Deployment

Configured as a **static** deployment:
- Build: `npm run build`
- Public dir: `dist`
