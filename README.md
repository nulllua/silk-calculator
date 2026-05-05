# Silk Calculator Workspace Layout

This workspace is organized by runtime area so files are easier to find and maintain.

## Root

- `index.html` - main site entry point
- `CNAME`, `robots.txt`, `sitemap.xml` - deployment/SEO files that must stay at root
- `backend/` - API server + admin panel
- `frontend/` - main site static assets

## Frontend

- `frontend/assets/css/` - main site styles
- `frontend/assets/js/` - main site scripts (utils, engine, app runtime, overlays)
- `frontend/assets/icons/` - item icon assets
- `frontend/assets/images/` - shared image assets (favicon, OG image, etc.)
- `frontend/pages/` - extra standalone pages

## Backend

- `backend/index.js` - API server entry point
- `backend/db.js` - database setup/helpers
- `backend/seed.js` - seed script
- `backend/services/` - backend service modules (Discord integration, etc.)

## Admin Panel

- `backend/admin/index.html` - admin panel entry page
- `backend/admin/assets/css/` - admin styles
- `backend/admin/assets/js/` - admin scripts split by feature

## Notes

- Keep deploy-critical root files (`index.html`, `CNAME`, `robots.txt`, `sitemap.xml`) at the repository root.
- Add new frontend assets under `frontend/assets/...`.
- Add new backend helpers under `backend/services/`.
