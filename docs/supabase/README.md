## Supabase Setup

Project URL:

- `https://zkoxbykmhtyfkeztkwhb.supabase.co`

### 1) Create tables + policies

1. Open Supabase Dashboard → SQL Editor
2. Paste and run: `docs/supabase/schema.sql`

### 2) Seed agents

Insert a few default agents into `public.agents` (via SQL Editor) or add them manually via the dashboard.

### 3) Configure environment variables

API (`apps/api/.env`):

- `DATABASE_PROVIDER=supabase`
- `SUPABASE_URL=https://zkoxbykmhtyfkeztkwhb.supabase.co`
- `SUPABASE_ANON_KEY=...`

Web (`apps/web/.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL=https://zkoxbykmhtyfkeztkwhb.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`

### 4) Auth notes

- The web app signs in via Supabase Auth and stores an access token locally.
- The web app sends `Authorization: Bearer <token>` to the Flask API.
- The Flask API validates the token by calling Supabase `GET /auth/v1/user`, then uses PostgREST with the same token so RLS applies.

