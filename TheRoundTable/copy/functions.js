// Utility and helper functions for TheRoundTabledataArray

 function getRandomAndroidIdentity() {
    const pool = window.ANDROID_IDENTITIES || { robots: [], aliens: [] };
    const all = [...(pool.robots || []), ...(pool.aliens || [])];
    if (!all.length) return `Android-${Math.floor(1000 + Math.random() * 9000)}`;
    return all[Math.floor(Math.random() * all.length)];
  }

 // const { StrictMode } = require("react");
// ** Player progression design:** 
const playerLevels = ['Serf', 'Peasant', 'Squire', 'Man-at-Arms', 'Knight', 'Banneret', 'Baron', 'Lord', 'High Lord', 'Roundtable Champion']; 

function getPlayerLevel(level) {
  return playerLevels[level] || "Unknown";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRoomTierSkillMultiplier() {
  const tiers = (typeof ROOM_TIERS !== "undefined" ? ROOM_TIERS : window.ROOM_TIERS) || {};
  const tier = tiers[game.roomTier] || {};
  const multiplier = Number(tier.skillMultiplier);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

function isWildCard(card, wildRank) {
  if (!card) return false;
  return card.rank === "jester" || String(card.rank) === String(wildRank);
}

function rankToValue(rank) {
  if (rank === "jack") return 11;
  if (rank === "queen") return 12;
  if (rank === "king") return 13;
  return Number(rank);
}

function getPureMeldStats(meldSets, wildRank) {
  const stats = {
    pureSets: 0,
    pureRuns: 0,
    longestPureSet: 0,
    longestPureRun: 0,
  };

  if (!Array.isArray(meldSets)) return stats;

  meldSets.forEach((set) => {
    if (!Array.isArray(set) || set.length < 3) return;
    if (set.some((card) => isWildCard(card, wildRank))) return;

    const ranks = set.map((card) => String(card.rank));
    const suits = set.map((card) => String(card.suit));
    const uniqueRanks = new Set(ranks);
    const uniqueSuits = new Set(suits);

    // Pure set: same rank with unique suits.
    if (uniqueRanks.size === 1 && uniqueSuits.size === set.length) {
      stats.pureSets += 1;
      stats.longestPureSet = Math.max(stats.longestPureSet, set.length);
      return;
    }

    // Pure run: same suit and strictly consecutive unique ranks.
    if (uniqueSuits.size === 1 && uniqueRanks.size === set.length) {
      const sorted = ranks.map(rankToValue).sort((a, b) => a - b);
      const isConsecutive = sorted.every((value, idx) => idx === 0 || value === sorted[idx - 1] + 1);
      if (isConsecutive) {
        stats.pureRuns += 1;
        stats.longestPureRun = Math.max(stats.longestPureRun, set.length);
      }
    }
  });

  return stats;
}

function turnOnMelding() {
  // turn on melding
  changeMeldColor("blue")
  game.currentPlayer.melding = true;
  game.currentPlayer.meldCount = 0;
  game.currentPlayer.meldGroup = 0;
} 

function hasPlayerDrawnThisTurn(player = game.currentPlayer) {
  if (!player) return false;
  const meldedCount = getMeldedCardCount(player);
  return (player.hand.length + meldedCount) > game.cardsDealt;
}

function requireDrawBeforeAction(actionLabel = "that action") {
  if (hasPlayerDrawnThisTurn(game.currentPlayer)) return true;
  const msg = `Draw a card before ${actionLabel}.`;
  if (game.optPrompts) updatePlayerPrompt(msg);
  else showMessage(msg);
  return false;
}

function getRoundRankMap(players) {
  const scored = players
    .map((player, index) => ({ index, score: Number(player?.roundScore ?? 0) }))
    .sort((a, b) => a.score - b.score);

  const rankMap = new Map();
  let previousScore = null;
  let rank = 0;
  scored.forEach((entry, position) => {
    if (previousScore === null || entry.score !== previousScore) {
      rank = position + 1;
      previousScore = entry.score;
    }
    rankMap.set(entry.index, rank);
  });
  return rankMap;
}

function calculateLevelFromProgress(experience, skillPoints) {
  const progressScore = Number(experience || 0) + (Number(skillPoints || 0) * 2);
  const thresholds = [0, 100, 250, 500, 850, 1300, 1900, 2600, 3400, 4300];
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (progressScore >= thresholds[i]) level = i;
  }
  return Math.max(0, Math.min(level, playerLevels.length - 1));
}

function getOrCreateGamePlayerProfile(profileMap, player) {
  let profile = profileMap.get(player.id);
  if (!profile) {
    profile = {
      id: player.id,
      name: player.name,
      nickname: player.name,
      lastGameId: null,
      gamesPlayed: 0,
      gamesPlayedMoreThanTwoPlayers: 0,
      gamesWon: 0,
      gamesLost: 0,
      gamesCompleted: 0,
      level: 0,
      experience: 0,
      skills: [],
      skillLevel: 0,
      progressionHistory: [],
    };
    profileMap.set(player.id, profile);
  }
  profile.name = player.name;
  if (!profile.nickname) profile.nickname = player.name;
  if (!Array.isArray(profile.progressionHistory)) profile.progressionHistory = [];
  return profile;
}

function appendProfileProgressSnapshot(profile, snapshot) {
  if (!profile) return;
  if (!Array.isArray(profile.progressionHistory)) profile.progressionHistory = [];

  const history = profile.progressionHistory.filter((entry) => entry && typeof entry === "object");
  const snapshotKey = `${snapshot.gameId || ""}:${snapshot.round || ""}`;
  const existingIdx = history.findIndex((entry) => `${entry.gameId || ""}:${entry.round || ""}` === snapshotKey);

  if (existingIdx >= 0) history[existingIdx] = snapshot;
  else history.push(snapshot);

  profile.progressionHistory = history.slice(-40);
}

function applyRoundProgression(players, wildRank) {
  if (typeof window === "undefined" || !window.GamePlayerStore) {
    return new Map();
  }

  const existingProfiles = window.GamePlayerStore.load();
  const profileMap = new Map(existingProfiles.map((p) => [p.id, p]));
  const rankMap = getRoundRankMap(players);
  const skillMultiplier = getRoomTierSkillMultiplier();
  const noAssistMode = !game.optDrawHint
    && !game.optDiscardHint
    && !game.optMeldHint
    && !game.warnWildDiscard
    && !game.warnWildPickup
    && !game.warnWildDiscardLastTurn;

  const resultByPlayerId = new Map();

  players.forEach((player, index) => {
    const profile = getOrCreateGamePlayerProfile(profileMap, player);
    const roundRank = rankMap.get(index) || players.length;
    const meldStats = getPureMeldStats(player.meldSets, wildRank);

    const rankSkillBonus = roundRank === 1 ? 8 : roundRank === 2 ? 4 : roundRank === 3 ? 2 : 0;
    const pureSetBonus = (meldStats.pureSets * 2) + Math.max(0, meldStats.longestPureSet - 3);
    const pureRunBonus = (meldStats.pureRuns * 3) + Math.max(0, meldStats.longestPureRun - 3);
    const wentOutBonus = player.IsOut ? 4 : 0;
    const noAssistBonus = noAssistMode ? 5 : 0;

    const rawSkillPoints = rankSkillBonus + pureSetBonus + pureRunBonus + wentOutBonus + noAssistBonus;
    const spGain = Math.round(rawSkillPoints * skillMultiplier);

    let xpGain = 2; // participation
    if (players.length > 2) xpGain += 1;
    if (player.IsOut) xpGain += 3;
    if (roundRank === 1) xpGain += 2;

    // Game-level counters: increment once at start and once at completion.
    if (game.roundNumber === 1) {
      profile.gamesPlayed += 1;
      if (players.length > 2) profile.gamesPlayedMoreThanTwoPlayers += 1;
    }

    profile.lastGameId = getCurrentGameId() || profile.lastGameId;
    profile.experience = Number(profile.experience || 0) + xpGain;
    profile.skillLevel = Number(profile.skillLevel || 0) + spGain;
    profile.level = calculateLevelFromProgress(profile.experience, profile.skillLevel);
    appendProfileProgressSnapshot(profile, {
      timestamp: new Date().toISOString(),
      gameId: profile.lastGameId,
      round: game.roundNumber,
      roomTier: game.roomTier,
      roundRank,
      xpGain,
      spGain,
      level: profile.level,
      experience: profile.experience,
      skillLevel: profile.skillLevel,
      pureSets: meldStats.pureSets,
      pureRuns: meldStats.pureRuns,
      wentOut: Boolean(player.IsOut)
    });

    // Keep runtime player object synced for immediate UI badge updates.
    player.experience = profile.experience;
    player.skillLevel = profile.skillLevel;
    player.level = profile.level;
    player.lastProgressBreakdown = {
      round: game.roundNumber,
      rankSkillBonus,
      pureSetBonus,
      pureRunBonus,
      wentOutBonus,
      noAssistBonus,
      rawSkillPoints,
      multiplier: skillMultiplier,
      xpGain,
      spGain,
      pureSets: meldStats.pureSets,
      pureRuns: meldStats.pureRuns,
    };

    resultByPlayerId.set(player.id, {
      xpGain,
      spGain,
      level: profile.level,
      rankName: getPlayerLevel(profile.level),
      experience: profile.experience,
      skillLevel: profile.skillLevel,
      pureSets: meldStats.pureSets,
      pureRuns: meldStats.pureRuns,
    });
  });

  if (game.roundNumber === game.lastRound) {
    const finalRankByPlayer = getRoundRankMap(
      players.map((p) => ({ roundScore: Number(p?.gameScore ?? 0) })),
    );
    players.forEach((player, index) => {
      const profile = profileMap.get(player.id);
      if (!profile) return;
      profile.gamesCompleted += 1;
      if ((finalRankByPlayer.get(index) || players.length) === 1) profile.gamesWon += 1;
      else profile.gamesLost += 1;
    });
  }

  window.GamePlayerStore.save(Array.from(profileMap.values()));
  return resultByPlayerId;
}

function getPlayerRankBadgeMarkup(player) {
  const level = Number(player?.level ?? 0);
  const rankName = getPlayerLevel(level);
  const xp = Number(player?.experience ?? 0);
  const sp = Number(player?.skillLevel ?? 0);
  return `<span class="player-rank-badge" title="XP: ${xp} | SP: ${sp}">${escapeHtml(rankName)}</span>`;
}

function syncRuntimePlayerProgressFromStore(player) {
  if (!player || typeof window === "undefined" || !window.GamePlayerStore) return;
  const profiles = window.GamePlayerStore.load();
  const profile = profiles.find((p) => p && p.id === player.id);
  if (!profile) return;
  player.experience = Number(profile.experience ?? player.experience ?? 0);
  player.skillLevel = Number(profile.skillLevel ?? player.skillLevel ?? 0);
  player.level = Number(profile.level ?? player.level ?? 0);
}

function renderProgressionDebugPanel() {
  const host = document.getElementById("progression-debug-content");
  if (!host) return;

  const rows = Array.isArray(game.players) ? game.players : [];
  if (!rows.length) {
    host.innerHTML = "<div class=\"progression-debug-empty\">No players loaded.</div>";
    return;
  }

  host.innerHTML = rows.map((p) => {
    const xp = Number(p?.experience ?? 0);
    const sp = Number(p?.skillLevel ?? 0);
    const level = Number(p?.level ?? 0);
    const rankName = getPlayerLevel(level);
    const b = p?.lastProgressBreakdown;
    const breakdown = b
      ? `R${b.round} | XP +${b.xpGain} | SP +${b.spGain} = (${b.rankSkillBonus}+${b.pureSetBonus}+${b.pureRunBonus}+${b.wentOutBonus}+${b.noAssistBonus}) x ${b.multiplier}`
      : "No round progression yet";

    return `
      <div class="progression-player-row">
        <div class="progression-player-head">${escapeHtml(p.name)} <span class="progression-rank-inline">${escapeHtml(rankName)}</span></div>
        <div class="progression-player-stats">Level ${level} | XP ${xp} | SP ${sp}</div>
        <div class="progression-player-breakdown">${escapeHtml(breakdown)}</div>
      </div>
    `;
  }).join("");
}

function getProgressionDebugText() {
  const gameId = getCurrentGameId() || "(not set)";
  const room = game.roomTier || "beginners_hall";
  const header = `The Round Table Progression Breakdown\nGame ID: ${gameId}\nRoom: ${room}\n`;

  const lines = [header];
  (Array.isArray(game.players) ? game.players : []).forEach((p) => {
    const level = Number(p?.level ?? 0);
    const rankName = getPlayerLevel(level);
    const xp = Number(p?.experience ?? 0);
    const sp = Number(p?.skillLevel ?? 0);
    const b = p?.lastProgressBreakdown;

    lines.push(`${p?.name || "Unknown"} | Rank: ${rankName} | Level: ${level} | XP: ${xp} | SP: ${sp}`);
    if (b) {
      lines.push(`  Round ${b.round}: XP +${b.xpGain}, SP +${b.spGain}`);
      lines.push(`  SP formula: (${b.rankSkillBonus}+${b.pureSetBonus}+${b.pureRunBonus}+${b.wentOutBonus}+${b.noAssistBonus}) x ${b.multiplier} = ${b.spGain}`);
      lines.push(`  Pure melds: sets=${b.pureSets}, runs=${b.pureRuns}`);
    } else {
      lines.push("  No round progression recorded yet.");
    }
    lines.push("");
  });

  return lines.join("\n");
}

async function copyProgressionDebugText() {
  const statusEl = document.getElementById("progression-debug-copy-status");
  const text = getProgressionDebugText();

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    if (statusEl) statusEl.textContent = "Copied";
  } catch (err) {
    console.warn("[copyProgressionDebugText] Copy failed:", err);
    if (statusEl) statusEl.textContent = "Copy failed";
    return;
  }

  if (statusEl) {
    window.setTimeout(() => {
      if (statusEl.textContent === "Copied") statusEl.textContent = "";
    }, 2000);
  }
}

function downloadProgressionDebugText() {
  const statusEl = document.getElementById("progression-debug-copy-status");
  const text = getProgressionDebugText();
  const gameId = (getCurrentGameId() || "no-game-id").replaceAll(":", "-").replaceAll(" ", "_");
  const fileName = `progression-breakdown-${gameId}.txt`;

  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (statusEl) statusEl.textContent = "Downloaded";
  } catch (err) {
    console.warn("[downloadProgressionDebugText] Download failed:", err);
    if (statusEl) statusEl.textContent = "Download failed";
    return;
  }

  if (statusEl) {
    window.setTimeout(() => {
      if (statusEl.textContent === "Downloaded") statusEl.textContent = "";
    }, 2000);
  }
}

function getMeldValue(meldSets) {
  let totalMeldSkill = 0;
  meldSets.forEach((set) => {
    const cards = Array.isArray(set) ? set : [set];
    let meldLength = 0;
    cards.forEach((card) => {
      if (!card) return;
      if (card.rank === "jester") return;
      else if (card.value === game.roundNumber + 2) return;
      else meldLength += 1;
    });
    totalMeldSkill += meldLength;
  });
  return totalMeldSkill * game.roundNumber;
}

function logInPlayers() {
  if (game.players.length >= 3) return; // Players already logged in
  game.addPlayer("p1", "Victor");
  game.addPlayer("p2", "Alice");
  game.addPlayer("p3", "Bob");

  const player1name = document.getElementById("player1name");
  if (player1name) player1name.textContent = "Victor";

  const player2name = document.getElementById("player2name");
  if (player2name) player2name.textContent = "Alice";

  const player3name = document.getElementById("player3name");
  if (player3name) player3name.textContent = "Bob";

  updateAllPlayerProfileLinks();
}

function getPlayerProfileEditorUrl(player) {
  const params = new URLSearchParams();
  if (player?.id) params.set("playerId", player.id);
  if (player?.name) params.set("playerName", player.name);
  return `GamePlayerProfileEditor.html?${params.toString()}`;
}

function getGamePlayerProfileReportUrl(player) {
  const params = new URLSearchParams();
  if (player?.id) params.set("playerId", player.id);
  return `GamePlayerProfilesReport.html?${params.toString()}`;
}

function loadStoredGamePlayerProfile(playerId) {
  if (!playerId || typeof window === "undefined" || !window.GamePlayerStore) return null;
  const profiles = window.GamePlayerStore.load();
  return profiles.find((profile) => profile && profile.id === playerId) || null;
}

function ensurePlayerProfilePopover() {
  let popover = document.getElementById("player-profile-popover");
  if (popover) return popover;

  popover = document.createElement("div");
  popover.id = "player-profile-popover";
  popover.className = "player-profile-popover";
  document.body.appendChild(popover);
  return popover;
}

function buildPlayerProfilePopoverMarkup(player, profile) {
  const avatarMarkup = getProfileAvatarMarkup(profile, player, "player-profile-popover");

  if (!profile) {
    return `
      <div class="player-profile-popover-header">
        ${avatarMarkup}
        <div>
          <div class="player-profile-popover-title">
            <span>${escapeHtml(player?.name || player?.id || "Player")}</span>
            <span class="player-profile-popover-rank">No profile</span>
          </div>
        </div>
      </div>
      <div class="player-profile-popover-empty">No saved GamePlayer profile exists yet. Click Profile to create one.</div>
    `;
  }

  const level = Number(profile.level || player?.level || 0);
  const rankName = getPlayerLevel(level);
  const xp = Number(profile.experience || player?.experience || 0);
  const sp = Number(profile.skillLevel || player?.skillLevel || 0);
  const wins = Number(profile.gamesWon || 0);
  const losses = Number(profile.gamesLost || 0);
  const games = Number(profile.gamesPlayed || 0);

  return `
    <div class="player-profile-popover-header">
      ${avatarMarkup}
      <div>
        <div class="player-profile-popover-title">
          <span>${escapeHtml(profile.nickname || profile.name || player?.name || profile.id)}</span>
          <span class="player-profile-popover-rank">${escapeHtml(rankName)}</span>
        </div>
      </div>
    </div>
    <div class="player-profile-popover-grid">
      <div><span class="player-profile-popover-label">Level</span>${level}</div>
      <div><span class="player-profile-popover-label">Games</span>${games}</div>
      <div><span class="player-profile-popover-label">XP</span>${xp}</div>
      <div><span class="player-profile-popover-label">SP</span>${sp}</div>
      <div><span class="player-profile-popover-label">Wins</span>${wins}</div>
      <div><span class="player-profile-popover-label">Losses</span>${losses}</div>
    </div>
  `;
}

function getProfileInitials(profile, player) {
  const source = String(profile?.nickname || profile?.name || player?.name || player?.id || "?").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || source.charAt(0).toUpperCase();
}

function getProfileAvatarMarkup(profile, player, classPrefix) {
  const avatar = String(profile?.avatar || "").trim();
  if (avatar) {
    return `<img class="${classPrefix}-avatar" src="${escapeHtml(avatar)}" alt="Avatar for ${escapeHtml(profile?.name || player?.name || player?.id || "player")}">`;
  }
  return `<span class="${classPrefix}-avatar-fallback">${escapeHtml(getProfileInitials(profile, player))}</span>`;
}

function positionPlayerProfilePopover(anchorEl, popover) {
  if (!anchorEl || !popover) return;
  const rect = anchorEl.getBoundingClientRect();
  const top = window.scrollY + rect.bottom + 8;
  const left = Math.max(8, window.scrollX + rect.left - 4);
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
}

function showPlayerProfilePopover(anchorEl, player) {
  if (!anchorEl || !player) return;
  const popover = ensurePlayerProfilePopover();
  const profile = loadStoredGamePlayerProfile(player.id);
  popover.innerHTML = buildPlayerProfilePopoverMarkup(player, profile);
  positionPlayerProfilePopover(anchorEl, popover);
  popover.classList.add("visible");
}

function hidePlayerProfilePopover() {
  const popover = document.getElementById("player-profile-popover");
  if (!popover) return;
  popover.classList.remove("visible");
}

function bindPlayerProfileHover(profileLinkEl, player) {
  if (!profileLinkEl || !player) return;
  profileLinkEl.onmouseenter = () => showPlayerProfilePopover(profileLinkEl, player);
  profileLinkEl.onfocus = () => showPlayerProfilePopover(profileLinkEl, player);
  profileLinkEl.onmouseleave = hidePlayerProfilePopover;
  profileLinkEl.onblur = hidePlayerProfilePopover;
}

function syncPlayerProfileLink(player) {
  if (!player || !player.id) return;
  const suffix = String(player.id).replace(/^p/, "");
  const nameEl = document.getElementById("player" + suffix + "name");
  if (nameEl) nameEl.textContent = player.name || player.id;

  const profileLinkEl = document.getElementById("player" + suffix + "profile");
  if (!profileLinkEl) return;

  profileLinkEl.href = getPlayerProfileEditorUrl(player);
  profileLinkEl.title = `Open profile for ${player.name || player.id}`;
  profileLinkEl.setAttribute("aria-label", `Open profile for ${player.name || player.id}`);
  bindPlayerProfileHover(profileLinkEl, player);

  const reportLinkEl = document.getElementById("gamePlayerProfilesReport");
  if (reportLinkEl && game.currentPlayer && game.currentPlayer.id === player.id) {
    reportLinkEl.href = getGamePlayerProfileReportUrl(player);
  }
}

function updateAllPlayerProfileLinks() {
  if (!Array.isArray(game.players)) return;
  game.players.forEach((player) => syncPlayerProfileLink(player));
}

function getSuitIcon(suit) {
  const suitIcons = {
    stars: "★orange",
    diamonds: "♦red",
    hearts: "♥red",
    clubs: "♣black",
    spades: "♠black",
  };
  return suitIcons[suit] || "";
}

function showMessage(msg) {
  if (game.DEBUG) alert(msg);
  TRTlog(msg);
} 

function debugLog(...args) {
  if (!game.DEBUG) return;
  TRTlog("[DEBUG]", ...args);
}

function traceLog(...args) {
  if (!game.TRACE) return;
  TRTlog("[TRACE]", ...args);
}

/** Formats a single card as e.g. "5H", "JD", "QC", "Jester" */
function fmtCard(c) {
  if (!c) return "?";
  if (c.rank === "jester") return "Jester";
  const rankMap = { jack: "J", queen: "Q", king: "K" };
  const suitMap = { hearts: "H", diamonds: "D", clubs: "C", spades: "S", stars: "*" };
  const r = rankMap[c.rank] || String(c.rank).toUpperCase();
  const s = suitMap[c.suit] || (c.suit ? c.suit.charAt(0).toUpperCase() : "?");
  return r + s;
}

/** Formats an array of cards as e.g. "5H, 6H, 7H" */
function fmtCards(cards) {
  if (!Array.isArray(cards)) return "";
  return cards.map(fmtCard).join(", ");
}

function getMeldGroupColour(meldGroup) {
  const colours = [
    "",
    "6px solid blue",
    "6px solid green",
    "6px solid red",
    "6px solid purple",
    "6px solid orange",
    "6px solid teal",
  ];
  return colours[meldGroup] || colours[(meldGroup % (colours.length - 1)) + 1];
}

function getValueRank(value) {
  const Rank = [ '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King' ];
  if(value < 3 || value > 13) return '???';
  return Rank[value -3];
}

function analyzeBracketBalance(input) {
  const text = String(input ?? "");
  const openToClose = {
    "(": ")",
    "[": "]",
    "{": "}",
  };
  const closeToOpen = {
    ")": "(",
    "]": "[",
    "}": "{",
  };
  const opening = new Set(Object.keys(openToClose));
  const closing = new Set(Object.keys(closeToOpen));
  const stack = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (opening.has(ch)) {
      stack.push({ char: ch, index: i });
      continue;
    }

    if (closing.has(ch)) {
      const last = stack.pop();
      if (!last) {
        return {
          balanced: false,
          unbalanced: true,
          errorIndex: i,
          expected: null,
          actual: ch,
          message: `Unexpected closing bracket '${ch}' at index ${i}.`,
        };
      }

      const expectedClose = openToClose[last.char];
      if (expectedClose !== ch) {
        return {
          balanced: false,
          unbalanced: true,
          errorIndex: i,
          expected: expectedClose,
          actual: ch,
          message: `Mismatched bracket at index ${i}: expected '${expectedClose}' but found '${ch}'.`,
        };
      }
    }
  }

  if (stack.length > 0) {
    const lastUnclosed = stack[stack.length - 1];
    return {
      balanced: false,
      unbalanced: true,
      errorIndex: lastUnclosed.index,
      expected: openToClose[lastUnclosed.char],
      actual: null,
      message: `Unclosed opening bracket '${lastUnclosed.char}' at index ${lastUnclosed.index}.`,
    };
  }

  return {
    balanced: true,
    unbalanced: false,
    errorIndex: -1,
    expected: null,
    actual: null,
    message: "Brackets are balanced.",
  };
}

function validateBracketText(input, label = "input") {
  const result = analyzeBracketBalance(input);
  if (result.unbalanced) {
    const uiMessage = `[Bracket Validation:${label}] ${result.message}`;
    if (typeof updatePlayerPrompt === "function") {
      updatePlayerPrompt(uiMessage);
    } else {
      console.warn(uiMessage, result);
    }
  }
  return result;
}


function addEventListeners() {
  TRTlog("adding EVENT LISTENER");
  // Bind UI handlers immediately if DOM is ready, otherwise wait for DOMContentLoaded.
  const bindHandlers = () => {

    const deckEl = document.getElementById("deck-card");
    if (deckEl) deckEl.addEventListener("click", draw);

    const discardEl = document.getElementById("discard-card");
    if (discardEl) discardEl.addEventListener("click", discard);

    const meldEl = document.getElementById("meld");
    if (meldEl) meldEl.addEventListener("click", meld);

    const unMeldEl = document.getElementById("unMeld");
    if (unMeldEl) unMeldEl.addEventListener("click", unMeld);

    const nextRoundEl = document.getElementById("nextRound");
    if (nextRoundEl) nextRoundEl.addEventListener("click", nextRound);

    const testAEl = document.getElementById("testA");
    if (testAEl) testAEl.addEventListener("click", testA);

    const testBEl = document.getElementById("testB");
    if (testBEl) testBEl.addEventListener("click", testB);

    const aiStepEl = document.getElementById("ai-step") || document.getElementById("ai-Step");
    if (aiStepEl) aiStepEl.addEventListener("click", aiStep);

    const debugToggleEl = document.getElementById("debug-toggle");
    if (debugToggleEl) {
      debugToggleEl.addEventListener("change", function (event) {
        game.DEBUG = Boolean(event.target.checked);
        TRTlog("DEBUG is now", game.DEBUG ? "ON" : "OFF");
      });
    }

    const traceToggleEl = document.getElementById("trace-toggle");
    if (traceToggleEl) {
      traceToggleEl.addEventListener("change", function (event) {
        game.TRACE = Boolean(event.target.checked);
        TRTlog("TRACE is now", game.TRACE ? "ON" : "OFF");
      });
    }

    const ScoreBoardEl = document.getElementById("ScoreBoard");
    if (ScoreBoardEl) ScoreBoardEl.addEventListener("click", ScoreBoard);
    
    // Add New Game button logic
    const resumeGameBtn = document.getElementById("resumeGame");
    if (resumeGameBtn) {
      resumeGameBtn.addEventListener("click", function () {
        GameBoard();
      });
    }

    // Add New Game button logic
    const newGameBtn = document.getElementById("newGame");
    if (newGameBtn) {
      newGameBtn.addEventListener("click", function () {
        if (
            confirm("Are you sure you want to start a new game? This will erase the current progress.")
          ) {
          setCurrentGameId("");
          localStorage.removeItem("game_state");
          sessionStorage.setItem("newGameRequested", "true");
          location.reload();
        }
      });
    }
    // Add Game Option button logic
    const newGameStartBtn = document.getElementById("start-game");
    if (newGameStartBtn) {
      newGameStartBtn.addEventListener("click", function () {
        const gameStartOption = document.getElementById("game-options");
        const gameSelectedOption = gameStartOption.value;
      });
    }
    // Wire warnWild checkboxes to game state
    const warnWildDiscardEl = document.getElementById("warnWildDiscard");
    if (warnWildDiscardEl) {
      warnWildDiscardEl.checked = Boolean(game.warnWildDiscard);
      warnWildDiscardEl.addEventListener("change", (e) => { game.warnWildDiscard = e.target.checked; });
    }
    const warnWildPickupEl = document.getElementById("warnWildPickup");
    if (warnWildPickupEl) {
      warnWildPickupEl.checked = Boolean(game.warnWildPickup);
      warnWildPickupEl.addEventListener("change", (e) => { game.warnWildPickup = e.target.checked; });
    }
    const warnWildDiscardLastTurnEl = document.getElementById("warnWildDiscardLastTurn");
    if (warnWildDiscardLastTurnEl) {
      warnWildDiscardLastTurnEl.checked = Boolean(game.warnWildDiscardLastTurn);
      warnWildDiscardLastTurnEl.addEventListener("change", (e) => { game.warnWildDiscardLastTurn = e.target.checked; });
    }

    // Wire room-tier selector
    const roomTierEl = document.getElementById("room-tier");
    if (roomTierEl) {
      roomTierEl.value = game.roomTier || "beginners_hall";
      roomTierEl.addEventListener("change", (e) => { applyRoomTier(e.target.value); });
    }

    const progressionCopyBtn = document.getElementById("progression-debug-copy");
    if (progressionCopyBtn) {
      progressionCopyBtn.addEventListener("click", () => {
        copyProgressionDebugText();
      });
    }

    const progressionDownloadBtn = document.getElementById("progression-debug-download");
    if (progressionDownloadBtn) {
      progressionDownloadBtn.addEventListener("click", () => {
        downloadProgressionDebugText();
      });
    }
  };
  bindHandlers();
}

/**
 * Apply a room difficulty tier to the current game.
 * Sets all hint/warning flags on game and syncs the DOM checkboxes.
 * @param {string} tierKey - key from ROOM_TIERS
 */
function applyRoomTier(tierKey) {
  const tier = (typeof ROOM_TIERS !== "undefined" ? ROOM_TIERS : window.ROOM_TIERS)?.[tierKey];
  if (!tier) {
    console.warn(`[applyRoomTier] Unknown tier: ${tierKey}`);
    return;
  }
  game.roomTier = tierKey;
  game.optDrawHint               = tier.optDrawHint;
  game.optDiscardHint            = tier.optDiscardHint;
  game.optMeldHint               = tier.optMeldHint;
  game.optPrompts                = tier.optPrompts;
  game.warnWildDiscard           = tier.warnWildDiscard;
  game.warnWildPickup            = tier.warnWildPickup;
  game.warnWildDiscardLastTurn   = tier.warnWildDiscardLastTurn;

  // Sync DOM checkboxes
  const sync = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  sync("warnWildDiscard",          tier.warnWildDiscard);
  sync("warnWildPickup",           tier.warnWildPickup);
  sync("warnWildDiscardLastTurn",  tier.warnWildDiscardLastTurn);

  // Update selector if changed programmatically
  const roomTierEl = document.getElementById("room-tier");
  if (roomTierEl) roomTierEl.value = tierKey;

  // Update room label badge
  const roomLabelEl = document.getElementById("room-tier-label");
  if (roomLabelEl) {
    roomLabelEl.textContent = `${tier.label} (${tier.skillMultiplier}× SP)`;
  }

  TRTlog(`[applyRoomTier]: ${tier.label} | skillMultiplier: ${tier.skillMultiplier}`);
}

function  drawDiscardHint() {
  // Implement the logic for draw/discard hint
  //function shouldTakeDiscard(discardCard, hand, wildRank) {
  if (!game.optDrawHint) return;
  if (shouldTakeDiscard(game.discardPile[game.discardPile.length-1], game.currentPlayer.hand, game.roundNumber + 2)) updatePlayerPrompt("Hint: You should take the discard pile card.");
  else updatePlayerPrompt("Hint: You should draw a new card from the deck.");
}


// draw top card from the discard pile
function discard() {
  debugLog("discard clicked", {
  playerIndex: game.currentPlayerIndex,
  discardCount: game.discardPile.length,
  });
game.currentPlayer = [game.currentPlayerIndex];
updateCurrentPlayerReference();
game.currentPlayer = game.players[game.currentPlayerIndex];
if (game.currentPlayer.hand.length + game.currentPlayer.meldSets.length === game.cardsDealt + 1) {
    showMessage("you have already drawn a card this turn", game.currentPlayer.name);
    return;
  }
  if (game.discardPile.length === 0) {
    const discardCardEl = document.getElementById("discard-card");
    if (discardCardEl) discardCardEl.innerHTML = "";
    const discardCountEl = document.getElementById("discard-card");
    if (discardCountEl) discardCountEl.textContent = "0";
  } else {
    // Warn if the top discard is a wild card
    const topCard = game.discardPile[game.discardPile.length - 1];
    if (topCard && game.warnWildPickup) {
      const wildRank = String(game.roundNumber + 2);
      if (topCard.rank === 'jester' || topCard.rank === wildRank) {
        if (!confirm(`The discard is a wild card (${topCard.rank}). Pick it up?`)) return;
      }
    }
    const dcard = getDiscardCard();
   // const dcard = game.discardPile.pop();
    game.currentPlayer.hand.push(dcard);
    debugLog("discard draw result", {
      player: game.currentPlayer.name,
      card: `${dcard.rank}-${dcard.suit}`,
      handCount: game.currentPlayer.hand.length,
      discardCount: game.discardPile.length,
    });
    updateDeckAndDiscardDisplay();
  }
  renderPlayerHand(game.currentPlayer);
  if (!game.currentPlayer.aiPlayer && game.humanAutoMeldEnabled && typeof autoOptimizeHumanMelds === "function") {
    autoOptimizeHumanMelds(game.currentPlayer);
  }
  if (game.optMeldHint) {
    applyMeldingStrategy();
    applyHumanMeldSuggestions(game.currentPlayer);
  }
  discardHint();
  turnOnMelding();
}

function discardHint() {
  if (!game.optDiscardHint) return;
  if (chooseCardToDiscard(game.currentPlayer.hand,( game.roundNumber+2) , game.finalTurn)) {
    updatePlayerPrompt("Hint: You should discard " + game.currentPlayer.hand[game.currentPlayer.hand.length -1].rank + "-" + game.currentPlayer.hand[game.currentPlayer.hand.length -1].suit);
  } else {
    updatePlayerPrompt("Hint: You should discard " + game.currentPlayer.hand[0].rank + "-" + game.currentPlayer.hand[0].suit);
  }
}

function shouldTakeDiscard(discardCard, hand, wildRank) {
  if (!discardCard) return false;
}

function aiStep() {
 const aiBrakeEl = document.getElementById("ai-step") || document.getElementById("ai-Step")
 if (aiBrakeEl) aiBrakeEl.style.backgroundColor = "";
}

function aiWaitUserOk()
  {
    const aiStepEl = document.getElementById("ai-step") || document.getElementById("ai-Step");
    if (aiStepEl) aiStepEl.style.backgroundColor = "";
    return confirm("AI has completed this step. Click OK to continue.");
  }

function dealHand(player, numCards) {
  for (let i = 0; i < numCards; i++) {
    let card = game.deck.draw();
    player.hand.push(card);
    displayCard(card, player.id + "card" + (i + 1), "hand" );
  }
  renderPlayerHand(player);
}

function setPlayerDrawMode() {
    identifyCurrentPlayer("blue");
    updateCurrentPlayerReference();
  // Start of turn: player must draw before any meld/discard action.
      game.currentPlayer.melding = true;
  game.currentPlayer.meldCount = 0;
  game.currentPlayer.meldGroup = 0;
  changeMeldColor("");

    // Clear any stale meld-hint borders from the previous turn so the player
    // sees a clean hand before drawing (applyMeldingStrategy will re-run after draw)
    if (!game.currentPlayer.aiPlayer) {
        renderPlayerHand(game.currentPlayer);
    }

    // If a turn is restored mid-state (already drawn), still show visual meld suggestions.
    if (game.optMeldHint) {
      applyHumanMeldSuggestions(game.currentPlayer);
    }

    if (game.optPrompts) updatePlayerPrompt("Draw a card from the deck or discard pile.");
    drawDiscardHint();
}

function showRoundAndWilds() {
  let WildText = document.getElementById("wild-card");
  if (WildText)
    WildText.textContent =
      "Round: " + game.roundNumber + " Wild Cards: " + getValueRank(game.roundNumber + 2) + "'s and Jester''s ";
}

function showCurrentGameId() {
  const gameIdEl = document.getElementById("current-game-id");
  if (!gameIdEl) return;
  const gameId = getCurrentGameId();
  gameIdEl.textContent = `Game ID: ${gameId || "(not set)"}`;
}

function displayCardBack(cardId) {
  let cardImg = document.createElement("img");
  cardImg.alt = "Card Back";
  cardImg.width = game.cardWidth;
  cardImg.height = game.cardHeight;
  cardImg.src = "./cards/back.png";
  showMessage( cardImg.src  + cardId);
  const cardEl = document.getElementById(cardId);
  if (!cardEl) {
    console.warn(`[displayCardBack] Missing card element: ${cardId}`);
    return;
  }
  cardEl.innerHTML = "";
  cardEl.append(cardImg);
}

function refreshPlayerHands() {
  displayCardBack("deck-card");
  let discardCard;

  if (game.discardPile.length > 0) {
    discardCard = game.discardPile[0];
    displayCard(discardCard, "discard-card", "discard");
    }
  updateDisplay();
  showRoundAndWilds();
  showCurrentGameId();

  // Sync all option checkboxes and room-tier selector to restored game state
  const syncCheckbox = (id, val) => { const el = document.getElementById(id); if (el) el.checked = Boolean(val); };
  syncCheckbox("warnWildDiscard",         game.warnWildDiscard);
  syncCheckbox("warnWildPickup",          game.warnWildPickup);
  syncCheckbox("warnWildDiscardLastTurn", game.warnWildDiscardLastTurn);
  syncCheckbox("debug-toggle",            game.DEBUG);
  syncCheckbox("trace-toggle",            game.TRACE);
  const roomTierEl = document.getElementById("room-tier");
  if (roomTierEl) roomTierEl.value = game.roomTier || "beginners_hall";
  const roomLabelEl = document.getElementById("room-tier-label");
  if (roomLabelEl) {
    const _tier = (typeof ROOM_TIERS !== "undefined" ? ROOM_TIERS : window.ROOM_TIERS)?.[game.roomTier];
    if (_tier) roomLabelEl.textContent = `${_tier.label} (${_tier.skillMultiplier}× SP)`;
  }

  game.players.forEach((p) => {
    syncPlayerProfileLink(p);
    renderPlayerHand(p);
    updatePlayerReference();
  });
  updateHumanAIFlag();
}

function GameBoard() {
  reLoadGameState();
  window.location.href = "index.html";
}

function updatePlayerReference(p) {
  if (p === game.currentPlayer) {
    let PlayerArg = p.id + "name";
    let PlayerName = document.getElementById(PlayerArg);
    if (PlayerName) PlayerName.style.fontWeight = "bold";
    } 

  const el = document.getElementById("PlayerId");
  if (el) el.textContent = "Id: " + p.id;
  const el2 = document.getElementById("PlayerName");
  if (el2) el2.textContent = "Name: " + p.name;
  const el5 = document.getElementById("PlayerroundScore");
  if (el5) el5.textContent = "roundScore: " + p.roundScore;
  const el6 = document.getElementById("PlayergameScore");
  if (el6) el6.textContent = "gameScore: " + p.gameScore;
  const el7 = document.getElementById("PlayerIsOut");
  if (el7) el7.textContent = "IsOut: " + p.IsOut;
  const el8 = document.getElementById("Playermelding");
  if (el8) el8.textContent = "melding: " + p  .melding;
}

function saveScoreBoard() {
  let wildRank = game.roundNumber + 2;

  function serializeCard(card) {
    if (!card || typeof card !== "object") return card;
    return {
      rank: card.rank,
      suit: card.suit,
      suitColour: card.suitColour,
      value: card.value,
    };
  }

  function getMeldSetCardCount(player) {
    if (!Array.isArray(player?.meldSets)) return 0;
    return player.meldSets.reduce((count, set) => {
      if (!Array.isArray(set)) return count;
      return count + set.length;
    }, 0);
  }

  if (game.roundNumber === 1) game.scoreboardData = []; // Clear scoreboard data at the start of the game
  game.players.forEach((p) => {
    // Ensure gameScore is initialized
    if (p.gameScore === null || p.gameScore === undefined || isNaN(p.gameScore)) p.gameScore = 0;
      
  
    if (!p.name) p.name = getRandomAndroidIdentity();
  
    let Bonus = 0;
    p.roundScore = 0;
    if (p.IsOut && game.optGoingOutBonus){
      Bonus = -wildRank
      p.roundScore +=  Bonus;
    }
    // Calculate round score using card.value directly
    const handCards = Array.isArray(p.hand) ? p.hand : [];
    handCards.forEach((card) => {
      if (!card || !card.value) {
        console.warn(`[saveScoreBoard] Invalid card in ${p.name}'s hand:`, card);
        return;
      }
      
      if (card.rank === "jester") {
        p.roundScore += 50;
      } else if (card.value === wildRank) {
        p.roundScore += 20;
      } else {
        p.roundScore += card.value;
      }
    });
    
    p.gameScore += p.roundScore;
    // Ensure no NaN values
    if (isNaN(p.roundScore)) p.roundScore = 0;
    if (isNaN(p.gameScore)) p.gameScore = 0;
  });
  
  const progressionByPlayer = applyRoundProgression(game.players, wildRank);

  // Create round object
  const _roomTiers = (typeof ROOM_TIERS !== "undefined" ? ROOM_TIERS : window.ROOM_TIERS) || {};
  const _tier = _roomTiers[game.roomTier] || {};

  const roundObj = {
    round: game.roundNumber,
    optGoingOutBonus: Boolean(game.optGoingOutBonus),
    roomTier: applyRoomTier(game.roomTier),
 //   roomTier: game.roomTier || "beginners_hall",
    skillMultiplier: _tier.skillMultiplier ?? 1.0,
    players: game.players.map((p) => {
      const handCount = Array.isArray(p.hand) ? p.hand.length : 0;
      const meldCardCount = getMeldSetCardCount(p);
      const meldSetCount = Array.isArray(p.meldSets) ? p.meldSets.length : 0;
      const progression = progressionByPlayer.get(p.id) || {};

      return ({
        id: p.id,
        name: p.name,
        IsOut: p.IsOut,
        cards: handCount + meldCardCount,
        wentOutScore: p.wentOutScore ?? 0,
        wentOutBonus: p.IsOut && game.optGoingOutBonus ? -wildRank : 0,
        roundScore: p.roundScore ?? 0,
        gameScore: p.gameScore ?? 0,
        hand: Array.isArray(p.hand) ? p.hand.map((card) => serializeCard(card)) : [],
        handCount,
        meldSets: Array.isArray(p.meldSets)
          ? p.meldSets.map((set) => (Array.isArray(set) ? set.map((card) => serializeCard(card)) : []))
          : [],
        meldCardCount,
        melds: meldSetCount,
        experience: progression.experience ?? Number(p.experience ?? 0),
        skillLevel: progression.skillLevel ?? Number(p.skillLevel ?? 0),
        level: progression.level ?? Number(p.level ?? 0),
        rankName: progression.rankName ?? getPlayerLevel(Number(p.level ?? 0)),
        xpGain: progression.xpGain ?? 0,
        spGain: progression.spGain ?? 0,
        pureSets: progression.pureSets ?? 0,
        pureRuns: progression.pureRuns ?? 0,
      });
    }),
  };
  game.scoreboardData.push(roundObj);
    localStorage.setItem(
      getCurrentScoreboardKey(),
      JSON.stringify(game.scoreboardData),
    );
}

function ScoreBoard() {
  // Save scoreboard for the active game key and keep legacy key for compatibility.
  const scoreboardPayload = JSON.stringify(game.scoreboardData || []);
  localStorage.setItem(getCurrentScoreboardKey(), scoreboardPayload);
  localStorage.setItem("scoreboard_data", scoreboardPayload);
  window.location.href = "ScoreBoard.html";
  }

function NextRound() {
  saveScoreBoard();
  // Note: saveScoreBoard is called above for all rounds
  
  // reset blinking for players who went out in previous round
  for (let i = 0; i < game.players.length; i++) {
      PlayerHandBlinkOff("." + game.players[i].id + "card");
    
  }

  TRTlog(`[NextRound] BEFORE increment: roundNumber=${game.roundNumber}, cardsDealt=${game.cardsDealt}`);
  game.roundNumber +=  1;
  TRTlog(`[NextRound] AFTER increment: roundNumber=${game.roundNumber}, next cardsDealt will be ${game.roundNumber + 2}`);
  
  if (game.roundNumber > game.lastRound) {
    game.roundNumber = game.lastRound;
    // Game is complete - show final scores
    TRTlog("[NextRound] GAME COMPLETE - Showing final scores");
    disableAIAutoPlay();
    
    const finalScores = game.players
      .map(p => ({ 
        name: p.name, 
        score: isNaN(p.gameScore) ? 0 : (p.gameScore ?? 0) 
      }))
      .sort((a, b) => a.score - b.score);
    
    let message = "🎉 GAME COMPLETE! 🎉\n\nFinal Scores:\n";
    finalScores.forEach((player, idx) => {
      const position = idx === 0 ? "👑 WINNER" : `${idx + 1}${getOrdinalSuffix(idx + 1)} Place`;
      message += `\n${position}: ${player.name} - ${player.score} points`;
    });
    
    alert(message);
    TRTlog("[NextRound] Final scores:", finalScores);
    
    // Save final state and update directory
    storeGameState(game);
    upsertGamesDirectoryEntry();
    ScoreBoard();
    
  } else {
    TRTlog(`[NextRound] Starting round ${game.roundNumber} with ${game.roundNumber + 2} cards`);
    
    // Reset player states for new round
    game.players.forEach(p => {
      p.IsOut = false;
      p.melding = false;
      p.meldCount = 0;
      p.meldCards = [];
      p.meldSets = [];
    });
    
    dealNewRoundCards();
    showRoundAndWilds();
    game.finalTurn = false;

    // Persist the new round state so restore always returns to the current round.
    storeGameState();
    upsertGamesDirectoryEntry();

    // If current player is AI and auto-play is enabled, schedule their turn
    if (game.currentPlayer.aiPlayer && game.aiAutoPlayEnabled && !game.aiAutoPlayPaused) {
      TRTlog(`[NextRound] Scheduling AI turn for ${game.currentPlayer.name}`);
      scheduleAITurn(1000);
    }
  }
}

function renderPlayerHand(Player) {
  syncPlayerProfileLink(Player);
  // Debug logging
  TRTlog(`AI-${Player.name}: hand=[${fmtCards(Player.hand)}], melded=${Player.meldSets ? Player.meldSets.reduce((sum, m) => sum + (Array.isArray(m) ? m.length : 0), 0) : 0}`);
  
  // Clear previous hand display
  for (let k = 1; k <= 12; k++) {
    const el = document.getElementById(Player.id + "card" + k);
      if (el) {
        el.innerHTML = "";
        el.style.border = "";
        delete el.dataset.meldSelected;
        delete el.dataset.suggestedMeld;
        delete el.dataset.handIndex;
        delete el.dataset.melded;
      }
    }

    let cardIdx = 0;
    let meldGroupNum = 1;
    if (Array.isArray(Player.meldSets)) {
      for (let meld of Player.meldSets) {
        if (Array.isArray(meld) && meld.length > 0) {
          const meldBorder = getMeldGroupColour(meldGroupNum);
          TRTlog(`AI-${Player.name}: meld group ${meldGroupNum} [${fmtCards(meld)}] bordered "${meldBorder}"`);
          for (let card of meld) {
            const el = document.getElementById(
              Player.id + "card" + (cardIdx + 1),
            );
            if (el && card) {
              card.styleBorder = meldBorder;
              el.dataset.melded = "1";
              displayCard(card, el.id);
              const imgEl = getCardImageEl(el);
              if (imgEl) {
                imgEl.style.setProperty("border", meldBorder, "important");
              }
            }
            cardIdx++;
          }
          meldGroupNum++;
        }
      }
    }

    // In multiplayer, hide opponents' hand cards (show backs).
    // Meld sets are always shown face-up as they are publicly played.
    const hideCards = game.multiPlayer && Player.id !== game.localPlayerId;

    for (let k = 0; k < Player.hand.length; k++) {
      const el = document.getElementById(Player.id + "card" + (cardIdx + 1));
      if (el && Player.hand[k]) {
        Player.hand[k].styleBorder = "";
        el.dataset.melded = "0";
        el.dataset.handIndex = String(k);
        if (hideCards) {
          displayCardBack(el.id);
        } else {
          displayCard(Player.hand[k], el.id);
        }
      }
      cardIdx++;
    }
  }

function identifyActivePlayer(fontWeight) {
  let PlayerArg = game.currentPlayer.id + "name";
  let PlayerName = document.getElementById(PlayerArg);
  if (PlayerName) PlayerName.style.fontWeight = fontWeight;
  return;
}

function PlayerHandBlinkOn(buttonGroup) {
    const buttons = document.querySelectorAll(buttonGroup);
    buttons.forEach(button => {
        button.classList.add('blinking');
    });
}

function PlayerHandBlinkOff(buttonGroup) {
    const buttons = document.querySelectorAll(buttonGroup);
    buttons.forEach(button => {
        button.classList.remove('blinking');
    });
}

function TestAI() {
  const testHand = [];
  const testMeldSets = [[fourOfHearts, sixOfHearts, jackOfHearts]];
  const shouldUnmeld = window.AIMeldPlanner.shouldUnmeldAndRemeld(testHand, testMeldSets, 5);
  const shouldMeld = window.AIMeldPlanner.shouldAttemptMeld(testHand, testMeldSets, 5);
  TRTlog("Test AI Meld Strategy:");
  TRTlog("Should Unmeld & Remeld?", shouldUnmeld);
  TRTlog("Should Attempt Meld?", shouldMeld);
}

function dealNewRoundCards() {
  TRTlog(`\n========== ROUND ${game.roundNumber} START — Wild: ${game.roundNumber + 2}s and Jesters ==========`);
  game.currentPlayer = game.players[game.currentPlayerIndex];
  game.deck = new Deck(game.roundNumber);
  game.deck.shuffle();
  game.cardsDealt = game.roundNumber + 2;
  displayCardBack("deck-card");
  let drawnCard = game.deck.draw();
  displayCard(drawnCard, "discard-card", "discard");
  game.discardPile = []
  game.discardPile.push(drawnCard);
  game.players.forEach((p) => {
    game.currentPlayer = game.players[game.currentPlayerIndex];
    const nameEl = document.getElementById("player" + p.id.substring(1) + "name");
    if (nameEl) nameEl.textContent = p.name;
    p.hand = [];
    p.meldCards = [];
    p.meldSets = [];
    p.meldCount = 0;
    p.roundScore = 0;
    p.IsOut = false;
    dealHand(p, game.cardsDealt);
    identifyActivePlayer("");
    identifyCurrentPlayer("");
    renderPlayerHand(p);
  });
  setPlayerDrawMode()
}

function createCard(suit, rank, value) {
  let newCard = new Card()
  newCard.suit = suit;
  newCard.rank = rank;
  newCard.value = value;
  return newCard;
}


function testA() { 

  game.currentPlayer.meldSets = [[]]
  let newCard1 = createCard("diamonds", "10", 10)
  let newCard2 = createCard("clubs", "10", 10)
  let newCard3 = createCard("spades", "jack", 10)

 
  game.currentPlayer.meldSets = [
    newCard1, newCard2, newCard3 ];
  
  game.roundNumber = 7
  let meldValue = validateMeld(game.currentPlayer.meldSets);
  TRTlog("validateMeld for test hand:", meldValue);
  return meldValue;

 // for (let i = 0; i < playerLevels.length; i++) {
 //   TRTlog(getPlayerLevel(i));
//  }

//  renderGamesDirectory()
//  filteredLSByKeys()
//return

//storeGameState(game);
 // getDiscardCard(card)
  let x=0
    
}

function testB(card) {
  alertify.alert("This is an alert dialog.", function () {
      alertify.message('OK');
    });
}


  /*
  // Example usage:
  const deck = generateDeck();
  const sampleHand = deck.slice(0, 10); // Example 11-card hand
  TRTlog("Best meld size:", findBestMeld(sampleHand));
}
  /**
   * best melds so that we go out
   * Comprehensive Test Suite for bestMelds Function
   * Tests all valid sets/runs of varying lengths (without wilds for baseline)
   * Max set length: 5 (5 suits)
   * Max run length: 11 (11 consecutive ranks: 3-K)
   * 
   * Set up: Mock the global game object and Card class before running
   */
/*
  // Mock Card class for testing
  class Card {
    constructor(rank, suit) {
      this.rank = rank;
      this.suit = suit;
    }
    toString() {
      return `${this.rank}-${this.suit}`;
    }
  }

  // Mock game object with roundNumber
  let game = {
    roundNumber: 1
  };

  // Rank value mapping function (from functions.js)
  const rankValue = (r) => {
    if (r === "jack") return 11;
    if (r === "queen") return 12;
    if (r === "king") return 13;
    return Number(r);
  };

  // bestMeld function (from validateMeld functions.js) - modified for testing
  function bestMeld(group, options = {}) {
    const silent = Boolean(options.silent) || true; // Always silent for tests

    if (!group || group.length < 3) {
      return { valid: false, reason: "less than 3 cards" };
    }

    const wildRank = String(game.roundNumber + 2);
    const jesters = group.filter(
      (c) => c.rank === "jester" || c.rank === wildRank,
    );
    const nonJesters = group.filter(
      (c) => c.rank !== "jester" && c.rank !== wildRank,
    );

    const ranks = nonJesters.map((c) => c.rank);
    const suitsArr = nonJesters.map((c) => c.suit);
    const uniqueRanks = [...new Set(ranks)];
    const uniqueSuits = [...new Set(suitsArr)];

    // Check for valid set: all same rank, different suits
    if (uniqueRanks.length === 1 && uniqueSuits.length === nonJesters.length && nonJesters.length > 0) {
      return { valid: true, type: "set", cardCount: group.length };
    }

    // Check for valid set with wilds/jesters
    if (
      nonJesters.length > 0 &&
      uniqueRanks.length === 1 &&
      group.length >= 3 &&
      nonJesters.length + jesters.length === group.length
    ) {
      return { valid: true, type: "set", cardCount: group.length };
    }

    // Check for valid run: all same suit, consecutive ranks
    if (uniqueSuits.length === 1) {
      if ((uniqueRanks.length + jesters.length) < 3) {
        return { valid: false, reason: "not enough cards to fill gaps" };
      }

      let values = nonJesters
        .map((c) => rankValue(c.rank))
        .sort((a, b) => a - b);

      let gaps = 0;
      for (let i = 1; i < values.length; i++) {
        gaps += values[i] - values[i - 1] - 1;
      }

      if (gaps <= jesters.length) {
        return { valid: true, type: "run", cardCount: group.length };
      } else {
        return { valid: false, reason: "too many gaps" };
      }
    } else {
      return { valid: false, reason: "not all same suit" };
    }
  }

  // ============= TEST HELPERS =============

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, testName, details = "") {
    if (condition) {
      testsPassed++;
      TRTlog(`✓ PASS: ${testName}`);
    } else {
      testsFailed++;
      console.error(`✗ FAIL: ${testName}\n  ${details}`);
    }
  }

  // ============= VALID SETS TESTS =============
  TRTlog("\n=== TESTING VALID SETS (Same Rank, Different Suits) ===\n");

  const ranks = ["3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king"];
  const suits = ["spades", "clubs", "hearts", "diamonds", "stars"];

  // Test all valid sets of length 3-5 for each rank
  TRTlog("Testing Sets of Length 3-5:");
  ranks.forEach(rank => {
    // Length 3 set (3 suits)
    const set3 = [
      new Card(rank, "spades"),
      new Card(rank, "clubs"),
      new Card(rank, "hearts")
    ];
    const result3 = validateMeld(set3, { silent: true });
    assert(
      result3.valid && result3.type === "set" && result3.cardCount === 3,
      `Set of 3 - Rank ${rank}`,
      `Result: ${JSON.stringify(result3)}`
    );

    // Length 4 set (4 suits)
    const set4 = [
      new Card(rank, "spades"),
      new Card(rank, "clubs"),
      new Card(rank, "hearts"),
      new Card(rank, "diamonds")
    ];
    const result4 = validateMeld(set4, { silent: true });
    assert(
      result4.valid && result4.type === "set" && result4.cardCount === 4,
      `Set of 4 - Rank ${rank}`,
      `Result: ${JSON.stringify(result4)}`
    );

    // Length 5 set (all 5 suits)
    const set5 = [
      new Card(rank, "spades"),
      new Card(rank, "clubs"),
      new Card(rank, "hearts"),
      new Card(rank, "diamonds"),
      new Card(rank, "stars")
    ];
    const result5 = validateMeld(set5, { silent: true });
    assert(
      result5.valid && result5.type === "set" && result5.cardCount === 5,
      `Set of 5 - Rank ${rank}`,
      `Result: ${JSON.stringify(result5)}`
    );
  });

  // ============= VALID RUNS TESTS =============
  TRTlog("\n=== TESTING VALID RUNS (Consecutive Ranks, Same Suit) ===\n");

  // Test runs of increasing lengths for each suit
  TRTlog("Testing Runs of Length 3-11:");
  const runsToTest = [
    { ranks: ["3", "4", "5"], length: 3 },
    { ranks: ["4", "5", "6"], length: 3 },
    { ranks: ["5", "6", "7"], length: 3 },
    { ranks: ["6", "7", "8"], length: 3 },
    { ranks: ["7", "8", "9"], length: 3 },
    { ranks: ["8", "9", "10"], length: 3 },
    { ranks: ["9", "10", "jack"], length: 3 },
    { ranks: ["10", "jack", "queen"], length: 3 },
    { ranks: ["jack", "queen", "king"], length: 3 },
  

    { ranks: ["3", "4", "5", "6"], length: 4 },
    { ranks: ["5", "6", "7", "8"], length: 4 },
    { ranks: ["3", "4", "5", "6", "7"], length: 5 },
    { ranks: ["6", "7", "8", "9", "10"], length: 5 },
    { ranks: ["3", "4", "5", "6", "7", "8"], length: 6 },
    { ranks: ["4", "5", "6", "7", "8", "9"], length: 6 },
    { ranks: ["5", "6", "7", "8", "9", "10"], length: 6 },
    { ranks: ["6", "7", "8", "9", "10", "jack"], length: 6 },
    { ranks: ["7", "8", "9", "10", "jack", "queen"], length: 6 },
    { ranks: ["3", "4", "5", "6", "7", "8", "9"], length: 7 },
    { ranks: ["4", "5", "6", "7", "8", "9", "10"], length: 7 },
    { ranks: ["5", "6", "7", "8", "9", "10", "jack"], length: 7 },
    { ranks: ["6", "7", "8", "9", "10", "jack", "queen"], length: 7 },
    { ranks: ["7", "8", "9", "10", "jack", "queen", "king"], length: 7 },
    { ranks: ["3", "4", "5", "6", "7", "8", "9", "10"], length: 8 },
    { ranks: ["4", "5", "6", "7", "8", "9", "10", "jack"], length: 8 },
    { ranks: ["5", "6", "7", "8", "9", "10", "jack", "queen"], length: 8 },
    { ranks: ["6", "7", "8", "9", "10", "jack", "queen", "king"], length: 8 },
    { ranks: ["3", "4", "5", "6", "7", "8", "9", "10", "jack"], length: 9 },
    { ranks: ["4", "5", "6", "7", "8", "9", "10", "jack", "queen"], length: 9 },
    { ranks: ["5", "6", "7", "8", "9", "10", "jack", "queen", "king"], length: 9 },
    { ranks: ["3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen"], length: 10 },
    { ranks: ["4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king"], length: 10 },
    { ranks: ["3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king"], length: 11 },
  ];

  suits.forEach(suit => {
    runsToTest.forEach(({ ranks: rankList, length }) => {
      const run = rankList.map(r => new Card(r, suit));
      const result = validateMeld(run, { silent: true });
      assert(
        result.valid && result.type === "run" && result.cardCount === length,
        `Run of ${length} (${rankList.join("-")}) in ${suit}`,
        `Result: ${JSON.stringify(result)}`
      );
    });
  });

  // ============= DUPLICATE CARD TESTS (SHOULD FAIL) =============
  TRTlog("\n=== TESTING INVALID: DUPLICATE CARDS (Bug Fix Validation) ===\n");

  const duplicateTests = [
    { cards: [new Card("4", "hearts"), new Card("4", "hearts"), new Card("5", "hearts")], desc: "4H, 4H, 5H (duplicate 4H)" },
    { cards: [new Card("5", "spades"), new Card("5", "spades"), new Card("6", "spades")], desc: "5S, 5S, 6S (duplicate 5S)" },
    { cards: [new Card("jack", "diamonds"), new Card("jack", "diamonds"), new Card("queen", "diamonds")], desc: "JD, JD, QD (duplicate JD)" },
    { cards: [new Card("3", "clubs"), new Card("3", "clubs"), new Card("3", "clubs")], desc: "3C, 3C, 3C (three of same)" },
  ];

  duplicateTests.forEach(({ cards, desc }) => {
    const result = validateMeld(cards, { silent: true });
    assert(
      !result.valid,
      `REJECT Duplicate: ${desc}`,
      `Result: ${JSON.stringify(result)} - Should be invalid`
    );
  });

  // ============= INVALID SETS TESTS =============
  TRTlog("\n=== TESTING INVALID SETS ===\n");

  const invalidSetTests = [
    { cards: [new Card("3", "spades"), new Card("4", "spades"), new Card("5", "spades")], desc: "3S, 4S, 5S (different ranks)" },
    { cards: [new Card("5", "hearts"), new Card("5", "spades"), new Card("5", "clubs")], desc: "5 of mixed suits (missing hearts)" },
    { cards: [new Card("3", "spades"), new Card("3", "clubs"), new Card("4", "hearts")], desc: "3S, 3C, 4H (different ranks)" },
  ];

  invalidSetTests.forEach(({ cards, desc }) => {
    const result = validateMeld(cards, { silent: true });
    // These should be runs if they're consecutive in same suit, or invalid otherwise
    if (cards.every(c => c.suit === cards[0].suit)) {
      // Could be a valid run
      const allRanks = cards.map(c => c.rank);
      const allDiff = new Set(allRanks).size === allRanks.length;
      if (allDiff) {
        // Just a run, not necessarily invalid
        TRTlog(`  (Note: ${desc} - is a valid run)`);
        return;
      }
    }
    assert(
      !result.valid,
      `REJECT Invalid Set: ${desc}`,
      `Result: ${JSON.stringify(result)}`
    );
  });

  // ============= INVALID RUNS TESTS =============
  TRTlog("\n=== TESTING INVALID RUNS ===\n");

  const invalidRunTests = [
    { cards: [new Card("3", "spades"), new Card("5", "spades"), new Card("9", "spades")], desc: "3S, 5S, 9S (gaps too large, no wilds)" },
    { cards: [new Card("3", "hearts"), new Card("3", "clubs"), new Card("3", "spades")], desc: "3H, 3C, 3S (different suits - is a valid set)" },
    { cards: [new Card("3", "hearts"), new Card("4", "spades"), new Card("5", "hearts")], desc: "3H, 4S, 5H (mixed suits)" },
    { cards: [new Card("10", "clubs"), new Card("jack", "clubs"), new Card("3", "clubs")], desc: "10C, JC, 3C (not consecutive)" },
  ];

  invalidRunTests.forEach(({ cards, desc }) => {
    const result = validateMeld(cards, { silent: true });
    // Check if it's actually a valid set (all same rank)
    const ranks = new Set(cards.map(c => c.rank));
    if (ranks.size === 1) {
      TRTlog(`  (Note: ${desc} - is a valid set)`);
      return;
    }
    assert(
      !result.valid,
      `REJECT Invalid Run: ${desc}`,
      `Result: ${JSON.stringify(result)}`
    );
  });

  // ============= EDGE CASES =============
  TRTlog("\n=== TESTING EDGE CASES ===\n");

  // Too few cards
  const tooFew = [new Card("5", "hearts"), new Card("5", "clubs")];
  const resultTooFew = validateMeld(tooFew, { silent: true });
  assert(
    !resultTooFew.valid,
    "REJECT: Less than 3 cards",
    `Result: ${JSON.stringify(resultTooFew)}`
  );

  // Empty
  const resultEmpty = validateMeld([], { silent: true });
  assert(
    !resultEmpty.valid,
    "REJECT: Empty group",
    `Result: ${JSON.stringify(resultEmpty)}`
  );

  // Single card
  const resultSingle = validateMeld([new Card("5", "hearts")], { silent: true });
  assert(
    !resultSingle.valid,
    "REJECT: Single card",
    `Result: ${JSON.stringify(resultSingle)}`
  );

  // ============= TEST SUMMARY =============
  TRTlog("\n==========================================");
  TRTlog("TEST SUMMARY");
  TRTlog("==========================================");
  TRTlog(`✓ Tests Passed: ${testsPassed}`);
  TRTlog(`✗ Tests Failed: ${testsFailed}`);
  TRTlog(`Total Tests: ${testsPassed + testsFailed}`);
  TRTlog("==========================================\n");

  if (testsFailed > 0) {
    console.error(`\n⚠️  ${testsFailed} test(s) failed. Review above for details.\n`);
    process.exit(1);
  } else {
    TRTlog("\n🎉 All tests passed! validateMeld is working correctly.\n");
    process.exit(0);
  }

    
}
*/

function draw() {
    debugLog("draw clicked", {
    player: game.currentPlayer?.name,
    handCount: game.currentPlayer?.hand?.length,
    cardsDealt: game.cardsDealt,
  });
  if (game.currentPlayer.hand.length +
    game.currentPlayer.meldSets.length >= 
    game.cardsDealt + 1){
    showMessage("you have already drawn a card this turn")  
    return;
      }

  updateCurrentPlayerReference();
  game.currentPlayer = game.players[game.currentPlayerIndex]; 
 // if (typeof game.deck.draw === 'function') {
  //  const card = game.deck.draw();} 
 // else showMessage ("call to game.deck.draw() corrupted")  
    const card = game.deck.draw();
 
    while (!card) {
      TRTlog("No more cards in the deck");
      shuffleDiscardIntoDeck();
      dealNewRoundCards();
      game.currentPlayer = game.players[game.currentPlayerIndex];
      game.deck = new Deck(game.roundNumber);
      game.deck.shuffle();
      game.cardsDealt = game.roundNumber + 2;
      displayCardBack("deck-card");
      let drawnCard = game.deck.draw();
      displayCard(drawnCard, "discard-card", "discard");
      game.discardPile = []
      game.discardPile.push(drawnCard);
      game.players.forEach((p) => {
        game.currentPlayer = game.players[game.currentPlayerIndex];
        const nameEl = document.getElementById("player" + p.id.substring(1) + "name");
        if (nameEl) nameEl.textContent = p.name;
        p.hand = [];
        p.meldCards = [];
        p.meldSets = [];
        p.meldCount = 0;
        p.roundScore = 0;
        p.IsOut = false;
        dealHand(p, game.cardsDealt);
        identifyActivePlayer("");
        identifyCurrentPlayer("");
        renderPlayerHand(p);
      });
      TRTlog("Deck size after shuffling discard in:", game.deck.length);
      setPlayerDrawMode()
    }


  game.currentPlayer.hand.push(card);
  debugLog("draw result", {
    player: game.currentPlayer.name,
    card: `${card.rank}-${card.suit}`,
    handCount: game.currentPlayer.hand.length,
    deckCount: game.deck.length,
  });

  renderPlayerHand(game.currentPlayer);
  if (!game.currentPlayer.aiPlayer && game.humanAutoMeldEnabled && typeof autoOptimizeHumanMelds === "function") {
    autoOptimizeHumanMelds(game.currentPlayer);
  }
  if (game.optMeldHint) {
    applyMeldingStrategy( );
    applyHumanMeldSuggestions(game.currentPlayer);
  }
  discardHint()
  turnOnMelding();
}

  function meld() {
  game.currentPlayer = game.players[game.currentPlayerIndex];
  updateCurrentPlayerReference();
  game.currentPlayer = game.players[game.currentPlayerIndex];
  updatePlayerPrompt('');

  if (!requireDrawBeforeAction("melding")) return;

  if (game.currentPlayer.meldCount === 0) {
    if (game.currentPlayer.melding) {
      game.currentPlayer.melding = false;
      game.currentPlayer.meldGroup -= 1;
      changeMeldColor("");
      return;
    } else {
      game.currentPlayer.melding = true;
      game.currentPlayer.meldGroup += 1;
      changeMeldColor("blue");
      return;
    }
  }

  // Identify cards in hand flagged for melding.
  const selectedCards = getSelectedMeldCards(game.currentPlayer);

// check if meld is valid, if so move cards from hand to meldSets, if not alert user and reset meldCards and borders  

  const meldResult = validateMeld(selectedCards);
  if (!meldResult.valid) {
    debugLog("meld rejected", {
      player: game.currentPlayer?.name,
      selectedCount: selectedCards.length,
      cards: selectedCards.map((c) => `${String(c.rank)}-${c.suit}`),
    });
    showMessage("[Meld] Invalid selection", {
      player: game.currentPlayer?.name,
      selected: selectedCards.map((c) => `${String(c.rank)}-${c.suit}`),
    });
    const selectedEls = document.querySelectorAll(
      "." + game.currentPlayer.id + "card",
    );
    selectedEls.forEach((el) => {
      if (isCardMeldSelected(el)) {
        setCardMeldSelection(el, false);
      }
    });
    game.currentPlayer.meldCount = 0;

    game.currentPlayer.meldGroup = Math.max(0,        game.currentPlayer.meldGroup - 1);

    alert("Invalid Meld");
    return;
  }

  if (selectedCards.length > game.cardsDealt) {
    alert(
      `Invalid Meld: too many cards (${selectedCards.length} > ${game.cardsDealt} dealt). Did you include the discard?`,
    );
    // Reset meld mode and clear selections
    const selectedEls = document.querySelectorAll(
      "." + game.currentPlayer.id + "card",
    );
    selectedEls.forEach((el) => {
      if (isCardMeldSelected(el)) {
        setCardMeldSelection(el, false);
      }
    });
    selectedCards.forEach((card) => {
      card.styleBorder = "";
    });
    game.currentPlayer.meldCards = [];
    game.currentPlayer.meldCount = 0;
  //  game.currentPlayer.melding = false;
    game.currentPlayer.meldGroup = Math.max(0, game.currentPlayer.meldGroup - 1);
  //  changeMeldColor("");
    return;
  }

  showMessage("Valid Meld");
  debugLog("meld accepted", {
    player: game.currentPlayer?.name,
    selectedCount: selectedCards.length,
    type: meldResult.type,
  });
  let cardsToMeld = [...selectedCards];
  const meldBorder = getMeldGroupColour(game.currentPlayer.meldGroup);


    const hand = game.currentPlayer.hand;
    const selectedSet = new Set(cardsToMeld);
    game.currentPlayer.hand = hand.filter((handCard) => !selectedSet.has(handCard));

    let selectedEls = document.querySelectorAll("." + game.currentPlayer.id + "card");
    selectedEls.forEach((el) => {
      if (isCardMeldSelected(el)) {
        setCardMeldSelection(el, false);
      }
    });

    if (cardsToMeld.length > 0) {
      game.currentPlayer.meldCards = cardsToMeld;
      // Push a copy of the array to meldSets instead of a reference
      game.currentPlayer.meldSets.push([...cardsToMeld]);
      TRTlog(`AI-${game.currentPlayer.name} [updated meld] ${cardsToMeld.length}  melds = ${game.currentPlayer.meldSets.length} melds`);
    }
    //game.currentPlayer.melding = false;
    //changeMeldColor("");

    if (game.currentPlayer.isAI) {
      // Clear stale AI plan so the next AI cycle can look for another meld.
      game.currentPlayer.aiMeldPlan = null;
      // Prevent repeated unmeld/remeld loops within the same turn.
      game.currentPlayer.aiMeldAttemptedTurn = game.turnCounter || 0;
    }
    game.currentPlayer.meldCount = 0;
    renderPlayerHand(game.currentPlayer);

    if (game.currentPlayer.hand.length === 0) {
      TRTlog(`[Meld] *** PLAYER GOING OUT *** ${game.currentPlayer.name} has no cards left!`);
      PlayerHandBlinkOn("." + game.currentPlayer.id + "card");
      game.currentPlayer.IsOut = true;
      game.finalTurn = true;
      TRTlog(`[Meld] Set IsOut=true, finalTurn=true for ${game.currentPlayer.name}`);
   
      if (!game.currentPlayer.aiPlayer && game.AIPlayers !== game.players.length) {
        alert(game.currentPlayer.name + " you have gone out!");
      } else {
        showMessage(game.currentPlayer.name + " you have gone out!");
      }
      advanceTurn()
      
    }
}

function applyMeldingStrategy( ) {
  const isAIPlayer = Boolean(game.currentPlayer?.aiPlayer);
  const autoPlayActive = Boolean(game.aiAutoPlayEnabled) && !Boolean(game.aiAutoPlayPaused);

  // This strategy mutates meld selection state. Only run it during active AI autoplay turns.
  // Without this guard, human/manual turns can log fake "[AI] melding..." activity and
  // leave meldSets unchanged, which matches the persistent symptom in logs.
  if (!isAIPlayer || !autoPlayActive) {
    if (game.DEBUG || game.TRACE) {
      TRTlog(
        `[applyMeldingStrategy] Skipped: aiPlayer=${isAIPlayer}, autoPlayEnabled=${Boolean(game.aiAutoPlayEnabled)}, paused=${Boolean(game.aiAutoPlayPaused)}, player=${game.currentPlayer?.name || "unknown"}`,
      );
    }
    return;
  }

    // PHASE 2: UNMELD & REMELD (if beneficial)
  if (window.AIMeldPlanner.shouldUnmeldAndRemeld(game.currentPlayer.hand, game.currentPlayer.meldSets, (game.roundNumber + 2))) {
    TRTlog(`AI-${game.currentPlayer.name} unmelding`);
      
      // Unmeld all cards back to hand
      for (let i = 0; i < game.currentPlayer.meldSets.length; i++) {
          for (let k = 0; k < game.currentPlayer.meldSets[i].length; k++) {
              game.currentPlayer.meldSets[i][k].bckgrndColour = "";
              game.currentPlayer.meldSets[i][k].styleBorder = "";
              game.currentPlayer.hand.push(game.currentPlayer.meldSets[i][k]);
          }
      }
      game.currentPlayer.meldSets = [];
      game.currentPlayer.meldCards = [];
      game.currentPlayer.meldCount = 0;
      game.currentPlayer.meldGroup = 0;
      renderPlayerHand(game.currentPlayer);
  }
  
  // PHASE 3: MELD
  if (window.AIMeldPlanner.shouldAttemptMeld(game.currentPlayer.hand, game.currentPlayer.meldSets, (game.roundNumber + 2))) {
      const possibleMelds = window.AIMeldPlanner.findPossibleMelds(game.currentPlayer.hand, (game.roundNumber + 2));
      TRTlog(`[AI] ${game.currentPlayer.name} found ${possibleMelds.length} possible melds`);
      
      if (possibleMelds.length > 0) {
          const bestMeld = window.AIMeldPlanner.selectBestMeld(possibleMelds, (game.roundNumber + 2));
          
          if (bestMeld) {
              TRTlog(`[AI] ${game.currentPlayer.name} melding ${bestMeld.size} cards (${bestMeld.type})`);
              
              // Mark cards for melding
              game.currentPlayer.melding = true;
              game.currentPlayer.meldGroup += 1;
              const meldedCount = getMeldedCardCount(game.currentPlayer);
              
              bestMeld.indices.forEach(idx => {
                  const domCardIndex = idx + 1 + meldedCount;
                  const cardEl = document.getElementById(game.currentPlayer.id + "card" + domCardIndex);
                  if (cardEl) {
                    setCardMeldSelection(cardEl, true);
                  //  aiManualStepMode ? "6px solid blue" : getMeldGroupColour(game.currentPlayer.meldGroup);  
                      game.currentPlayer.meldCount += 1;
                  }
              });
            } 
          }       
        }
      }


function unMeld() {
TRTlog ("unMeld clicked for ", game.currentPlayer.name);
for (let i = 0; i < game.currentPlayer.meldSets.length; i++) {
  for (let k = 0; k < game.currentPlayer.meldSets[i].length; k++) {

  game.currentPlayer.meldSets[i][k].bckgrndColour = "";
  game.currentPlayer.meldSets[i][k].styleBorder = "";
  game.currentPlayer.hand.push(game.currentPlayer.meldSets[i][k]);}
}
game.currentPlayer.meldSets = [];
game.currentPlayer.meldCards = [];
game.currentPlayer.meldCount = 0;
game.currentPlayer.meldGroup = 0;

for (let i = 0; i < game.currentPlayer.hand.length; i++) {
  game.currentPlayer.hand[i].bckgrndColour = "";
  game.currentPlayer.hand[i].styleBorder = "";
  }
renderPlayerHand(game.currentPlayer);
}


// Validates whether a group of cards forms a legal The Round Table meld (set or run).
// NOTE: This function only checks if the cards themselves are a valid meld.

// The mandatory discard rule is enforced by selectBestMeld() in aiMeldPlanner.js
// which filters out any meld where remainingCards === 0.
function validateMeld(group, options = {}) {
 const silent = Boolean(options.silent);
  
  if (!group || group.length < 3) {
    if (!silent) showMessage("[validateMeld] Invalid: less than 3 cards");
    return { valid: false };
  }
 // Check if meld exceeds number of cards dealt (accounting for previous melds this turn)

  if (+ game.currentPlayer.meldCount > game.cardsDealt) {
    if (!silent) showMessage(`[validateMeld] Invalid: meld has ${group.length} cards but only ${game.cardsDealt - game.currentPlayer.meldCount} remaining after previous melds`);
    return { valid: false };
  } 

  const wildRank = String(game.roundNumber + 2);
  const intWildRank = game.roundNumber + 2;
  const jesters = group.filter(
    (c) => c.rank === "jester" || c.value === intWildRank,
  );
  const nonJesters = group.filter(
    (c) => c.rank !== "jester" && c.value !== intWildRank,
  );
  const rankValue = (r) => {
    if (r === "jack") return 11;
    if (r === "queen") return 12;
    if (r === "king") return 13;
    return Number(r);
  };
  const ranks = nonJesters.map((c) => c.rank);
  const wilds = group.filter((c) => c.value === intWildRank);
  const suitsArr = nonJesters.map((c) => c.suit);
  const uniqueRanks = [...new Set(ranks)];
  const uniqueSuits = [...new Set(suitsArr)];
  
  if (!silent) {
    showMessage(
      "[validateMeld] Attempted meld:",
      group.map((c) => `${c.rank}-${c.suit}`),
    );
  }
  
  if (uniqueRanks.length === 0 && uniqueSuits.length === nonJesters.length) {
    if (!silent) showMessage("[validateMeld] Valid set");
    return { valid: true, type: "set" };
  }
  if (
    nonJesters.length > 0 &&
    uniqueRanks.length === 1 &&
    group.length >= 3 &&
    nonJesters.length + jesters.length === group.length
  ) {
    if (!silent) showMessage("[validateMeld] Valid set (with wilds/jesters)");
    return { valid: true, type: "set" };
  }
  if (uniqueSuits.length === 1) 
    {
    // check that the unique suit forms a sequence with wilds/jesters filling any gaps
    if ((uniqueRanks.length + jesters.length) < 3)
     {
      if (!silent) alert("[validateMeld] Invalid run: not enough wilds/jesters to fill gaps");
      return { valid: false };
     }
    // Duplicate natural ranks are never valid in a run
    if (uniqueRanks.length !== nonJesters.length) {
      if (!silent) showMessage("[validateMeld] Invalid run: duplicate ranks");
      return { valid: false };
    }
    let values = nonJesters
      .map((c) => rankValue(c.rank))
      .sort((a, b) => a - b);
    let gaps = 0;
    for (let i = 1; i < values.length; i++) {
      gaps += values[i] - values[i - 1] - 1;
    }
    if (!silent) {
      showMessage(
        `[validateMeld] Run gaps: ${gaps}, jesters: ${jesters.length}, wilds: ${wilds.length}`,
      );
    }
    if (gaps <= jesters.length) {
      if (!silent) showMessage("[validateMeld] Valid run");
      return { valid: true, type: "run" };
    } else {
      if (!silent) showMessage("[validateMeld] Invalid run: too many gaps");
    }
   } 
  else 
    {
    if (!silent) showMessage("[validateMeld] Invalid run: not all same suit");
    }
  if (!silent) showMessage("[validateMeld] Invalid meld");
  return { valid: false };
}
 
 function advanceTurn(options = {}) {

  const previousPlayer = game.currentPlayer;
  if (previousPlayer) {
    // End-of-turn cleanup for temporary meld-selection mode.
    previousPlayer.melding = false;
    previousPlayer.meldCount = 0;
    previousPlayer.meldGroup = 0;
  }

  if (game.currentPlayerIndex !== -1) {
    updatePlayerReference();
    identifyCurrentPlayer("");
    updatePlayerPrompt('');
    universalGameContext.isAI = game.currentPlayer.isAI;
    universalGameContext.isMultiPlayer = false 
    if (game.currentPlayer.isAI)
      {
      universalGameContext.suppressMessages = true;  
      universalGameContext.autoActions = true;   
      } 
    else      
      {
      UniversalGameContext.suppressMessages = false;
      UniversalGameContext.autoActions = false;
      } 
  }  
  }

  // Advance to next player
  const previousPlayerIndex = game.currentPlayerIndex;
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  game.currentPlayer = game.players[game.currentPlayerIndex];
  
  TRTlog(`[advanceTurn] from ${previousPlayerIndex} to ${game.currentPlayerIndex} (${game.currentPlayer.name})`);
  TRTlog(`[advanceTurn] Player state: AI=${game.currentPlayer.aiPlayer}, IsOut=${game.currentPlayer.IsOut}, finalTurn=${game.finalTurn}, hand=${game.currentPlayer.hand.length} cards`);

  // If we've returned to a player who is out, the round is over
  if (game.currentPlayer.IsOut) {
    TRTlog(`[advanceTurn] *** ROUND ENDING *** Returned to player who went out (${game.currentPlayer.name}). Calling NextRound().`);
    NextRound();
    return;
  }
  
  game.turnCounter = (game.turnCounter || 0) + 1;
  setPlayerDrawMode();

  // Keep board state visually consistent across turn boundaries.
  // This re-applies meld borders from each player's meldSets after a discard/end turn.
  if (Array.isArray(game.players)) {
    TRTlog(`[advanceTurn] Rerendering all ${game.players.length} players`);
    game.players.forEach((p) => renderPlayerHand(p));
  }
  updateHumanAIFlag();

  // Check if player has no cards - this should only happen at game start
  // During normal play, players should always have cards after drawing
  if (game.currentPlayer.hand.length === 0 && !game.finalTurn && game.roundNumber === 1) {
    TRTlog(`[advanceTurn] Player has no cards at game start, dealing initial round`);
    dealNewRoundCards();
  }
  
  if (game.currentPlayer.aiPlayer && game.aiAutoPlayEnabled && !game.aiAutoPlayPaused) {
    TRTlog(`[advanceTurn] Scheduling AI turn for ${game.currentPlayer.name}`);
    scheduleAITurn(500);
  } else {
    TRTlog(`[advanceTurn] NOT scheduling AI turn: aiPlayer=${game.currentPlayer.aiPlayer}, autoPlayEnabled=${game.aiAutoPlayEnabled}, paused=${game.aiAutoPlayPaused}`);
  }


function XGameState(game) {
// Only save serializable properties
  const stateToSave = {
    cardWidth: game.cardWidth,
    currentPlayer: game.currentPlayer,
    cardHeight: game.cardHeight,
    roundNumber: game.roundNumber,
    scoreboardData: game.scoreboardData,
    dealerIndex: game.dealerIndex,
    activePlayer: game.activePlayer,
    cardsDealt: game.cardsDealt,
    deck: game.deck.cards,
    players: game.players.map((p) => (  { 
      id: p.id,
      name: p.name,
      gameScore: p.gameScore,
      roundScore: p.roundScore,
      hand: p.hand,
      meldSets: p.meldSets,
      meldCount: p.meldCount,
      melding: p.melding,
      IsOut: p.IsOut,
      wildDiscard: p.wildDiscard,  
      wildDraw: p.wildDraw,
      wildCardUse: p.wildCardUse,
      goingOutBonus: p.goingOutBonus,
      aiPlayer: p.aiPlayer
    })),
    discardPile: game.discardPile,
    aiAutoPlayEnabled: game.aiAutoPlayEnabled,
    aiAutoPlayPaused: game.aiAutoPlayPaused,
    aiAutoPlaySpeed: game.aiAutoPlaySpeed,
    aiManualStepMode: game.aiManualStepMode,
    humanAutoMeldEnabled: game.humanAutoMeldEnabled,
    aiPendingStep: game.aiPendingStep,
    aiPendingAdvance: game.aiPendingAdvance,
    // Add other game properties as needed
  };

  //TRTlog(JSON.stringify(stateToSave));
  localStorage.setItem("game_state", JSON.stringify(stateToSave));

  game.players.forEach((p) => {
  TRTlog(`Player: ${p.name} (ID: ${p.id})`);
  // Stringify makes the card objects readable
  TRTlog("Hand:", JSON.stringify(p.hand, null, 2)); 
  });
  const storageKey = getCurrentGameStorageKey(true);
  localStorage.setItem(storageKey, JSON.stringify(stateToSave));
  upsertGamesDirectoryEntry();
}

  function updatePlayerPrompt(msg) {
  const promptEl = document.getElementById(game.currentPlayer.id + "prompt")
  if (promptEl) promptEl.textContent = msg;
  }

function identifyCurrentPlayer(colour) {
  game.currentPlayer = game.players[game.currentPlayerIndex];
  let pSuffix = game.currentPlayer.id
  pSuffix = pSuffix.charAt(pSuffix.length - 1);
  const nameEl = document.getElementById("player" + pSuffix + "name");
  nameEl.textContent = game.currentPlayer.name;
  nameEl.style.color = colour;
}
  //addEventListeners()

function changeMeldColor(colour) {
  const El = document.getElementById("meld");
  if (El) {
  const isOn = Boolean(colour);
  El.style.backgroundColor = colour;
  El.textContent = isOn ? "--Meld ON--" : "--Meld--";
  El.setAttribute("aria-pressed", isOn ? "true" : "false");
  El.title = isOn ? "Meld mode is ON" : "Meld mode is OFF";
  }
}

function loadAIAutoPlayState() {
  const stored = localStorage.getItem(AI_AUTO_PLAY_STORAGE_KEY);
  if (stored === "true") {
    game.aiAutoPlayEnabled = true;
    const checkbox = document.getElementById("ai-auto-play");
    if (checkbox) checkbox.checked = true;
    return true;
  }
  game.aiAutoPlayEnabled = false;
  return false;
}
//=======================================================

function updateDisplay() {
    const deckCardsEl = document.getElementById('deck-count');
    const discardCardsEl = document.getElementById('discard-count');
    if (deckCardsEl) {
      deckCardsEl.innerText =''
      deckCardsEl.innerText = `${game.deck.cards.length}`;
    }
    if (discardCardsEl) 
    {
      discardCardsEl.innerText = ''
      discardCardsEl.innerText = `${game.discardPile.length}`;   
      if (game.discardPile.length === 0) {
        const discardCardsEl2 = document.getElementById('discard-card');
        if(discardCardsEl2) discardCardsEl2.innerText = '';
      }
    }
    }
    
function shuffleDiscardIntoDeck() {
    // 1. Add all cards from the discard pile to the main deck
    while( game.discardPile.length> 3)    
      game.deck.cards.push(game.discardPile.pop()); 
    

    // 2. Shuffle the entire deck using the Fisher-Yates algorithm
    game.deck.shuffle(); 

    TRTlog("Discard pile shuffled into the deck. New deck size:", game.deck.cards.length);
}

// Example discard pile (array of card objects, e.g., { suit: 'Hearts', rank: 'A' })
let discardPile = [
  { suit: 'Spades', rank: '5' },
  { suit: 'Clubs', rank: 'Q' },
  { suit: 'Diamonds', rank: '7' }
];

// Function to render a card to the display element
function renderDiscard(card) {
  const displayElement = document.getElementById('discard-card');
  if (card) {
    displayCard(card, "discard-card", "discard");
    //displayElement.innerHTML = `${card.rank} of ${card.suit}`;
    // Add styling classes if needed (e.g., displayElement.classList.add('active'))
  } else {
    // Blank out the card display if no card is provided
    displayElement.innerHTML = '';
    // Remove styling classes if needed (e.g., displayElement.classList.remove('active'))
  }
}

// Function to get the next card from the discard pile and update the display
function displayNextDiscard() {
  // Check if the discard pile is empty
  if (game.discardPile.length === 0) {
    renderDiscard(null); // Blank out the display
    TRTlog("Discard pile is now empty.");
    return;
  }

  // Get the top card from the pile (removes the last element and returns it)

  // You can use this retrieved 'topCard' for game logic if needed

  // Display the new top card (which is now the last element remaining in the array)
  // If the pile becomes empty after the pop, this will handle the blank display
  const nextTopCard = game.discardPile.length > 0 ? game.discardPile[game.discardPile.length - 1] : null;
  renderDiscard(nextTopCard);
}

// Initial display of the top card when the page loads
//document.addEventListener('DOMContentLoaded', (event) => {
 // const initialTopCard = game.discardPile.length > 0 ? game.//discardPile[game.discardPile.length - 1] : null;
 // renderDiscard(initialTopCard);
//});

 
  function getDiscardCard() {
  if (game.currentPlayer.hand.length +
    game.currentPlayer.meldSets.length >=
    game.cardsDealt + 1) {
    showMessage("you have already drawn a card this turn")
    return;
  }
  if (game.discardPile.length === 0) return null;
  const dCard = game.discardPile.pop();
  displayNextDiscard()
  if (game.discardPile.length === 0) {
    const discardCardEl = document.getElementById("discard-card");
    if (discardCardEl) discardCardEl.innerHTML = "";
  }
  return dCard;
}

function dropDiscardCard(card) {
  game.discardPile.push(card);
  displayCard(card, "discard-card", "discard");
  updateDisplay()
}

function storeGameState() {
  const storageKey = getCurrentGameStorageKey();
  const stateToSave = game; 
  localStorage.setItem(storageKey, JSON.stringify(stateToSave));  
  TRTlog(`[${new Date().toISOString()}] storeGameState: Saved under key '${storageKey}'`);
  upsertGamesDirectoryEntry();
}
// ===== PHASE 1: INITIALIZATION FUNCTIONS (moved from main.js) =====

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatGameId(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}-${min}-${ss}`;
}

function getGameStorageKey(gameId) {
  return `${GAME_STATE_KEY_PREFIX}${gameId}`;
}

function getScoreboardStorageKey(gameId) {
  return `${SCOREBOARD_KEY_PREFIX}${gameId}`;
}

function getCurrentGameId() {
  const currentGameId = localStorage.getItem(CURRENT_GAME_ID_KEY);
  return currentGameId;
}

function setCurrentGameId(gameId) {
  if (gameId) {
    localStorage.setItem(CURRENT_GAME_ID_KEY, gameId);
  } else {
    localStorage.removeItem(CURRENT_GAME_ID_KEY);
  }
}

function getCurrentGameStorageKey(createIfMissing = true) {
  let gameId = getCurrentGameId();
  if (!gameId && createIfMissing) {
    gameId = formatGameId();
    setCurrentGameId(gameId);
  }
  return gameId ? getGameStorageKey(gameId) : "game_state";
}

function getCurrentScoreboardKey() {
  const gameId = getCurrentGameId();
  return gameId ? getScoreboardStorageKey(gameId) : "scoreboard_data";
}

function ensureCurrentGameIdFromLegacy() {
  if (getCurrentGameId()) return;
  const legacyState = localStorage.getItem("game_state");
  if (!legacyState) return;

  const gameId = formatGameId();
  setCurrentGameId(gameId);
  const newKey = getGameStorageKey(gameId);
  localStorage.setItem(newKey, legacyState);
}

function reLoadGameState(gameIdOverride) {
  // If a new game was just requested, skip restore entirely.
  if (!gameIdOverride && sessionStorage.getItem("newGameRequested") === "true") {
    sessionStorage.removeItem("newGameRequested");
    GameReloaded = false;
    TRTlog("[reLoadGameState] New game requested — skipping restore.");
    return false;
  }

  // Resolve storage key without creating a new game id during restore.
  let storageKey = "";
  if (gameIdOverride) {
    storageKey = getGameStorageKey(gameIdOverride);
  } else {
    ensureCurrentGameIdFromLegacy();
    const currentId = getCurrentGameId();

    if (currentId) {
      storageKey = getGameStorageKey(currentId);
    } else {
      const directory = loadGamesDirectory();
      // Sort by updatedAt descending to pick the most recently played game.
      const sortedDir = directory
        .filter((entry) => entry?.id && entry?.storageKey && localStorage.getItem(entry.storageKey))
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      const latestSaved = sortedDir[0] || null;
      if (latestSaved) {
        storageKey = latestSaved.storageKey;
        setCurrentGameId(latestSaved.id);
        TRTlog(`[${new Date().toISOString()}] [reLoadGameState] No CurrentGameId — auto-selecting most recent: ${latestSaved.id} (updatedAt: ${latestSaved.updatedAt})`);
      } else {
        storageKey = "game_state";
      }
    }
    game.meldingColour = "6px solid blue";
  }

  const savedState = localStorage.getItem(storageKey)
    || (storageKey !== "game_state" ? localStorage.getItem("game_state") : null);
  if (savedState) {
    if (gameIdOverride) setCurrentGameId(gameIdOverride);
    const parsedState = JSON.parse(savedState);
    Object.assign(game , parsedState);

    // Backward-compatible restore for sessions saved before AI flags were persisted.
    if (typeof game.aiAutoPlayEnabled !== "boolean") {
      game.aiAutoPlayEnabled = localStorage.getItem(AI_AUTO_PLAY_STORAGE_KEY) === "true";
    }
    if (typeof game.aiAutoPlayPaused !== "boolean") {
      game.aiAutoPlayPaused = false;
    }
    const aiToggle = document.getElementById("ai-auto-play");
    if (aiToggle) {
      aiToggle.checked = Boolean(game.aiAutoPlayEnabled);
    }

    // Keep helper flags (optMeldHint, warnings, prompts) aligned with restored room tier.
    if (typeof applyRoomTier === "function") {
      applyRoomTier(game.roomTier || "beginners_hall");
    }
    
    // Recreate Deck instance with proper methods
    if (parsedState.deck && parsedState.deck.cards) {
      const deckData = parsedState.deck;
      game.deck = new Deck();
      game.deck.cards = deckData.cards;
    }
    
    // Recreate Player instances with proper methods
    if (Array.isArray(parsedState.players)) {
      game.players = parsedState.players.map(playerData => {
        const player = new Player(playerData.id, playerData.name);
        Object.assign(player, playerData);
        return player;
      });
      if (game.currentPlayerIndex !== -1 && game.players[game.currentPlayerIndex]) {
        game.currentPlayer = game.players[game.currentPlayerIndex];
      }
    }
    
    TRTlog("Game state restored from localStorage.");

    updateDeckAndDiscardDisplay();
    return true;
    }
  GameReloaded = false;
  return false;
}

// ===== PHASE 2: CONFIGURATION & REFERENCES (moved from main.js) =====

function startGameWhenReady() {
  if (typeof window.logInPlayers === "function") {
    window.logInPlayers();
    if (typeof addEventListeners === "function") addEventListeners();
  } else {
    // Try again in 50ms
    setTimeout(startGameWhenReady, 50);
  }
}

function updateCurrentPlayerReference() {
  game.currentPlayer= game.players[game.currentPlayerIndex];
  identifyCurrentPlayer("blue");
}

function updateHumanAIFlag() {  
  game.players.forEach((p) => {
    syncRuntimePlayerProgressFromStore(p);

    const aiBadgeEl = document.getElementById(p.id + "ai-h");
    if (aiBadgeEl) {
      if (p.aiPlayer) {
        aiBadgeEl.innerHTML = '<img class="ai-icon" src="./android.svg" color="purple" alt="AI player" />';
        aiBadgeEl.title = "AI player";
      } else {
        aiBadgeEl.innerHTML = "";
        aiBadgeEl.title = "";
      }
    }
    
    const el1 = document.getElementById(p.id +"id");
    if (el1) el1.textContent = "id: " + p.id;

    const el2 = document.getElementById(p.id +"fname");
    if (el2) el2.innerHTML = `${escapeHtml(p.name)} ${getPlayerRankBadgeMarkup(p)}`;

    const el6 = document.getElementById(p.id +"roundScore");
    if (el6) el6.textContent = "roundScore: " + p.roundScore;

    const el7 = document.getElementById(p.id +"gameScore");
    if (el7) el7.textContent = "gameScore: " + p.gameScore;

    const el8 = document.getElementById(p.id +"IsOut");
    if (el8) el8.textContent = "IsOut: " + p.IsOut;

    const el9 = document.getElementById(p.id +"melding");
    if (el9) el9.textContent = "melding: " + p.melding;
  });

  renderProgressionDebugPanel();
}

function getDefaultAIConfig() {
  return {
    p1: { enabled: false, difficulty: "smart" },
    p2: { enabled: true, difficulty: "smart" },
    p3: { enabled: true, difficulty: "smart" },
  };
}

function loadAIConfig() {
  try {
    const stored = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!stored) return getDefaultAIConfig();
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : getDefaultAIConfig();
  } catch {
    return getDefaultAIConfig();
  }
}

function saveAIConfig(config) {
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function setAIConfigToUI(config) {
  const p1Mode = document.getElementById("ai-p1-mode");
  const p2Mode = document.getElementById("ai-p2-mode");
  const p3Mode = document.getElementById("ai-p3-mode");
  const p1Diff = document.getElementById("ai-p1-difficulty");
  const p2Diff = document.getElementById("ai-p2-difficulty");
  const p3Diff = document.getElementById("ai-p3-difficulty");

  if (p1Mode) p1Mode.value = config.p1?.enabled ? "ai" : "human";
  if (p2Mode) p2Mode.value = config.p2?.enabled ? "ai" : "human";
  if (p3Mode) p3Mode.value = config.p3?.enabled ? "ai" : "human";

  if (p1Diff) p1Diff.value = config.p1?.difficulty || "smart";
  if (p2Diff) p2Diff.value = config.p2?.difficulty || "smart";
  if (p3Diff) p3Diff.value = config.p3?.difficulty || "smart";
}

function getAIConfigFromUI() {
  const p1Mode = document.getElementById("ai-p1-mode");
  const p2Mode = document.getElementById("ai-p2-mode");
  const p3Mode = document.getElementById("ai-p3-mode");
  const p1Diff = document.getElementById("ai-p1-difficulty");
  const p2Diff = document.getElementById("ai-p2-difficulty");
  const p3Diff = document.getElementById("ai-p3-difficulty");

  return {
  
    p1: {
      enabled: p1Mode ? p1Mode.value === "ai" : false,
      difficulty: p1Diff ? p1Diff.value : "smart",
    },
    p2: {
      enabled: p2Mode ? p2Mode.value === "ai" : true,
      difficulty: p2Diff ? p2Diff.value : "smart",
    },
    p3: {
      enabled: p3Mode ? p3Mode.value === "ai" : true,
      difficulty: p3Diff ? p3Diff.value : "smart",
    },
  };
}

function applyAIConfig(config) {
  if (game.players.length === 0) {
    logInPlayers();
  }

  if (game.currentPlayerIndex !== -1) {
    game.currentPlayer = game.players[game.currentPlayerIndex];
  }

  // Sync global flags from game object after restore
  aiAutoPlayEnabled = game.aiAutoPlayEnabled;
  aiAutoPlayPaused  = game.aiAutoPlayPaused;

  if (game.aiAutoPlayEnabled && !game.aiAutoPlayPaused && game.currentPlayer && game.currentPlayer.aiPlayer) {
    scheduleAITurn(400);
  }
}

// ===== PHASE 3: GAME DIRECTORY (moved from main.js) =====

function loadGamesDirectory() {
  try {
    const stored = localStorage.getItem(GAMES_DIRECTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGamesDirectory(directory) {
  localStorage.setItem(GAMES_DIRECTORY_KEY, JSON.stringify(directory));
}

function getDirectoryEntryById(directory, gameId) {
  return directory.find((entry) => entry.id === gameId);
}

function updateGameDirectoryStatus(gameIdOverride) {
  const statusEl = document.getElementById("game-status");
  const infoEl = document.getElementById("game-info-text");
  if (!statusEl && !infoEl) return;

  const directory = loadGamesDirectory();
  const gameId = gameIdOverride || getCurrentGameId();
  const entry = gameId ? getDirectoryEntryById(directory, gameId) : null;
  const status = entry?.status || "open";

  if (statusEl) statusEl.textContent = `Status: ${status}`;
  if (infoEl) {
    const infoText = entry?.info || "";
    if (infoEl.value !== infoText) infoEl.value = infoText;
  }
}

function filteredLSByKeys(term = 'game_state_') {
  const filteredObj = {};
  Object.keys(localStorage) // Get all keys as an array
    .filter(key => key.includes(term)) // Filter the keys based on a condition
    .forEach(key => {
      // Retrieve the value for the filtered key
      filteredObj[key] = localStorage.getItem(key);
    });
  return filteredObj; // Returns an object with the matching key-value pairs
}

function renderGamesDirectory() {
  const listEl = document.getElementById("game-select");
  if (!listEl) return;

  const directory = loadGamesDirectory();
  listEl.innerHTML = "";
  directory.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    const info = entry.info ? ` | ${entry.info}` : "";
    option.textContent = `${entry.id} | ${entry.status || "open"}${info}`;
    listEl.appendChild(option);
  });

  const currentId = getCurrentGameId();
  if (currentId) listEl.value = currentId;
  updateGameDirectoryStatus();
}

function bindGameDirectoryControls() {
  const saveBtn = document.getElementById("save-game");
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.addEventListener("click", () => {
      storeGameState(game);
      updateGameDirectoryStatus();
    });
    saveBtn.dataset.bound = "true";
  }

  const listEl = document.getElementById("game-select");
  if (listEl && !listEl.dataset.bound) {
    listEl.addEventListener("change", () => {
      const selectedId = listEl.value;
      setCurrentGameId(selectedId || "");
      updateGameDirectoryStatus(selectedId);
    });
    listEl.dataset.bound = "true";
  }
}

function resumeSelectedGame() {
  const listEl = document.getElementById("game-select");
  const selectedId = listEl ? listEl.value : "";
  if (!selectedId) return false;
  return reLoadGameState(selectedId);
}

function startNewGame() {
  setCurrentGameId("");
  GameReloaded = false;
  location.reload();
}

function upsertGamesDirectoryEntry(infoOverride) {
  let gameId = getCurrentGameId();
  if (!gameId) {
    gameId = formatGameId();
    setCurrentGameId(gameId);
  }

  const storageKey = getGameStorageKey(gameId);
  const status = game.roundNumber >= game.lastRound ? "completed" : "open";
  const now = new Date().toISOString();
  const infoEl = document.getElementById("game-info-text");
  const info = infoOverride ?? (infoEl ? infoEl.value.trim() : "");

  const directory = loadGamesDirectory();
  const existing = getDirectoryEntryById(directory, gameId);

  if (existing) {
    existing.storageKey = storageKey;
    existing.status = status;
    existing.info = info;
    existing.updatedAt = now;
  } else {
    directory.unshift({
      id: gameId,
      storageKey,
      info,
      status,
      createdAt: now,
      updatedAt: now,
    });
  }

  saveGamesDirectory(directory);
  renderGamesDirectory();
}

async function initGamesDirectory() {
  if (localStorage.getItem(GAMES_DIRECTORY_KEY)) {
    let directory = loadGamesDirectory();
    const pruned = directory.filter(
      (entry) => entry?.storageKey && localStorage.getItem(entry.storageKey),
    );
    const removedCount = directory.length - pruned.length;
    if (removedCount > 0) {
      saveGamesDirectory(pruned);
      const statusEl = document.getElementById("game-status");
      if (statusEl) {
        statusEl.textContent = `Status: ${removedCount} stale entr${removedCount === 1 ? "y" : "ies"} removed`;
        setTimeout(() => updateGameDirectoryStatus(), 3000);
      }
    }
    
    // Scan localStorage for any orphaned game_state_* keys not in directory and add them.
    const orphansFound = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(GAME_STATE_KEY_PREFIX)) {
        const gameId = key.substring(GAME_STATE_KEY_PREFIX.length);
        if (!getDirectoryEntryById(pruned, gameId)) {
          const now = new Date().toISOString();
          pruned.unshift({
            id: gameId,
            storageKey: key,
            info: "",
            status: "open",
            createdAt: now,
            updatedAt: now,
          });
          orphansFound.push(gameId);
        }
      }
    }
    if (orphansFound.length > 0) {
      TRTlog(`[${new Date().toISOString()}] initGamesDirectory: Found ${orphansFound.length} orphaned game(s):`, orphansFound);
    }
    
    directory = pruned;
    saveGamesDirectory(directory);
    renderGamesDirectory();
    const currentId = getCurrentGameId();
    if (currentId) {
      if (!getDirectoryEntryById(directory, currentId)) {
        setCurrentGameId("");
      } else {
        updateGameDirectoryStatus();
      }
    }
    return;
  }

  try {
    const response = await fetch(GAMES_DIRECTORY_FILE, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        saveGamesDirectory(data);
        renderGamesDirectory();
        return;
      }
    }
  } catch {
    // Ignore and fall back to empty directory.
  }

  saveGamesDirectory([]);
  renderGamesDirectory();
  if (getCurrentGameId()) {
    upsertGamesDirectoryEntry();
  }
}

function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function formatScoreboardCard(card) {
  const rankText = card?.rank ?? " ";
  const suitText =
    typeof useIcons !== "undefined" && useIcons
      ? getSuitIcon(card?.suit).slice(0, 1) ?? " "
      : card?.suit ?? " ";
  const colour = card?.suitColour ?? "";
  const styleAttr = colour ? ` style="color:${colour};"` : "";
  return `<span class="score-card"${styleAttr}>${rankText}-${suitText}</span>`;
}

// ===== PHASE 4: AI CONTROL (moved from main.js) =====

function performAITurn() {
  if (!game.aiAutoPlayEnabled || !game.currentPlayer.aiPlayer || game.aiAutoPlayPaused) return;
  
  aiTakeTurn();
  updateCurrentPlayerReference();
}

function enableAIAutoPlay() {
  aiAutoPlayEnabled = true;
  game.aiAutoPlayEnabled = true;
  localStorage.setItem(AI_AUTO_PLAY_STORAGE_KEY, "true");
  TRTlog("AI Auto-Play ENABLED");
  
  if (game.currentPlayer.aiPlayer && !game.aiAutoPlayPaused) {
    scheduleAITurn(1000);
  }
}

function disableAIAutoPlay() {
  aiAutoPlayEnabled = false;
  game.aiAutoPlayEnabled = false;
  clearAIAutoPlayTimer();
  localStorage.setItem(AI_AUTO_PLAY_STORAGE_KEY, "false");
  TRTlog("AI Auto-Play DISABLED");
}

function clearAIAutoPlayTimer() {
  if (game.aiAutoPlayAnimationId) {
    clearTimeout(game.aiAutoPlayAnimationId);
    game.aiAutoPlayAnimationId = null;
  }
}

function scheduleAITurn(delayMs) {
  if (!game.aiAutoPlayEnabled || game.aiAutoPlayPaused) return;
  if (!game.currentPlayer || !game.currentPlayer.aiPlayer) return;
  if (game.roundNumber > game.lastRound) {
    TRTlog("[AI] Game is complete, not scheduling AI turn");
    return;
  }
  const scaledDelay = Math.max(50, Math.round(delayMs / game.aiAutoPlaySpeed));
  if (game.aiManualStepMode) {
    game.aiPendingStep = true;
    updateAIStepButton();
    return;
  }
  clearAIAutoPlayTimer();
  game.aiAutoPlayAnimationId = setTimeout(() => performAITurn(), scaledDelay);
}

function updateAIPauseButton() {
  const pauseBtn = document.getElementById("ai-pause");
  if (pauseBtn) pauseBtn.textContent = game.aiAutoPlayPaused ? "Resume AI" : "Pause AI";
}

function updateAISpeedLabel() {
  const speedValue = document.getElementById("ai-speed-value");
  if (speedValue) speedValue.textContent = `${game.aiAutoPlaySpeed.toFixed(2)}x`;
}

function updateAIStepButton() {
  const stepBtn = document.getElementById("ai-step");
  if (!stepBtn) return;
  const canStep = game.aiPendingAdvance || game.aiPendingStep;
  stepBtn.disabled = !game.aiManualStepMode || !canStep || game.aiAutoPlayPaused;
}

function setAIStepMode(enabled) {
  game.aiManualStepMode = Boolean(enabled);
  game.aiPendingStep = game.aiManualStepMode && game.aiAutoPlayEnabled && game.currentPlayer?.aiPlayer;
  game.aiPendingAdvance = false;
  clearAIAutoPlayTimer();
  updateAIStepButton();
}

function pauseAIAutoPlay() {
  game.aiAutoPlayPaused = true;
  clearAIAutoPlayTimer();
  updateAIPauseButton();
  TRTlog("AI Auto-Play PAUSED");
}

function resumeAIAutoPlay() {
  game.aiAutoPlayPaused = false;
  updateAIPauseButton();
  updateAIStepButton();
  TRTlog("AI Auto-Play RESUMED");
  if (game.aiAutoPlayEnabled && !game.aiAutoPlayPaused && game.currentPlayer && game.currentPlayer.aiPlayer) {
    scheduleAITurn(500);
  }
}

function bindVisibilityPauseHandler() {
  if (game.aiVisibilityHandlerBound) return;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (game.aiAutoPlayEnabled && !game.aiAutoPlayPaused) {
        game.aiAutoPlayAutoPaused = true;
        pauseAIAutoPlay();
      }
    } else if (game.aiAutoPlayAutoPaused) {
      game.aiAutoPlayAutoPaused = false;
      updateAIPauseButton();
      updateAIStepButton();
    }
  });
  game.aiVisibilityHandlerBound = true;
}

// ===== PHASE 5: CARD DISPLAY & HAND MANAGEMENT (moved from main.js) =====

function getCardImageEl(cardEl) {
  return cardEl ? cardEl.querySelector("img") : null;
}

function isCardMeldSelected(cardEl) {
  return Boolean(cardEl && cardEl.dataset.meldSelected === "1");
}

function setCardMeldSelection(cardEl, selected) {
  if (!cardEl) return;
  cardEl.style.border = "";
  const imgEl = getCardImageEl(cardEl);
  if (imgEl) {
    imgEl.style.border = selected ? game.meldingColour : "";
  }
  if (selected) cardEl.dataset.meldSelected = "1";
  else delete cardEl.dataset.meldSelected;
}

function clearMeldSuggestions(player = game.currentPlayer) {
  if (!player) return;
  const els = document.querySelectorAll("." + player.id + "card");
  els.forEach((el) => {
    if (el?.dataset?.suggestedMeld !== "1") return;
    delete el.dataset.suggestedMeld;
    if (isCardMeldSelected(el) || el?.dataset?.melded === "1") return;
    const imgEl = getCardImageEl(el);
    if (imgEl) imgEl.style.border = "";
  });
}

function applyHumanMeldSuggestions(player = game.currentPlayer) {
  clearMeldSuggestions(player);
  if (!game.optMeldHint || !player || player.aiPlayer || game.humanAutoMeldEnabled) {
    if (game.DEBUG || game.TRACE) {
      TRTlog(
        `[applyHumanMeldSuggestions] Skipped: optMeldHint=${Boolean(game.optMeldHint)}, player=${player?.name || "unknown"}, aiPlayer=${Boolean(player?.aiPlayer)}`,
      );
    }
    return;
  }
  if (!hasPlayerDrawnThisTurn(player)) {
    if (game.DEBUG || game.TRACE) {
      TRTlog(`[applyHumanMeldSuggestions] Skipped: ${player.name} has not drawn this turn yet.`);
    }
    return;
  }
  if (!window.AIMeldPlanner || typeof window.AIMeldPlanner.findPossibleMelds !== "function") {
    if (game.DEBUG || game.TRACE) {
      TRTlog("[applyHumanMeldSuggestions] Skipped: AIMeldPlanner unavailable.");
    }
    return;
  }

  const wildRank = game.roundNumber + 2;
  const possibleMelds = window.AIMeldPlanner.findPossibleMelds(player.hand, wildRank);
  if (!Array.isArray(possibleMelds) || possibleMelds.length === 0) {
    if (game.DEBUG || game.TRACE) {
      TRTlog(`[applyHumanMeldSuggestions] No possible melds for ${player.name}.`);
    }
    return;
  }

  const bestMeld = window.AIMeldPlanner.selectBestMeld(possibleMelds, wildRank);
  if (!bestMeld || !Array.isArray(bestMeld.indices)) {
    if (game.DEBUG || game.TRACE) {
      TRTlog(`[applyHumanMeldSuggestions] No best meld selected for ${player.name}.`);
    }
    return;
  }

  const meldedCount = getMeldedCardCount(player);
  bestMeld.indices.forEach((idx) => {
    const domCardIndex = idx + 1 + meldedCount;
    const cardEl = document.getElementById(player.id + "card" + domCardIndex);
    if (!cardEl) return;
    cardEl.dataset.suggestedMeld = "1";
    if (isCardMeldSelected(cardEl) || cardEl?.dataset?.melded === "1") return;
    const imgEl = getCardImageEl(cardEl);
   // if (imgEl) imgEl.style.border = "3px dashed #f5c542";
    if (imgEl) imgEl.style.border = "6px solid blue";
  });
}

function selectMeldCard(cardEl) {
  // Already-played meld cards are not selectable; only cards in hand can be selected.
  if (cardEl?.dataset?.melded === "1") return;
  if (!isCardMeldSelected(cardEl)) {
    setCardMeldSelection(cardEl, true);
    game.currentPlayer.meldCount += 1;
  } else {
    // deselect
    setCardMeldSelection(cardEl, false);
    game.currentPlayer.meldCount -= 1;
  }

}

function displayCard(card, cardId, mode) {
  if (!card) {
    console.warn("[displayCard] Skipping undefined card for", cardId);
    return;
  }
  let cardImg = document.createElement("img");
  cardImg.alt = card.rank + "-" + card.suit;
  cardImg.width = game.cardWidth;
  cardImg.height = game.cardHeight;
  const persistentBorder = String(card.styleBorder || "");
  if (persistentBorder) {
    cardImg.style.setProperty("border", persistentBorder, "important");
  } else {
    cardImg.style.border = "";
  }
  cardImg.src = "./cards/" + card.rank + "_of_" + card.suit + ".png";
  if (mode === "meld" && !persistentBorder){
    cardImg.style.border = ""
  //  cardImg.style.border = game.meldingColour;
  }
  let existingEl = document.getElementById(cardId);
  if (existingEl) {
    existingEl.innerText = "";
    existingEl.append(cardImg);
  } else {
    showMessage(cardId + " element error: " + card.rank + ": " + card.suit + " " +  cardId);
  }
}

function updateDeckAndDiscardDisplay() {
  // Deck pile (face down)
  if (typeof displayCardBack === "function") {
    displayCardBack("deck-card");
  }
  const deckCountEl = document.getElementById("deck-count");
  if (deckCountEl) {
    deckCountEl.textContent = game.deck.cards.length;
  }
  // Add click listener to deck pile for drawing
  const deckCardEl = document.getElementById("deck-card");
  if (deckCardEl && !deckCardEl.listenerAdded) {
    deckCardEl.addEventListener("click", function() {
      if (typeof drawFromDeck === "function") drawFromDeck();
    });
    deckCardEl.listenerAdded = true;
  }
  // Discard pile (face up)
  const discardCardEl = document.getElementById("discard-card");
  if (discardCardEl) {
    discardCardEl.innerText = "";
    if (game.discardPile.length > 0) {
      displayCard(game.discardPile[game.discardPile.length - 1], "discard-card", "discard");
    }
  }
  const discardCountEl = document.getElementById("discard-count");
  if (discardCountEl) {
    discardCountEl.textContent = game.discardPile.length;
  }
}

function getMeldedCardCount(player) {
  let count = 0;
  if (Array.isArray(player.meldSets)) {
    player.meldSets.forEach((meld) => {
      if (Array.isArray(meld)) count += meld.length;
    });
  }
  return count;
}

function addHandCardListeners() {
  
  document.addEventListener("click", function handleClick(event) {
    game.meldingColour = "6px solid blue";
    const cardEl = event.target.closest(".p1card, .p2card, .p3card");
    if (!cardEl) return;
    // hand click
    const cardClass = Array.from(cardEl.classList).find((cls) =>
      /^p\d+card$/.test(cls),
    );
    if (!cardClass) return;

    TRTlog("box clicked", cardEl.id, game.currentPlayer.id);
    TRTlog("Image Source:", cardEl.className);

    if (cardEl.id.substring(0,6)  === "player")
      {
      const playerId = cardClass.substring(0, 2); // e.g., "p1"
      for (let idx = 0; idx < game.players.length; idx++) {
        if (game.players[idx].id === playerId) {
          game.players[idx].aiPlayer = !game.players[idx].aiPlayer;
          updateHumanAIFlag()
          return;
          }
        }
      }    
  else 
    {    
    // reject if not current player's hand
   
    if (!game.currentPlayer || !cardEl.classList.contains(game.currentPlayer.id + "card")) return;
    processPlayerHandCardClick(cardEl)
   }
  })
}

function discardCardSelected(cardEl) {
    
      // discarding selectecd card from hand 
      let ElementId = cardEl.id;
      let cardIndex = ElementId.substring(6);
      let cardIndexInt = Number(cardIndex) - 1;
      let handIndex = Number(cardEl?.dataset?.handIndex);
      if (!Number.isInteger(handIndex)) {
        handIndex = cardIndexInt - getMeldedCardCount(game.currentPlayer);
      }
      const selectedCard = game.currentPlayer.hand[handIndex];
      
      // check if trying to discard wild card if option is selected, warn player that he is discarding a wild card which the next player will probaly appreciate, and ask for confirmation

      const wildRank = String(game.roundNumber + 2);
      const isWild =
        selectedCard?.rank === "jester" || selectedCard?.rank === wildRank;
      if (isWild && game.finalTurn && game.warnWildDiscardLastTurn) {
        if (!confirm("Warning: You are discarding a wild card on the final turn. Continue?")) return;
      } else if (isWild && !game.finalTurn && game.warnWildDiscard) {
        if (!confirm("Are you sure that you want to discard a wild card?")) return;
      }

        // discard selected card from hand to discard pile
        clearMeldSuggestions(game.currentPlayer);
        let xCard = game.currentPlayer.hand.splice(handIndex, 1)[0];
        showMessage(xCard.rank + " of " + xCard.suit + " discarded.");
        renderPlayerHand(game.currentPlayer);
       // game.discardPile.push(xCard);
        dropDiscardCard(xCard)
        updateDisplay()
        displayCard(xCard, "discard-card", "discard" );

        if (game.currentPlayer.hand.length === 0) {
          TRTlog(`[discardCardSelected] *** PLAYER GOING OUT *** ${game.currentPlayer.name} has no cards left!`);
          PlayerHandBlinkOn("." + game.currentPlayer.id + "card");
          game.currentPlayer.IsOut = true;
          game.finalTurn = true;
          TRTlog(`[discardCardSelected] Set IsOut=true, finalTurn=true for ${game.currentPlayer.name}`)
      
          if (!game.currentPlayer.aiPlayer) 
            alert(game.currentPlayer.name + " you have gone out!");
          }
         advanceTurn();
      }

function processPlayerHandCardClick(cardEl){
  // process hand card click - either melding or discarding depending on current mode
  if (!requireDrawBeforeAction("playing a card")) return;

  if (game.currentPlayer.melding) {
    selectMeldCard(cardEl);
    // Selection only; explicit commit remains on the Meld button.
    return;
  }

  // If user leaves meld mode with leftover selections, clear stale highlights first.
  clearSelectedMeldHighlights(game.currentPlayer);
  discardCardSelected(cardEl);
}

function clearSelectedMeldHighlights(player) {
  if (!player) return;
  clearMeldSuggestions(player);
  const els = document.querySelectorAll("." + player.id + "card");
  els.forEach((el) => {
    if (isCardMeldSelected(el)) {
      setCardMeldSelection(el, false);
    }
  });
  player.meldCount = 0;
}
  
function resetAIMeldSelection(aiPlayer) {
  const meldedCount = getMeldedCardCount(aiPlayer);
  for (let i = meldedCount + 1; i <= 12; i++) {
    const el = document.getElementById(`${aiPlayer.id}card${i}`);
    if (isCardMeldSelected(el)) {
      setCardMeldSelection(el, false);
    }
  }
  aiPlayer.meldCount = 0;
  aiPlayer.melding = false;
}

function countAIMarkedCards(aiPlayer) {
  const meldedCount = getMeldedCardCount(aiPlayer);
  let count = 0;
  for (let i = meldedCount + 1; i <= 12; i++) {
    const el = document.getElementById(`${aiPlayer.id}card${i}`);
    if (isCardMeldSelected(el)) count += 1;
  }
  return count;
}

function discardFromHand(player, handIndex, options = {}) {
  const isFinalTurn = Boolean(options.isFinalTurn);
  const selectedCard = player.hand[handIndex];
  if (!selectedCard) return false;

  const wildRank = String(game.roundNumber + 2);
  const hasNonWild = player.hand.some(
    (card) => card.rank !== "jester" && card.rank !== wildRank,
  );
  const isLastCard = player.hand.length === 1;
  const isWild =
    selectedCard?.rank === "jester" || selectedCard?.rank === wildRank;
  if (isWild && playerWhoWentOut === -1 && hasNonWild && !isFinalTurn && !isLastCard) {
    if (!player.aiPlayer) {
      alert("You cannot discard a wild card until the final turn phase begins.");
    }
    return false;
  }

  const meldedCount = getMeldedCardCount(player);
  const totalCards = meldedCount + player.hand.length;
  if (player.hand.length === 1 && totalCards < game.cardsDealt) {
    if (!player.aiPlayer) {
      alert("You must meld all cards before discarding your last card.");
    }
    TRTlog(`[Discard Check] ${player.name} cannot go out: melded=${meldedCount}, hand=${player.hand.length}, total=${totalCards}, required=${game.cardsDealt}`);
    return false;
  }

  const xCard = player.hand.splice(handIndex, 1)[0];
  showMessage(xCard.rank + " of " + xCard.suit + " discarded.");
  renderPlayerHand(player);
  game.discardPile.push(xCard);
  updateDisplay();
  player.lastDrawnCard = null;
  player.lastDrawnSource = null;
  displayCard(xCard, "discard-card", "discard");

  if (player.hand.length === 0) {
    TRTlog(`[discardFromHand] *** PLAYER GOING OUT *** ${player.name} has no cards left!`);
    player.IsOut = true;
    game.finalTurn = true;
    TRTlog(`[discardFromHand] Set IsOut=true, finalTurn=true for ${player.name}`);
    
    if (!player.aiPlayer) {
      alert(player.name + " you have gone out!");
    }
  }
  advanceTurn();
}

function getSelectedMeldCards(player) {
  const selectedCards = [];
  const meldedCount = getMeldedCardCount(player);
  const els = document.querySelectorAll("." + player.id + "card");
  els.forEach((el) => {
    const cardEl = document.getElementById(el.id);
    if (isCardMeldSelected(cardEl)) {
      let handIndex = Number(cardEl?.dataset?.handIndex);
      if (!Number.isInteger(handIndex)) {
        const cardIndexInt = Number(cardEl.id.substring(6)) - 1;
        handIndex = cardIndexInt - meldedCount;
      }
      if (handIndex >= 0 && handIndex < player.hand.length) {
        const card = player.hand[handIndex];
        if (card && player.hand.includes(card)) {
          selectedCards.push(card);
        } else {
          console.warn(
            `[Meld] Skipping invalid card (inHand: ${player.hand.includes(card)})`,
            card?.rank,
            card?.suit,
          );
        }
      }
    }
  });
  return selectedCards;
}

function renderAllGameState() {
  // Render all player hands using the hand property
  if (game) {
    logInPlayers()
    for (let p of game.players) {
      renderPlayerHand(p);
    }
  }

  // Render deck back
  if (typeof updateDeckAndDiscardDisplay === "function") {
    updateDeckAndDiscardDisplay();
  }
}

//  produce log of all cards in hand and melds for a player, for debugging purposes
function TRTlog(msg) 
{
  console.log(msg)
}