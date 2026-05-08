const MINIGAMES = [
  { id: "snake", name: "Snake", emoji: "🐍", desc: "Classic snake — eat, grow, survive!", bg: "#22c55e" },
  { id: "tictactoe", name: "Tic Tac Toe", emoji: "⭕", desc: "Play vs a friend or the AI!", bg: "#7c3aed" },
  { id: "memory", name: "Memory Match", emoji: "🃏", desc: "Flip the cards and find the pairs.", bg: "#e91e8c" },
  { id: "breakout", name: "Breakout", emoji: "🧱", desc: "Smash bricks with a bouncing ball.", bg: "#f59e0b" },
  { id: "wordle", name: "Word Guess", emoji: "📝", desc: "Guess the 5-letter word in 6 tries.", bg: "#2563eb" },
];

window.PageMinigames = {
  async render(area) {
    area.innerHTML = `
      <div style="max-width:600px;margin:0 auto">
        <h2 style="font-size:22px;font-weight:800;margin-bottom:20px">🎮 Mini Games</h2>
        <div id="game-frame" style="display:none;margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <button class="btn btn-ghost btn-sm" id="back-to-games">← Back</button>
            <span id="game-title" style="font-weight:700;font-size:16px"></span>
          </div>
          <div class="card" style="overflow:hidden">
            <iframe id="game-iframe" style="width:100%;height:520px;border:none;display:block" src=""></iframe>
          </div>
        </div>
        <div id="games-list">
          ${MINIGAMES.map(g => `
            <div class="minigame-item" data-game="${g.id}">
              <div class="minigame-icon" style="background:${g.bg}22;color:${g.bg}">${g.emoji}</div>
              <div style="flex:1">
                <div style="font-weight:700;font-size:15px">${g.name}</div>
                <div style="font-size:13px;color:var(--text-muted)">${g.desc}</div>
              </div>
              <button class="btn btn-primary btn-sm" data-game="${g.id}" style="background:${g.bg}">Play</button>
            </div>`).join("")}
        </div>
      </div>`;

    function launchGame(id) {
      const g = MINIGAMES.find(x => x.id === id);
      if (!g) return;
      document.getElementById("games-list").style.display = "none";
      document.getElementById("game-frame").style.display = "block";
      document.getElementById("game-title").textContent = g.emoji + " " + g.name;
      document.getElementById("game-iframe").src = `minigames/${id}/index.html`;
    }

    area.querySelectorAll("[data-game]").forEach(el => {
      el.addEventListener("click", function() { launchGame(this.dataset.game); });
    });
    document.getElementById("back-to-games").addEventListener("click", () => {
      document.getElementById("game-iframe").src = "";
      document.getElementById("game-frame").style.display = "none";
      document.getElementById("games-list").style.display = "block";
    });
  }
};