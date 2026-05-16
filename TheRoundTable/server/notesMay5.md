I’m verifying what the live multiplayer page actually loads so we only delete files that are truly not in use, then I’ll remove only zero-risk duplicates.

Searched for regex `<script[^>]*src=` (`**/TheRoundTable/multiplayer.html`), 2 results

Searched for text `script.js` (`**/*.html`), no results

Searched for text `scriptchk.js` (`**/*.html`), no results

I’m double-checking with ripgrep directly so we can confirm whether script.js is truly unreferenced before deleting any copy.

Ran terminal command: rg -n "script\.js|scriptchk\.js" -g "*.html"
Completed with input: rg -n "script\.js|scriptchk\.js" -g "*.html"

Ran terminal command: Get-ChildItem -Recurse -Filter *.html | Select-String -Pattern 'script.js|scriptchk.js' | ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }

No HTML references exist. I’ll do one more global reference check (excluding heavy folders) and then remove the first zero-risk duplicate set.

Ran terminal command: Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.history\\|\\backups\' } | Select-String -Pattern 'script.js|scriptchk.js' | ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }

I found one truly zero-risk duplicate to remove immediately: script.js is byte-identical to root script.js and not referenced by any HTML, so I’m deleting just that one as Phase 1.

Generating patch (3 lines) in [](file:///d%3A/TheRoundTableMultiPlayerNEW/TheRoundTable/script.js)

Searched for text `style2.css` (`**/TheRoundTable/*.html`), no results

Searched for text `style.css` (`**/TheRoundTable/*.html`), 3 results

Searched for text `aiMeldPlanner.js` (`**/TheRoundTable/*.html`), 3 results

Searched for text `classes.js` (`**/TheRoundTable/*.html`), 2 results

I confirmed TheRoundTable HTML does not reference style2.css, so I’m removing that identical duplicate as another low-risk cleanup item.

Generating patch (3 lines) in [](file:///d%3A/TheRoundTableMultiPlayerNEW/TheRoundTable/style2.css)

Cleanup phase has started with two low-risk duplicate removals completed. I’ll run a quick runtime smoke check now to make sure multiplayer service is still healthy.

Ran terminal command: try { (Invoke-WebRequest -UseBasicParsing http://localhost:3001/health).StatusCode } catch { $_.Exception.Message }

Ran terminal command: try { (Invoke-WebRequest -UseBasicParsing http://localhost:3001/multiplayer.html).StatusCode } catch { $_.Exception.Message }

I’m generating an updated duplicate status snapshot after the removals so you get an exact keep/delete map for what remains.

Ran terminal command: $pairs = @('index.html','main.js','functions.js','AI.js','aiMeldPlanner.js','classes.js','script.js','style.css','style2.css','multiplayer.html','server/index.js','server/rooms/roomManager.js','server/engine/gameEngine.js'); foreach($p in $pairs){ $a = Join-Path $PWD $p; $b = Join-Path $PWD (Join-Path 'TheRoundTable' $p); if((Test-Path $a) -and (Test-Path $b)){ $ha=(Get-FileHash $a -Algorithm SHA256).Hash; $hb=(Get-FileHash $b -Algorithm SHA256).Hash; $status = if($ha -eq $hb){'IDENTICAL'} else {'DIFFERENT'}; Write-Output ("{0}`t{1}" -f $status, $p) } elseif((Test-Path $a) -and -not (Test-Path $b)) { Write-Output ("ONLY_ROOT`t{0}" -f $p) } elseif(-not (Test-Path $a) -and (Test-Path $b)) { Write-Output ("ONLY_SUBFOLDER`t{0}" -f $p) } else { Write-Output ("MISSING_BOTH`t{0}" -f $p) }}

Phase 1 is in progress and working.

I already did two zero-risk removals in the legacy TheRoundTable subtree:
1. Removed one unreferenced duplicate JS file
2. Removed one unreferenced duplicate CSS file

Then I smoke-tested runtime:
1. Health check on port 3001 returned 200
2. Multiplayer page on port 3001 returned 200

Current active entry points are still:
1. package.json starts the backend at index.js
2. debug-server.js serves the root workspace

Updated duplicate map (after removals):

- Different, keep for now:
1. index.html and index.html
2. main.js and main.js
3. functions.js and functions.js
4. AI.js and AI.js
5. multiplayer.html and multiplayer.html
6. index.js and index.js
7. roomManager.js and roomManager.js

- Still identical duplicate candidates (safe next deletions if you want me to continue):
1. aiMeldPlanner.js and aiMeldPlanner.js
2. classes.js and classes.js
3. style.css and style.css

If you want, I can continue now with the next identical duplicate removals in TheRoundTable only, one file at a time with a health check after each.

You’re welcome.  
When you’re ready, I can do either of these next:

1. Build the Keep vs Archive table (no file changes).
2. Do a side-by-side diff walkthrough of the highest-impact files first:
   - index.js
   - roomManager.js
   - multiplayer.html