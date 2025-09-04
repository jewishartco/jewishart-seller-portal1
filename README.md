# Shopify Seller Portal (Cloudinary version, works on Basic plan)

Lets logged-in customers upload works (images/PDFs), set price & details,
and view orders that include their items. Admin receives **Draft products** for review/publish.

## Features
- Upload files to **Cloudinary** via unsigned upload preset (no AWS needed)
- Submit a work → creates a **draft product** with tag `vendor:<customer_id>`
- Vendor "My Orders" shows only orders containing that vendor's products
- Theme page template to expose a **Vendor Dashboard** (classic storefront page)

---

## 1) Cloudinary setup (free)
- Create an account at cloudinary.com.
- Note your **Cloud name**.
- Create an **Unsigned Upload Preset** (e.g., `seller_uploads_unsigned`):
  - Allowed formats: images + pdf
  - (Optional) Folder: `seller-uploads`
- You do not need an API key in the browser; uploads are unsigned using the preset.

## 2) Custom App in Shopify (Admin API)
- Admin → Settings → Apps and sales channels → Develop apps → Create app
- Scopes (Admin API):
  - `read_products`, `write_products`, `read_orders`
- Install the app → copy **Admin API access token**

## 3) App Proxy
- App setup → App proxy
  - Subpath prefix: `apps`
  - Subpath: `vendor-portal`
  - Proxy URL: `https://YOUR-SERVER-DOMAIN/apps/vendor-portal`
- Save and copy the **App secret** (use as `SHOPIFY_APP_SECRET`).

## 4) Server deploy
- Set environment variables (see `.env.example`):
  - SHOPIFY_SHOP=<your-shop>.myshopify.com
  - SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
  - SHOPIFY_APP_SECRET=shpss_...
  - APP_PROXY_SUBPATH=vendor-portal
  - CLOUDINARY_CLOUD_NAME=...
  - CLOUDINARY_UPLOAD_PRESET=seller_uploads_unsigned
  - CLOUDINARY_FOLDER=seller-uploads (optional)
- Run:
  ```bash
  npm install
  npm start
  ```
  Deploy to your preferred Node host (Render/Railway/Fly/EC2/Replit).

## 5) Theme setup
- Upload `theme/assets/vendor-dashboard.js` to **Assets** in your theme.
- Create/add `templates/page.vendor-dashboard.liquid` in your theme.
- Create a page "Vendor Dashboard" and assign this template.
- Link it from your header/account menu.

## How it works
- The page fetches Cloudinary config from `/apps/vendor-portal/presign` (no secrets).
- Browser posts file(s) to `https://api.cloudinary.com/v1_1/<cloud_name>/auto/upload` with `upload_preset`.
- Submit sends product details + Cloudinary URLs to `/apps/vendor-portal/submit`.
- The server creates a **Draft product** tagged `vendor:<customer_id>`.
- Orders view filters orders by that tag.

## Optional
- Use automated collections per seller (condition: tag equals `vendor:<id>`) to build each seller's public page.
- Add email notifications via Shopify webhooks on `orders/create`.

## Notes
- Works on **Basic** plan.
- For orders older than 60 days, consider requesting `read_all_orders`.
- Keep Admin API token & App secret private; they are only on the server.
