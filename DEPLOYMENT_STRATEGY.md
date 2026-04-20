# Deployment & Monetization Strategy
*Created: March 30, 2026*

---

## Path 1: Family & Friends (Private, Low-Cost)

**Easiest near-term option.**

- **Cloudflare Tunnel** (free) — run `cloudflared tunnel` against port 3001, get a public HTTPS URL, share it with family. No server, no cost, no router changes. Works from your home PC.
- **ngrok** (free tier) — same idea, slightly easier to start but URL changes each session unless you pay ~$8/mo for a fixed domain.
- Supports maybe 5–20 concurrent players easily on your home machine.

**Risk:** Your home IP is exposed at the tunnel provider level (not public, but Cloudflare/ngrok sees traffic). Fine for family.

---

## Path 2: Casual Public (Hosted, Low Maintenance)

If family reception is good and you want a stable URL without your PC always running:

| Service | Free Tier | Cost to Scale | Notes |
|---|---|---|---|
| **Railway** | $5/mo credit | ~$5–15/mo | Easy Node.js deploy, persistent |
| **Render** | Free (sleeps) | ~$7/mo for always-on | Sleeps after inactivity — bad for games |
| **Fly.io** | 3 small VMs free | ~$5–10/mo | Good for Socket.IO, stays alive |
| **DigitalOcean** | — | $6/mo droplet | Full control, one-time setup |

Socket.IO with a few concurrent users is very lightweight — $5–10/mo is realistic.

**Revenue potential at small scale:** Very limited. Ad revenue on a card game with dozens of users is pennies. Subscriptions require payment infrastructure (Stripe), user accounts, legal terms, GDPR compliance — significant overhead before any dollar comes in.

---

## Path 3: License or Sell

| Option | Description | Realistic Value |
|---|---|---|
| **License to a platform** | Pogo, GamePigeon, Tabletopia, Board Game Arena — they handle hosting/billing, you get royalties | Requires proven original IP (hence rename discussion) |
| **BGA submission** | Board Game Arena accepts independent developer submissions | Best route if you want reach without overhead |
| **Sell codebase outright** | Via Flippa or direct outreach | $500–$5k without proven audience |
| **Open source + donate** | Low admin burden, builds goodwill | Minimal revenue |

---

## Recommended Sequence

1. **Now:** Set up Cloudflare Tunnel → play with family → validate the concept
2. **If well-received:** Deploy to Railway or Fly.io (~$5–10/mo), get a fixed domain
3. **If traction builds:** Formalize the rename ("The RoundTable"), add user accounts + progression tracking, then evaluate BGA submission or self-monetization
4. **Legal checkpoint before any public release:** USPTO search on the name, review Five Crowns trademark scope

---

## Key Insight: The Administrative Gap

The jump from "family game" to "public product" is mostly **administrative**, not technical:
- Privacy policy & Terms of Service
- Payment rails (Stripe integration)
- GDPR / data compliance
- User support burden
- App store / platform fees (if mobile)

The code changes to support more users are relatively minor by comparison. Worth being clear-eyed that the **licensing/sale path only has real value once you have a demonstrated user base.**

---

## Related Background (from earlier sessions)

- **Current game name concern:** "Five Crowns" is a trademarked product by SET Enterprises. Game mechanics are not copyrightable, but the name, artwork, and rulebook text are protected.
- **Proposed rename:** "The RoundTable" — Arthurian theme, distinct brand, room for lore/progression system.
- **Player progression design:** Serf → Peasant → Squire → Man-at-Arms → Knight → Banneret → Baron → Lord → High Lord → Roundtable Champion (Renown point ladder).
- **Internet play (current):** Cloudflare Tunnel or ngrok — no router changes needed, works over any internet connection.

---

## Research Links

- Cloudflare Tunnel (free): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- ngrok: https://ngrok.com/
- Railway: https://railway.app/
- Fly.io: https://fly.io/
- Board Game Arena developer submissions: https://boardgamearena.com/develop
- Tabletopia publisher program: https://tabletopia.com/
- USPTO trademark search: https://tmsearch.uspto.gov/
