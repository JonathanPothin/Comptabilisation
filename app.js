let equipe = null;
let passages = [];
let participations = [];
let realtimePassagesChannel = null;
let realtimeParticipationChannel = null;

const TOTAL_INSCRITS_TASSIN = 15278;

const BUREAUX = [
  "Bureau 1 Hôtel de ville",
  "Bureau 2 Gymnase des croisettes",
  "Bureau 3 Ecole Leclerc",
  "Bureau 4 Ecole Marin",
  "Bureau 5 Ecole Marin",
  "Bureau 6 Ecole Baraillon",
  "Bureau 7 Ecole Baraillon",
  "Bureau 8 Ecole Leclerc",
  "Bureau 9 Ecole Berlier Vincent",
  "Bureau 10 Ecole Berlier Vincent",
  "Bureau 11 L’Oméga – Centre de loisirs du CPNG",
  "Bureau 12 L'Oméga Pôle associatif",
  "Bureau 13 Gymnase des croisettes",
  "Bureau 14 Espace Leclerc Salle Molière",
  "Bureau 15 Espace Leclerc Salle Pagnol"
];

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

const PARTICIPATION_POINTS = [
  { key: "10h", label: "10h", css: "slot-10" },
  { key: "12h", label: "12h", css: "slot-12" },
  { key: "15h", label: "15h", css: "slot-15" },
  { key: "19h", label: "19h", css: "slot-19" }
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
  }, 2400);
}

function formatLastUpdate(source = "live") {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const prefix = source === "manual" ? "Actualisé à" : "Live à";
  document.getElementById("last-update").textContent = `${prefix} ${hh}:${mm}:${ss}`;
}

function formatPercent(value) {
  return `${Number(value).toFixed(1).replace(".", ",")}%`;
}

function teamAvatarHtml(teamId, size = "small") {
  const team = TEAMS[teamId];
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

function fillBureauSelect(selectId) {
  const select = document.getElementById(selectId);
  select.innerHTML = BUREAUX.map((bureau) => `<option value="${bureau}">${bureau}</option>`).join("");
}

function renderTeamButtons() {
  [1, 2, 3].forEach((id) => {
    const team = TEAMS[id];
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

function aggregateCourseByTeam(data) {
  const scores = { 1: 0, 2: 0, 3: 0 };
  data.forEach((row) => {
    scores[row.equipe] += Number(row.rang) || 0;
  });
  return scores;
}

function aggregateCourseByBureau(data) {
  const result = {};
  BUREAUX.forEach((bureau) => {
    result[bureau] = { 1: 0, 2: 0, 3: 0, total: 0 };
  });

  data.forEach((row) => {
    const v = Number(row.rang) || 0;
    if (!result[row.bureau]) {
      result[row.bureau] = { 1: 0, 2: 0, 3: 0, total: 0 };
    }
    result[row.bureau][row.equipe] += v;
    result[row.bureau].total += v;
  });

  return result;
}

function getTop100TotalForBureau(bureau) {
  return passages
    .filter((row) => row.bureau === bureau)
    .reduce((sum, row) => sum + (Number(row.rang) || 0), 0);
}

function updateTop100Info() {
  const bureau = document.getElementById("course-bureau").value;
  const total = getTop100TotalForBureau(bureau);
  const reste = 100 - total;
  const info = document.getElementById("top100-info");

  if (reste <= 0) {
    info.textContent = `${bureau} : les 100 premiers sont complets (100 / 100).`;
  } else {
    info.textContent = `${bureau} : ${total} / 100 saisis — il reste ${reste} personne(s).`;
  }
}

async function enregistrerPassage() {
  const bureau = document.getElementById("course-bureau").value;
  const nombre = parseInt(document.getElementById("course-nombre").value, 10);

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
      phase: "top100"
    }
  ]);

  if (error) {
    console.error(error);
    showToast("Erreur lors de l’enregistrement course.", true);
    return;
  }

  document.getElementById("course-nombre").value = "";
  showToast("Saisie course enregistrée");
}

function findParticipationRecord(bureau, heurePoint) {
  return participations.find((p) => p.bureau === bureau && p.heure_point === heurePoint);
}

async function enregistrerParticipation() {
  const bureau = document.getElementById("participation-bureau").value;
  const heurePoint = document.getElementById("participation-heure").value;
  const pctRaw = document.getElementById("participation-pct").value;
  const pourcentage = parseFloat(pctRaw);

  if (!bureau) {
    showToast("Choisis un bureau pour la participation.", true);
    return;
  }

  if (!heurePoint) {
    showToast("Choisis un point horaire.", true);
    return;
  }

  if (Number.isNaN(pourcentage) || pourcentage < 0 || pourcentage > 100) {
    showToast("Entre un pourcentage valide entre 0 et 100.", true);
    return;
  }

  const { error } = await window.supabaseClient
    .from("participation")
    .upsert(
      [
        {
          bureau,
          heure_point: heurePoint,
          pourcentage: pourcentage
        }
      ],
      { onConflict: "bureau,heure_point" }
    );

  if (error) {
    console.error(error);
    showToast("Erreur lors de l’enregistrement participation.", true);
    return;
  }

  showToast("Participation enregistrée");
}

function animateNumber(el, newValue) {
  const oldValue = parseInt((el.dataset.value || "0"), 10);
  if (oldValue === newValue) {
    el.textContent = String(newValue);
    return;
  }

  const duration = 350;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const current = Math.round(oldValue + (newValue - oldValue) * progress);
    el.textContent = String(current);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.dataset.value = String(newValue);
    }
  }

  requestAnimationFrame(step);
}

function renderHeroStats() {
  const totalCourse = passages.reduce((sum, row) => sum + (Number(row.rang) || 0), 0);
  const bureauxAgg = aggregateCourseByBureau(passages);
  const nbComplets = Object.values(bureauxAgg).filter((b) => b.total >= 100).length;

  const point19 = computeGlobalParticipationPoint("19h");

  document.getElementById("stat-bureaux").textContent = `${nbComplets} / 15`;
  animateNumber(document.getElementById("stat-top100"), totalCourse);
  document.getElementById("stat-participation-19h").textContent = formatPercent(point19.avgPct);
}

function renderCourseScores() {
  const scores = aggregateCourseByTeam(passages);
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

function renderCourseRanking() {
  const scores = aggregateCourseByTeam(passages);
  const ranking = [
    { equipe: 1, score: scores[1] || 0 },
    { equipe: 2, score: scores[2] || 0 },
    { equipe: 3, score: scores[3] || 0 }
  ].sort((a, b) => b.score - a.score);

  const first = ranking[0];
  const second = ranking[1];
  const third = ranking[2];
  const ecart = Math.max(0, first.score - second.score);

  document.getElementById("classement-principal").innerHTML = `
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

function renderCourseBars() {
  const scores = aggregateCourseByTeam(passages);
  const max = Math.max(scores[1], scores[2], scores[3], 1);
  const target = document.getElementById("course-bars");

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

function renderCourseTable() {
  const agg = aggregateCourseByBureau(passages);

  let rows = "";
  BUREAUX.forEach((bureau) => {
    const item = agg[bureau];
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

  document.getElementById("course-table").innerHTML = `
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

function computeGlobalParticipationPoint(pointKey) {
  const pointRows = participations.filter((p) => p.heure_point === pointKey);
  const avgPct = pointRows.length
    ? pointRows.reduce((sum, row) => sum + (Number(row.pourcentage) || 0), 0) / pointRows.length
    : 0;

  const projected = Math.round((avgPct / 100) * TOTAL_INSCRITS_TASSIN);

  return {
    pointKey,
    avgPct,
    projected,
    count: pointRows.length
  };
}

function renderParticipationGlobal() {
  const target = document.getElementById("participation-global-chart");
  const summary = document.getElementById("participation-global-summary");

  const points = PARTICIPATION_POINTS.map((p) => ({
    ...p,
    ...computeGlobalParticipationPoint(p.key)
  }));

  const maxPct = Math.max(...points.map((p) => p.avgPct), 1);

  target.innerHTML = points.map((point) => {
    const height = Math.max(6, Math.round((point.avgPct / maxPct) * 180));
    return `
      <div class="vertical-bar-col">
        <div class="vertical-value">${formatPercent(point.avgPct)}</div>
        <div class="vertical-bar-wrap">
          <div class="vertical-bar ${point.css}" style="height:${height}px;"></div>
        </div>
        <div class="vertical-label">${point.label}</div>
      </div>
    `;
  }).join("");

  summary.innerHTML = points.map((point) => `
    <div class="projection-card">
      <div class="projection-title">${point.label}</div>
      <div class="projection-main">${formatPercent(point.avgPct)}</div>
      <div class="projection-sub">≈ ${point.projected.toLocaleString("fr-FR")} personnes sur base Tassin</div>
    </div>
  `).join("");
}

function renderParticipationBureaux() {
  const target = document.getElementById("participation-bureaux-chart");

  target.innerHTML = BUREAUX.map((bureau) => {
    const bureauRows = participations.filter((p) => p.bureau === bureau);

    const bureauPoints = PARTICIPATION_POINTS.map((point) => {
      const found = bureauRows.find((row) => row.heure_point === point.key);
      return {
        ...point,
        pct: found ? Number(found.pourcentage) || 0 : 0
      };
    });

    const maxPct = Math.max(...bureauPoints.map((p) => p.pct), 1);

    return `
      <div class="bureau-row">
        <div class="bureau-name">${bureau}</div>
        <div class="bureau-bars">
          ${bureauPoints.map((point) => {
            const height = Math.max(5, Math.round((point.pct / maxPct) * 84));
            return `
              <div class="bureau-bar-col">
                <div class="bureau-bar-value">${formatPercent(point.pct)}</div>
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

function renderHistoriques() {
  const courseTarget = document.getElementById("historique-course");
  const participationTarget = document.getElementById("historique-participation");

  const recentCourse = [...passages].sort((a, b) => b.id - a.id).slice(0, 10);
  const recentParticipation = [...participations].sort((a, b) => b.id - a.id).slice(0, 10);

  courseTarget.innerHTML = recentCourse.length
    ? `<div class="history-list">
        ${recentCourse.map((row) => `
          <div class="history-item">
            <div class="history-line">${row.bureau} — ${TEAMS[row.equipe].name} — ${row.rang}</div>
            <div class="history-meta">100 premiers · ID ${row.id}</div>
          </div>
        `).join("")}
      </div>`
    : "<p class='muted'>Aucune saisie course.</p>";

  participationTarget.innerHTML = recentParticipation.length
    ? `<div class="history-list">
        ${recentParticipation.map((row) => `
          <div class="history-item">
            <div class="history-line">${row.bureau} — ${row.heure_point} — ${formatPercent(row.pourcentage)}</div>
            <div class="history-meta">Participation · ID ${row.id}</div>
          </div>
        `).join("")}
      </div>`
    : "<p class='muted'>Aucune saisie participation.</p>";
}

function renderAll() {
  renderHeroStats();
  renderCourseScores();
  renderCourseRanking();
  renderCourseBars();
  renderCourseTable();
  renderParticipationGlobal();
  renderParticipationBureaux();
  renderHistoriques();
  updateTop100Info();
}

async function chargerToutesLesDonnees(showManualToast = false, source = "manual") {
  const [passagesResp, participationResp] = await Promise.all([
    window.supabaseClient
      .from("passages")
      .select("*")
      .eq("phase", "top100")
      .order("created_at", { ascending: true }),
    window.supabaseClient
      .from("participation")
      .select("*")
      .order("created_at", { ascending: true })
  ]);

  if (passagesResp.error) {
    console.error(passagesResp.error);
    showToast("Impossible de charger la course.", true);
    return;
  }

  if (participationResp.error) {
    console.error(participationResp.error);
    showToast("Impossible de charger la participation.", true);
    return;
  }

  passages = passagesResp.data || [];
  participations = participationResp.data || [];

  renderAll();
  formatLastUpdate(source);

  if (showManualToast) {
    showToast("Résultats actualisés");
  }
}

function setupRealtime() {
  if (realtimePassagesChannel) {
    window.supabaseClient.removeChannel(realtimePassagesChannel);
  }
  if (realtimeParticipationChannel) {
    window.supabaseClient.removeChannel(realtimeParticipationChannel);
  }

  realtimePassagesChannel = window.supabaseClient
    .channel("passages-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "passages" },
      async () => {
        await chargerToutesLesDonnees(false, "live");
      }
    )
    .subscribe((status) => {
      console.log("Realtime passages:", status);
    });

  realtimeParticipationChannel = window.supabaseClient
    .channel("participation-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "participation" },
      async () => {
        await chargerToutesLesDonnees(false, "live");
      }
    )
    .subscribe((status) => {
      console.log("Realtime participation:", status);
      if (status === "SUBSCRIBED") {
        showToast("Temps réel activé");
      }
    });
}

async function annulerDerniereSaisieCourse() {
  const ok = confirm("Annuler la dernière saisie course ?");
  if (!ok) return;

  const { data, error } = await window.supabaseClient
    .from("passages")
    .select("id")
    .eq("phase", "top100")
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    showToast("Impossible de récupérer la dernière saisie course.", true);
    return;
  }

  if (!data || !data.length) {
    showToast("Aucune saisie course à annuler.", true);
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

  showToast(`Dernière saisie course annulée (ID ${lastId})`);
}

function toCsvLine(values) {
  return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
}

function exporterCSV() {
  const courseRows = [
    ["TABLE", "id", "bureau", "equipe", "rang", "phase", "created_at"],
    ...passages.map((row) => ["passages", row.id, row.bureau, row.equipe, row.rang, row.phase, row.created_at])
  ];

  const participationRows = [
    [],
    ["TABLE", "id", "bureau", "heure_point", "pourcentage", "created_at"],
    ...participations.map((row) => ["participation", row.id, row.bureau, row.heure_point, row.pourcentage, row.created_at])
  ];

  const csv = [...courseRows, ...participationRows].map(toCsvLine).join("\n");
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
  const scores = aggregateCourseByTeam(passages);
  const p10 = computeGlobalParticipationPoint("10h");
  const p12 = computeGlobalParticipationPoint("12h");
  const p15 = computeGlobalParticipationPoint("15h");
  const p19 = computeGlobalParticipationPoint("19h");

  const texte = [
    "Résumé comptabilisation",
    "",
    "Course - 100 premiers",
    `${TEAMS[1].name} : ${scores[1]}`,
    `${TEAMS[2].name} : ${scores[2]}`,
    `${TEAMS[3].name} : ${scores[3]}`,
    "",
    "Participation globale",
    `10h : ${formatPercent(p10.avgPct)} (≈ ${p10.projected.toLocaleString("fr-FR")})`,
    `12h : ${formatPercent(p12.avgPct)} (≈ ${p12.projected.toLocaleString("fr-FR")})`,
    `15h : ${formatPercent(p15.avgPct)} (≈ ${p15.projected.toLocaleString("fr-FR")})`,
    `19h : ${formatPercent(p19.avgPct)} (≈ ${p19.projected.toLocaleString("fr-FR")})`
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
  fillBureauSelect("course-bureau");
  fillBureauSelect("participation-bureau");
  renderTeamButtons();

  document.getElementById("course-bureau").addEventListener("change", updateTop100Info);

  await chargerToutesLesDonnees(false, "manual");
  setupRealtime();
});