PokéVault Cloud — Cloudflare Pages version

SETUP OVERVIEW
1. Create a Supabase project.
2. Enable Email auth in Supabase.
3. In Supabase Authentication -> URL Configuration:
   - Site URL: your Cloudflare Pages URL
   - Add redirect URL(s): your Cloudflare Pages URL
4. Open config.js and paste your:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
5. Upload this whole folder to Cloudflare Pages.

CLOUDFLARE PAGES
- Upload the entire folder.
- The /functions folder contains Cloudflare Pages Functions for Pokémon card search and card lookup.
- No Netlify files are required.

NOTES
- Search and price refresh go through Cloudflare Pages Functions to avoid browser CORS issues.
- Login is handled by Supabase email/password.
- Collection data is stored in the browser and keyed to the signed-in user's id.
- This build intentionally avoids service-worker caching to prevent stale-update problems.

FILES
- index.html
- style.css
- app.js
- config.js
- functions/api/cards.js
- functions/api/card.js


AUTH TROUBLESHOOTING
- If you see 'Failed to fetch' on sign in or sign up, check that config.js contains your real Supabase URL and anon key.
- Make sure your Supabase project is not paused.
- In Supabase Authentication -> URL Configuration, add your Cloudflare Pages URL as the Site URL and Redirect URL.
- This build includes Create account and Reset password buttons.


VERSION 3
- Reduced Pokémon API payload size to avoid Cloudflare function 504 timeouts.
- Search now requests fewer fields and fewer results.
- Added explicit timeout handling for search and card lookup.
