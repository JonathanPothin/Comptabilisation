let equipe = null;
let toutesLesDonnees = [];
let currentView = "top100";
let realtimeChannel = null;
let lastStatsSnapshot = {
  bureauxComplets: "",
  top100: 0,
  journee: 0
};

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

function setEquipe(e) {
  equipe = e;
  document.querySelectorAll(".team-grid .segment-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  const btn = document.getElementById("team-" + e);
  if (btn) btn.classList.add("active");
}

function setViewMode(mode) {
  currentView = mode;
  document.querySelectorAll(".view-segment .segment-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  const active = document.getElementById("view-" + mode);
  if (active) active.classList.add("active");
  renderAll();
}

function ajouterValeur(valeur) {
  const input = document.getElementById("rang");
  const current = parseInt(input.value || "0", 10);
  input.value = current + valeur;
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
  const phase = document.getElementById("phase").value;
  const info = document.getElementById("top100-info");

  if (phase !== "top100") {
    info.textContent = "Mode après les 100 : ces quantités s’ajoutent au total journée.";
    return;
  }

  const total = getTop100TotalForBureau(bureau);
  const reste = 100 - total;

  if (reste <= 0) {
    info.textContent = `${bureau} : les 100 premiers sont complets (100 / 100).`;
  } else {
    info.textContent = `${bureau} : ${total} / 100 saisis — il reste ${reste} personne(s).`;
  }
}

async function envoyer() {
  const bureau = document.getElementById("bureau").value;
  const nombre = parseInt(document.getElementById("rang").value, 10);
  const phase = document.getElementById("phase").value;

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

  if (phase === "top100") {
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
  }

  const { error } = await window.supabaseClient.from("passages").insert([
    { bureau, equipe, rang: nombre, phase }
  ]);

  if (error) {
    console.error(error);
    showToast("Erreur lors de l’enregistrement.", true);
    return;
  }

  document.getElementById("rang").value = "";
  showToast("Enregistré");
  // Pas besoin de reload manuel : Realtime prendra le relais
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

function getDatasets() {
  const dataFiltrees = appliquerFiltre(toutesLesDonnees);
  const top100 = dataFiltrees.filter((row) => row.phase === "top100");
  const apres100 = dataFiltrees.filter((row) => row.phase === "journee");
  const journee = [...top100, ...apres100];
  return { top100, apres100, journee };
}

function getCurrentDataset() {
  const { top100, apres100, journee } = getDatasets();

  if (currentView === "top100") {
    return { key: "top100", data: top100, scores: aggregateByTeam(top100) };
  }

  if (currentView === "apres100") {
    return { key: "apres100", data: apres100, scores: aggregateByTeam(apres100) };
  }

  return { key: "journee", data: journee, scores: aggregateByTeam(journee) };
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

function renderHeroStats() {
  const top100Data = toutesLesDonnees.filter((row) => row.phase === "top100");
  const journeeData = [...toutesLesDonnees];

  const top100Total = top100Data.reduce((sum, row) => sum + (Number(row.rang) || 0), 0);
  const journeeTotal = journeeData.reduce((sum, row) => sum + (Number(row.rang) || 0), 0);

  const top100Bureaux = aggregateByBureau(top100Data);
  const nbComplets = Object.values(top100Bureaux).filter((b) => b.total >= 100).length;

  const bureauxText = `${nbComplets} / 15`;

  const bureauxEl = document.getElementById("stat-bureaux");
  const top100El = document.getElementById("stat-top100");
  const journeeEl = document.getElementById("stat-journee");

  if (lastStatsSnapshot.bureauxComplets !== bureauxText) {
    bureauxEl.textContent = bureauxText;
    lastStatsSnapshot.bureauxComplets = bureauxText;
  }

  animateNumber(top100El, top100Total);
  animateNumber(journeeEl, journeeTotal);
}

function renderScoreCards(scores) {
  const target = document.getElementById("score-cards");
  target.innerHTML = `
    <div class="score-card"><span class="score-name">Équipe 1</span><span class="score-value">${scores[1]}</span></div>
    <div class="score-card"><span class="score-name">Équipe 2</span><span class="score-value">${scores[2]}</span></div>
    <div class="score-card"><span class="score-name">Équipe 3</span><span class="score-value">${scores[3]}</span></div>
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
      <div class="rank-top"><div class="rank-title">1er : Équipe ${first.equipe}</div><div class="rank-score">${first.score}</div></div>
    </div>
    <div class="rank-card">
      <div class="rank-top"><div class="rank-title">2e : Équipe ${second.equipe}</div><div class="rank-score">${second.score}</div></div>
    </div>
    <div class="rank-card">
      <div class="rank-top"><div class="rank-title">3e : Équipe ${third.equipe}</div><div class="rank-score">${third.score}</div></div>
      <div class="rank-sub">Équipe ${first.equipe} a ${ecart} personne(s) d’avance sur l’équipe ${second.equipe}</div>
    </div>
  `;
}

function renderBars(scores) {
  const target = document.getElementById("main-bars");
  const max = Math.max(scores[1], scores[2], scores[3], 1);

  function row(label, value) {
    const width = Math.round((value / max) * 100);
    return `
      <div class="bar-row">
        <div class="bar-head"><span>${label}</span><span>${value}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      </div>
    `;
  }

  target.innerHTML = `
    ${row("Équipe 1", scores[1])}
    ${row("Équipe 2", scores[2])}
    ${row("Équipe 3", scores[3])}
  `;
}

function renderTable(data, mode) {
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
    let statusHtml = `<span class="status-pill">—</span>`;
    let totalText = `${item.total}`;

    if (mode === "top100") {
      totalText = `${item.total} / 100`;
      if (item.total >= 100) {
        statusHtml = `<span class="status-pill status-ok">Complet</span>`;
      } else {
        statusHtml = `<span class="status-pill status-wait">Reste ${100 - item.total}</span>`;
      }
    }

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
            <th>Équipe 1</th>
            <th>Équipe 2</th>
            <th>Équipe 3</th>
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
          <div class="history-line">${row.bureau} — Équipe ${row.equipe} — ${row.rang}</div>
          <div class="history-meta">${row.phase === "top100" ? "100 premiers" : "Après les 100"} · ID ${row.id}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAll() {
  renderHeroStats();
  const current = getCurrentDataset();
  renderScoreCards(current.scores);
  renderRanking(current.scores);
  renderBars(current.scores);
  renderTable(current.data, current.key);
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

  toutesLesDonnees = data || [];
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
  const top100 = dataFiltrees.filter((row) => row.phase === "top100");
  const apres100 = dataFiltrees.filter((row) => row.phase === "journee");
  const journee = [...top100, ...apres100];

  const top100Scores = aggregateByTeam(top100);
  const apres100Scores = aggregateByTeam(apres100);
  const journeeScores = aggregateByTeam(journee);

  const filtre = filtreBureauActuel();

  const texte = [
    `Résumé - ${filtre === "TOUS" ? "Tous les bureaux" : filtre}`,
    ``,
    `100 premiers`,
    `Équipe 1 : ${top100Scores[1]}`,
    `Équipe 2 : ${top100Scores[2]}`,
    `Équipe 3 : ${top100Scores[3]}`,
    ``,
    `Après les 100`,
    `Équipe 1 : ${apres100Scores[1]}`,
    `Équipe 2 : ${apres100Scores[2]}`,
    `Équipe 3 : ${apres100Scores[3]}`,
    ``,
    `Total journée`,
    `Équipe 1 : ${journeeScores[1]}`,
    `Équipe 2 : ${journeeScores[2]}`,
    `Équipe 3 : ${journeeScores[3]}`
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
  document.getElementById("bureau").addEventListener("change", updateTop100Info);
  document.getElementById("phase").addEventListener("change", updateTop100Info);
  document.getElementById("filtre-bureau").addEventListener("change", renderAll);

  await chargerDonnees(false, "manual");
  setupRealtime();
});