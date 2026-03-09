let equipe = null;
let toutesLesDonnees = [];
let realtimeChannel = null;
let lastStatsSnapshot = {
  bureauxComplets: "",
  top100: 0,
  participation: ""
};

const TOTAL_INSCRITS_TASSIN = 15278;
const NB_BUREAUX = 15;
const INSCRITS_PAR_BUREAU = Math.round(TOTAL_INSCRITS_TASSIN / NB_BUREAUX);

const TEAMS = {
  1: {
    name: "Yohann Hachani",
    short: "YH",
    color: "#0A84FF",
    image: "images/hachani.jpg",
    subtitle: "Équipe 1"
  },
  2: {
    name: "Pascal Charmot",
    short: "PC",
    color: "#34C759",
    image: "images/charmot.jpg",
    subtitle: "Équipe 2"
  },
  3: {
    name: "Julien Ranc",
    short: "JR",
    color: "#FF9F0A",
    image: "images/ranc.jpg",
    subtitle: "Équipe 3"
  }
};

const PARTICIPATION_SLOTS = [
  { key: "10h", hour: 10, label: "10h", css: "slot-10" },
  { key: "12h", hour: 12, label: "12h", css: "slot-12" },
  { key: "15h", hour: 15, label: "15h", css: "slot-15" },
  { key: "19h", hour: 19, label: "19h", css: "slot-19" }
];

function showToast(text, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.style.background = isError
    ? "rgba(185, 28, 28, 0.94)"
    : "rgba(28, 28, 30, 0.92)";
  toast.classList.add("show");

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function getTeam(teamId) {
  return TEAMS[teamId];
}

function teamAvatarHtml(teamId, size = "small") {
  const team = getTeam(teamId);
  const clsMap = {
    small: ["score-avatar", "score-avatar-fallback"],
    rank: ["rank-avatar", "rank-avatar-fallback"],
    bar: ["bar-avatar", "bar-avatar-fallback"],
    big: ["team-avatar", "team-avatar-fallback"]
  };
  const [imgClass, fallbackClass] = clsMap[size];

  return `
    <img
      src="${team.image}"
      alt="${team.name}"
      class="${imgClass}"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"
    />
    <span class="${fallbackClass}" style="display:none; background:${team.color};">${team.short}</span>
  `;
}

function renderTeamButtons() {
  [1, 2, 3].forEach((id) => {
    const team = getTeam(id);
    const btn = document.getElementById(`team-${id}`);
    if (!btn) return;

    btn.innerHTML = `
      ${teamAvatarHtml(id, "big")}
      <span class="team-meta">
        <span class="team-name">${team.name}</span>
        <span class="team-sub">${team.subtitle}</span>
      </span>
    `;
  });
}

function setEquipe(e) {
  equipe = e;
  document.querySelectorAll(".team-grid .segment-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  const btn = document.getElementById("team-" + e);
  if (btn) btn.classList.add("active");
}

function formatLastUpdate(source = "live") {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const prefix = source === "manual" ? "Actualisé à" : "Live à";
  document.getElementById("last-update").textContent = `${prefix} ${hh}:${mm}:${ss}`;
}

function filtreBureauActuel() {
  return document.getElementById("filtre-bureau").value;
}

function appliquerFiltre(data) {
  const filtre = filtreBureauActuel();
  if (filtre === "TOUS") return data;
  return data.filter((row) => row.bureau === filtre);
}

function getTop100TotalForBureau(bureau) {
  return toutesLesDonnees
    .filter((row) => row.phase === "top100" && row.bureau === bureau)
    .reduce((sum, row) => sum + (Number(row.rang) || 0), 0);
}

function updateTop100Info() {
  const bureau = document.getElementById("bureau").value;
  const total = getTop100TotalForBureau(bureau);
  const reste = 100 - total;
  const info = document.getElementById("top100-info");

  if (reste <= 0) {
    info.textContent = `${bureau} : les 100 premiers sont complets (100 / 100).`;
  } else {
    info.textContent = `${bureau} : ${total} / 100 saisis — il reste ${reste} personne(s).`;
  }
}

async function envoyer() {
  const bureau = document.getElementById("bureau").value;
  const nombre = parseInt(document.getElementById("rang").value, 10);
  const phase = "top100";

  if (!bureau) {
    showToast("Choisis un bureau.", true);
    return;
  }

  if (!equipe) {
    showToast("Choisis une équipe.", true);
    return;
  }

  if (!nombre || nombre < 1) {
    showToast("Entre un nombre valide.", true);
    return;
  }

  const totalActuel = getTop100TotalForBureau(bureau);

  if (totalActuel >= 100) {
    showToast(`${bureau} a déjà atteint 100 / 100.`, true);
    updateTop100Info();
    return;
  }

  if (totalActuel + nombre > 100) {
    const reste = 100 - totalActuel;
    showToast(`Impossible : tu peux ajouter au maximum ${reste}.`, true);
    updateTop100Info();
    return;
  }

  const { error } = await window.supabaseClient.from("passages").insert([
    {
      bureau,
      equipe,
      rang: nombre,
      phase
    }
  ]);

  if (error) {
    console.error(error);
    showToast("Erreur lors de l’enregistrement.", true);
    return;
  }

  document.getElementById("rang").value = "";
  showToast("Enregistré");
}

function aggregateByTeam(data) {
  const scores = { 1: 0, 2: 0, 3: 0 };
  data.forEach((row) => {
    scores[row.equipe] = (scores[row.equipe] || 0) + (Number(row.rang) || 0);
  });
  return scores;
}

function aggregateByBureau(data) {
  const bureaux = {};

  data.forEach((row) => {
    if (!bureaux[row.bureau]) {
      bureaux[row.bureau] = { 1: 0, 2: 0, 3: 0, total: 0 };
    }

    const valeur = Number(row.rang) || 0;
    bureaux[row.bureau][row.equipe] += valeur;
    bureaux[row.bureau].total += valeur;
  });

  return bureaux;
}

function animateNumber(el, newValue, suffix = "") {
  const oldValue = parseInt((el.dataset.value || "0"), 10);
  if (oldValue === newValue) {
    el.textContent = `${newValue}${suffix}`;
    return;
  }

  const duration = 350;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const current = Math.round(oldValue + (newValue - oldValue) * progress);
    el.textContent = `${current}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.dataset.value = String(newValue);
    }
  }

  requestAnimationFrame(step);
}

function formatPercent(value) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function renderHeroStats() {
  const top100Data = toutesLesDonnees.filter((row) => row.phase === "top100");
  const top100Total = top100Data.reduce((sum, row) => sum + (Number(row.rang) || 0), 0);

  const top100Bureaux = aggregateByBureau(top100Data);
  const nbComplets = Object.values(top100Bureaux).filter((b) => b.total >= 100).length;
  const bureauxText = `${nbComplets} / 15`;

  const participationGlobale = (top100Total / TOTAL_INSCRITS_TASSIN) * 100;
  const participationText = formatPercent(participationGlobale);

  const bureauxEl = document.getElementById("stat-bureaux");
  const top100El = document.getElementById("stat-top100");
  const participationEl = document.getElementById("stat-participation");

  if (lastStatsSnapshot.bureauxComplets !== bureauxText) {
    bureauxEl.textContent = bureauxText;
    lastStatsSnapshot.bureauxComplets = bureauxText;
  }

  animateNumber(top100El, top100Total);

  if (lastStatsSnapshot.participation !== participationText) {
    participationEl.textContent = participationText;
    lastStatsSnapshot.participation = participationText;
  }
}

function renderScoreCards(scores) {
  const target = document.getElementById("score-cards");
  target.innerHTML = `
    <div class="score-card">
      <div class="score-name-wrap">
        ${teamAvatarHtml(1, "small")}
        <span class="score-name">${TEAMS[1].name}</span>
      </div>
      <span class="score-value">${scores[1]}</span>
    </div>
    <div class="score-card">
      <div class="score-name-wrap">
        ${teamAvatarHtml(2, "small")}
        <span class="score-name">${TEAMS[2].name}</span>
      </div>
      <span class="score-value">${scores[2]}</span>
    </div>
    <div class="score-card">
      <div class="score-name-wrap">
        ${teamAvatarHtml(3, "small")}
        <span class="score-name">${TEAMS[3].name}</span>
      </div>
      <span class="score-value">${scores[3]}</span>
    </div>
  `;
}

function renderRanking(scores) {
  const target = document.getElementById("classement-principal");

  const ranking = [
    { equipe: 1, score: scores[1] || 0 },
    { equipe: 2, score: scores[2] || 0 },
    { equipe: 3, score: scores[3] || 0 }
  ].sort((a, b) => b.score - a.score);

  const first = ranking[0];
  const second = ranking[1];
  const third = ranking[2];
  const ecart = Math.max(0, first.score - second.score);

  target.innerHTML = `
    <div class="rank-card">
      <div class="rank-top">
        <div class="rank-name-wrap">
          ${teamAvatarHtml(first.equipe, "rank")}
          <div class="rank-title">1er : ${TEAMS[first.equipe].name}</div>
        </div>
        <div class="rank-score">${first.score}</div>
      </div>
    </div>
    <div class="rank-card">
      <div class="rank-top">
        <div class="rank-name-wrap">
          ${teamAvatarHtml(second.equipe, "rank")}
          <div class="rank-title">2e : ${TEAMS[second.equipe].name}</div>
        </div>
        <div class="rank-score">${second.score}</div>
      </div>
    </div>
    <div class="rank-card">
      <div class="rank-top">
        <div class="rank-name-wrap">
          ${teamAvatarHtml(third.equipe, "rank")}
          <div class="rank-title">3e : ${TEAMS[third.equipe].name}</div>
        </div>
        <div class="rank-score">${third.score}</div>
      </div>
      <div class="rank-sub">${TEAMS[first.equipe].name} a ${ecart} personne(s) d’avance sur ${TEAMS[second.equipe].name}</div>
    </div>
  `;
}

function renderBars(scores) {
  const target = document.getElementById("main-bars");
  const max = Math.max(scores[1], scores[2], scores[3], 1);

  function row(teamId, value) {
    const width = Math.round((value / max) * 100);
    return `
      <div class="bar-row">
        <div class="bar-head">
          <div class="bar-head-left">
            ${teamAvatarHtml(teamId, "bar")}
            <span>${TEAMS[teamId].name}</span>
          </div>
          <span>${value}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${width}%; background:linear-gradient(90deg, ${TEAMS[teamId].color}, ${TEAMS[teamId].color}cc);"></div>
        </div>
      </div>
    `;
  }

  target.innerHTML = `
    ${row(1, scores[1])}
    ${row(2, scores[2])}
    ${row(3, scores[3])}
  `;
}

function renderTable(data) {
  const target = document.getElementById("table-main");
  const bureaux = aggregateByBureau(data);
  const noms = Object.keys(bureaux).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ""), 10);
    const nb = parseInt(b.replace(/\D/g, ""), 10);
    return na - nb;
  });

  if (!noms.length) {
    target.innerHTML = "<p class='muted'>Aucune donnée.</p>";
    return;
  }

  let rows = "";

  noms.forEach((bureau) => {
    const item = bureaux[bureau];
    const totalText = `${item.total} / 100`;
    const statusHtml = item.total >= 100
      ? `<span class="status-pill status-ok">Complet</span>`
      : `<span class="status-pill status-wait">Reste ${100 - item.total}</span>`;

    rows += `
      <tr>
        <td>${bureau}</td>
        <td>${item[1]}</td>
        <td>${item[2]}</td>
        <td>${item[3]}</td>
        <td class="total-cell">${totalText}</td>
        <td>${statusHtml}</td>
      </tr>
    `;
  });

  target.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Bureau</th>
            <th>${TEAMS[1].short}</th>
            <th>${TEAMS[2].short}</th>
            <th>${TEAMS[3].short}</th>
            <th>Total</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderHistorique() {
  const target = document.getElementById("historique");
  const recent = [...toutesLesDonnees].sort((a, b) => b.id - a.id).slice(0, 10);

  if (!recent.length) {
    target.innerHTML = "<p class='muted'>Aucune saisie pour le moment.</p>";
    return;
  }

  target.innerHTML = `
    <div class="history-list">
      ${recent.map((row) => `
        <div class="history-item">
          <div class="history-line">${row.bureau} — ${TEAMS[row.equipe].name} — ${row.rang}</div>
          <div class="history-meta">100 premiers · ID ${row.id}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function extractHour(dateString) {
  const d = new Date(dateString);
  return d.getHours();
}

function sumUntilHour(data, hourLimit) {
  return data
    .filter((row) => extractHour(row.created_at) < hourLimit)
    .reduce((sum, row) => sum + (Number(row.rang) || 0), 0);
}

function computeGlobalParticipationPoints(data) {
  return PARTICIPATION_SLOTS.map((slot) => {
    const cumul = sumUntilHour(data, slot.hour);
    const rate = (cumul / TOTAL_INSCRITS_TASSIN) * 100;
    return {
      key: slot.key,
      label: slot.label,
      css: slot.css,
      cumul,
      rate
    };
  });
}

function computeBureauParticipationPoints(data) {
  const bureaux = {};
  for (let i = 1; i <= NB_BUREAUX; i++) {
    bureaux[`Bureau ${i}`] = [];
  }

  Object.keys(bureaux).forEach((bureau) => {
    const bureauData = data.filter((row) => row.bureau === bureau);
    bureaux[bureau] = PARTICIPATION_SLOTS.map((slot) => {
      const cumul = sumUntilHour(bureauData, slot.hour);
      const rate = (cumul / INSCRITS_PAR_BUREAU) * 100;
      return {
        key: slot.key,
        label: slot.label,
        css: slot.css,
        cumul,
        rate
      };
    });
  });

  return bureaux;
}

function renderParticipationGlobal(data) {
  const target = document.getElementById("participation-global");
  const points = computeGlobalParticipationPoints(data);
  const max = Math.max(...points.map((p) => p.rate), 1);

  target.innerHTML = points.map((point) => {
    const height = Math.max(6, Math.round((point.rate / max) * 180));
    return `
      <div class="vertical-bar-col">
        <div class="vertical-value">${formatPercent(point.rate)}</div>
        <div class="vertical-bar-wrap">
          <div class="vertical-bar ${point.css}" style="height:${height}px;"></div>
        </div>
        <div class="vertical-label">${point.label}</div>
      </div>
    `;
  }).join("");
}

function renderParticipationBureaux(data) {
  const target = document.getElementById("participation-bureaux");
  const bureaux = computeBureauParticipationPoints(data);

  target.innerHTML = Object.keys(bureaux).map((bureau) => {
    const points = bureaux[bureau];
    const max = Math.max(...points.map((p) => p.rate), 1);

    return `
      <div class="bureau-row">
        <div class="bureau-name">${bureau}</div>
        <div class="bureau-bars">
          ${points.map((point) => {
            const height = Math.max(5, Math.round((point.rate / max) * 82));
            return `
              <div class="bureau-bar-col">
                <div class="bureau-bar-value">${point.rate.toFixed(1).replace(".", ",")}%</div>
                <div class="bureau-bar-wrap">
                  <div class="bureau-bar ${point.css}" style="height:${height}px;"></div>
                </div>
                <div class="bureau-bar-label">${point.label}</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function renderAll() {
  renderHeroStats();

  const dataFiltrees = appliquerFiltre(toutesLesDonnees);
  const scores = aggregateByTeam(dataFiltrees);

  renderScoreCards(scores);
  renderRanking(scores);
  renderBars(scores);
  renderTable(dataFiltrees);
  renderParticipationGlobal(toutesLesDonnees);
  renderParticipationBureaux(toutesLesDonnees);
  renderHistorique();
  updateTop100Info();
}

async function chargerDonnees(showManualToast = false, source = "manual") {
  const { data, error } = await window.supabaseClient
    .from("passages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    showToast("Impossible de charger les résultats.", true);
    return;
  }

  toutesLesDonnees = (data || []).filter((row) => row.phase === "top100");
  renderAll();
  formatLastUpdate(source);

  if (showManualToast) {
    showToast("Résultats actualisés");
  }
}

function setupRealtime() {
  if (realtimeChannel) {
    window.supabaseClient.removeChannel(realtimeChannel);
  }

  realtimeChannel = window.supabaseClient
    .channel("passages-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "passages"
      },
      async () => {
        await chargerDonnees(false, "live");
      }
    )
    .subscribe((status) => {
      console.log("Realtime status:", status);
      if (status === "SUBSCRIBED") {
        showToast("Temps réel activé");
      }
    });
}

async function annulerDerniereSaisie() {
  const ok = confirm("Annuler la dernière saisie ?");
  if (!ok) return;

  const { data, error } = await window.supabaseClient
    .from("passages")
    .select("id")
    .eq("phase", "top100")
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    showToast("Impossible de récupérer la dernière saisie.", true);
    return;
  }

  if (!data || !data.length) {
    showToast("Aucune saisie à annuler.", true);
    return;
  }

  const lastId = data[0].id;

  const { error: deleteError } = await window.supabaseClient
    .from("passages")
    .delete()
    .eq("id", lastId);

  if (deleteError) {
    console.error(deleteError);
    showToast("Suppression impossible. Vérifie la policy DELETE.", true);
    return;
  }

  showToast(`Dernière saisie annulée (ID ${lastId})`);
}

function toCsvLine(values) {
  return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
}

function exporterCSV() {
  if (!toutesLesDonnees.length) {
    showToast("Aucune donnée à exporter.", true);
    return;
  }

  const rows = [
    ["id", "bureau", "equipe", "rang", "phase", "created_at"],
    ...toutesLesDonnees.map((row) => [row.id, row.bureau, row.equipe, row.rang, row.phase, row.created_at])
  ];

  const csv = rows.map(toCsvLine).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "comptabilisation-course-tassin.csv";
  a.click();

  URL.revokeObjectURL(url);
  showToast("Export CSV généré");
}

async function copierResume() {
  const dataFiltrees = appliquerFiltre(toutesLesDonnees);
  const scores = aggregateByTeam(dataFiltrees);
  const participationPoints = computeGlobalParticipationPoints(toutesLesDonnees);
  const filtre = filtreBureauActuel();

  const texte = [
    `Résumé - ${filtre === "TOUS" ? "Tous les bureaux" : filtre}`,
    ``,
    `100 premiers`,
    `${TEAMS[1].name} : ${scores[1]}`,
    `${TEAMS[2].name} : ${scores[2]}`,
    `${TEAMS[3].name} : ${scores[3]}`,
    ``,
    `Participation globale`,
    `10h : ${formatPercent(participationPoints[0].rate)}`,
    `12h : ${formatPercent(participationPoints[1].rate)}`,
    `15h : ${formatPercent(participationPoints[2].rate)}`,
    `19h : ${formatPercent(participationPoints[3].rate)}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(texte);
    showToast("Résumé copié");
  } catch (e) {
    console.error(e);
    showToast("Impossible de copier automatiquement.", true);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  renderTeamButtons();

  document.getElementById("bureau").addEventListener("change", updateTop100Info);
  document.getElementById("filtre-bureau").addEventListener("change", renderAll);

  await chargerDonnees(false, "manual");
  setupRealtime();
});