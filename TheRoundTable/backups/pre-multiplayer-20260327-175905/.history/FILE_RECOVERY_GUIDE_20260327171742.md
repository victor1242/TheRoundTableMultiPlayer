# File Recovery Guide

## Quick Reference: If You Delete a File

### **FASTEST (0-5 seconds) - VS Code Timeline**
1. Right-click the file in Explorer
2. Select **"Open Timeline"** (bottom of context menu)
3. Scroll through versions with timestamps
4. Click a version to preview it
5. Right-click the version → **"Restore this version"**

✅ **Best for:** Recent accidental deletions (works for hours/days of changes)
✅ **Requires:** Nothing, built into VS Code

---

### **QUICK (5-10 seconds) - Compare with Saved**
1. Right-click the file
2. Select **"Compare with Saved"** (if it shows diff options)
3. View the changes side-by-side
4. Manually copy back deleted sections if needed

✅ **Best for:** Viewing what changed recently
✅ **Requires:** File hasn't been hard-deleted

---

### **RELIABLE (30 seconds) - Git History**
If you've committed to GitHub:

```powershell
# See file history
git log --oneline -- path/to/file.js

# View a specific commit's version
git show <commit-hash>:path/to/file.js

# Restore entire file from a commit
git checkout <commit-hash> -- path/to/file.js
```

✅ **Best for:** Finding deleted functions from commits
✅ **Requires:** Git repository and past commits

---

### **FALLBACK - VS Code History Directory**
If Timeline is empty:

```powershell
# List all backups for a file
Get-ChildItem d:\5Crowns\.history -Filter "*filename*" | Sort-Object LastWriteTime

# Read a specific backup
Get-Content d:\5Crowns\.history\filename_<timestamp>.js
```

✅ **Best for:** Deep recovery when Timeline fails
✅ **Requires:** `.history` folder (usually exists by default)
❌ **Note:** Hidden folder, may need to enable visibility

---

## Best Practices Going Forward

### Enable Auto-Save
- `File` → `Auto Save`
- Creates more Timeline snapshots automatically

### Commit Frequently
```powershell
git add .
git commit -m "Feature: description of change"
```

### Install Git Lens (Optional)
- VS Code Extension: Better git history visualization
- Hover over lines to see who changed them and when

### Before Major Changes
```powershell
# Create a backup branch
git branch backup-before-refactor
git commit -m "Checkpoint before major refactor"
```

---

## Example: Restore storeGameState Function (What We Just Did)

1. Searched `.history` folder for backups with grep
2. Found `functions_20260320183915.js`
3. Read the function definition from that backup
4. Added it back to `functions.js`

**Instead, could have done:** Right-click `functions.js` → Open Timeline → Found and restored directly

---

## Recovery Order (Try in This Order)

| Priority | Method | Speed | Success Rate |
|----------|--------|-------|--------------|
| 1 | VS Code Timeline | Fast | ⭐⭐⭐⭐⭐ |
| 2 | Git History | Medium | ⭐⭐⭐⭐⭐ |
| 3 | .history Folder | Slow | ⭐⭐⭐⭐ |
| 4 | Recuva/System Recovery | Vary | ⭐⭐⭐ |

---

## Important Notes

- **Act fast** — Don't reload files or make new changes after deletion
- **Timeline requires no action** — It auto-captures changes
- **Git is safer than Timeline** — Committed changes are permanent
- **Don't delete .history folder** — It's your lifeline for accidental deletes

---

Last Updated: March 27, 2026
