# FBR Office

FBR Office is an independent MERN-stack workspace for tax and accounting firms. The current MVP provides firm registration, authentication, a firm dashboard, and role-based team management. It does not yet connect to or submit data to the FBR/IRIS portal.

## Stack

- **Client:** React, TypeScript, Vite, Tailwind CSS v4
- **API:** Node.js, Express, TypeScript
- **Database:** MongoDB via Mongoose

## Requirements

- Node.js 20+
- npm
- MongoDB 7+ (local or hosted)

## Run locally

1. Configure and start the API:

   ```sh
   cd server
   cp .env.example .env
   # Set MONGODB_URI and a random JWT_ACCESS_SECRET (at least 32 characters).
   npm install
   npm run dev
   ```

2. In another terminal, configure and start the client:

   ```sh
   cd client
   cp .env.example .env
   npm install
   npm run dev
   ```

3. Open the Vite URL (normally `http://localhost:5173`) and create a firm account.

The API listens on port `4000` by default. The client calls `http://localhost:4000/api/v1`; set `VITE_API_URL` to change that URL. Set the API's `CLIENT_ORIGIN` to the exact client origin when deploying.

## API modules

- `POST /api/v1/auth/register-firm`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`
- `GET /api/v1/firms/current`
- `GET /api/v1/team`, `POST /api/v1/team`
- `GET /api/v1/health`

The API derives firm scope from the verified access token. Team queries are scoped to that firm, and team creation requires the `user.manage` permission. Roles and permissions are enforced server-side; client-side navigation checks are only for presentation.

## Current boundaries and next steps

- Each firm is an isolated tenant. Data models for taxpayers, returns, invoices, and filings are not part of this MVP.
- FBR/IRIS integration is intentionally not represented as connected. Before implementing it, define the supported workflow, obtain official integration/API details and credentials, and document the expected filing lifecycle.
- Production deployment should use HTTPS, a managed MongoDB deployment with backups, strong unique JWT secrets, restricted CORS, and an email-based invitation/password-reset flow. The current team form sets a temporary password directly.

## Build checks

```sh
cd server && npm run typecheck
cd client && npm run build
```
