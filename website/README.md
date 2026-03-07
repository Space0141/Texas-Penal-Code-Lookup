# Website Build (GitHub Pages)

This folder is a standalone web version of Texas Penal Code Lookup.

## Deploy on GitHub Pages

1. Push this repo to GitHub.
2. In repo settings, open **Pages**.
3. Set **Build and deployment** source to **Deploy from a branch**.
4. Select your branch (for example `main`) and folder **/website**.
5. Save.

GitHub Pages will publish `website/index.html`.

## Notes

- Data file is included at `website/data/texas_penal_codes.full.json`.
- Extra keyword aliases are in `website/data/keyword_aliases.json`.
- Includes Transportation Code speeding/reckless entries in the UI search.