# SkyBlock Bazaar price history

Records Hypixel SkyBlock Bazaar prices every hour with GitHub Actions (free for public repositories),
so the Bazaar Flip Scanner has a full 7 days of price history even when your PC is off.

Only public Bazaar prices are stored. The scanner itself is **not** part of this repository.

## What's in here

| File | What it does |
|---|---|
| `record.mjs` | Fetches Bazaar prices (4 samples, averaged) and adds this hour to the history |
| `.github/workflows/record.yml` | Runs `record.mjs` every hour on GitHub's servers |
| `data` branch → `bazaar-history.json` | The history itself (created by the first run, replaced each hour so the repo stays small) |

## Setup (about 5 minutes, all on github.com)

1. **Create the repository**: on github.com click **+ → New repository**.
   Name it e.g. `skyblock-history`, choose **Public**, leave everything else unticked, click **Create repository**.
2. **Upload the files**: on the new repo's page click **uploading an existing file**.
   Open this folder in File Explorer and drag **both** `record.mjs` **and the `.github` folder** into the browser.
   (Can't see `.github`? In File Explorer turn on **View → Show → Hidden items**.)
   Click **Commit changes**.
   - Check: the repo should now show `record.mjs` and a `.github` folder. If the `.github` folder is missing, click
     **Add file → Create new file**, type `.github/workflows/record.yml` as the name, paste in the contents of
     `record.yml` from this folder, and commit.
3. **Run it once**: open the **Actions** tab. If asked, click **I understand my workflows, go ahead and enable them**.
   Click **Record Bazaar prices** on the left → **Run workflow** → **Run workflow**.
   It takes about 4 minutes and should finish with a green tick.
4. **Connect the scanner**: open `bazaar-flipper.html`, and in **History repo (GitHub)** type
   `yourname/skyblock-history` (your GitHub username / the repo name). It should say **✓ 1h from GitHub**.

From then on it records one hour of prices every hour, automatically.
After 6 hours the scanner's **Dips** tab and **vs usual** column work; after 7 days you have a full week.

## Good to know

- GitHub's scheduler can start runs a few minutes late, and very occasionally skips one. A missing hour doesn't matter.
- GitHub pauses scheduled workflows in public repos after 60 days without activity. If the history ever stops updating,
  open **Actions → Record Bazaar prices** and click **Enable workflow**.
- Anyone else using the scanner can type the same `yourname/skyblock-history` to use your recorded history.
- To stop recording: **Actions → Record Bazaar prices → ⋯ → Disable workflow**, or delete the repository.
