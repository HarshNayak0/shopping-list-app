# Shopping List

A shared shopping list that sorts items by the best store to buy them at (e.g. Dollarama, No Frills, Costco). Built for 2 collaborators who see each other's edits live.

## Features (current)

- Magic-link login (no passwords)
- Households shared by an invite code (2+ people)
- User-defined stores (name + color, reorderable)
- Multiple lists per household
- Add items with quantity/notes, assign to a store manually or via **auto-suggest** (learns from what store you've picked for that item name before)
- Live sync between collaborators (Supabase Realtime)
- Check off items, clear checked items
- Installable as a PWA (Add to Home Screen)
- Dark mode (follows system)

## Not built yet (good next steps)

- Price tracking per store / running budget total
- Aisle-order sorting within a store
- Barcode scanning to add items
- Offline caching (currently requires a connection; installable but not offline-first)

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), create a free project.
2. In the SQL editor, paste and run [`supabase/schema.sql`](supabase/schema.sql). This creates all tables, the auto-suggest function, and row-level security policies.
3. In **Authentication > Providers**, make sure **Email** is enabled. In **Authentication > Email Templates**, the default "Magic Link" template works as-is.
4. In **Authentication > URL Configuration**, add your dev URL (`http://localhost:3000/auth/callback`) and your production URL once deployed, to **Redirect URLs**.
5. In **Project Settings > API**, copy the **Project URL** and **anon public** key.

## 2. Configure the app

Copy the example env file and fill in your Supabase values:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with your email (you'll get a magic link), create a household, add a few stores, then share the invite code with the second person so they can join the same household from their own device.

> Note: this project was scaffolded on Node 18.18. Tailwind v4 and a couple of dev-tooling packages prefer Node 20+ and print `EBADENGINE` warnings on install — they're harmless, but if `npm install` ever fails to pull in `@tailwindcss/oxide-win32-x64-msvc` (breaks `npm run build`), run `npm install @tailwindcss/oxide-win32-x64-msvc` manually, or upgrade to Node 20+.

## 4. Deploy

Any Next.js host works (e.g. Vercel: import the repo, add the two env vars above in Project Settings, deploy). Remember to add the deployed URL to Supabase's Redirect URLs list.
