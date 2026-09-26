# Deploying

The order matters: the database first, then the backend, then the frontend.

## 1. Supabase (database)
1. Create a project at supabase.com.
2. SQL Editor → New query → paste `supabase/schema.sql` → Run.
3. Project Settings → API: copy the **Project URL** and the **service_role** key.

## 2. Railway (backend)
1. New Project → Deploy from GitHub repo → pick this repo.
2. Settings → **Root Directory**: `backend`.
3. Variables:
   - `SUPABASE_URL` = Project URL from step 1
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key from step 1
   - `CORS_ORIGINS` = your Vercel URL (e.g. `https://yoursite.vercel.app`); add the custom domain later, comma-separated
4. Settings → Networking → **Generate Domain**. Open `https://<that-domain>/health`; it should show `"db": true`.

## 3. Vercel (frontend)
1. Add New → Project → import this repo.
2. **Root Directory**: `frontend` (Framework preset: Vite).
3. Environment variable `VITE_API_URL` = the Railway domain from step 2 (no trailing slash).
4. Deploy. Then update `CORS_ORIGINS` on Railway if the Vercel URL differs.

## Local development
```
cd backend && cp .env.example .env && npm install && npm run dev
cd frontend && cp .env.example .env && npm install && npm run dev
```
