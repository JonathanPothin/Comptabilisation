let equipe = null;

function setEquipe(e) {
  equipe = e;

  document.querySelectorAll(".team-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const btn = document.getElementById("team-" + e);
  if (btn) btn.classList.add("active");
}

function setMessage(text, isError = false) {
  const el = document.getElementById("message");
  el.textContent = text;
  el.style.color = isError ? "#dc2626" : "#2563eb";
}

async function envoyer() {
  const bureau = document.getElementById("bureau").value;
  const rang = parseInt(document.getElementById("rang").value, 10);
  const phase = document.getElementById("phase").value;

  if (!bureau) {
    setMessage("Choisis un bureau.", true);
    return;
  }

  if (!equipe) {
    setMessage("Choisis une équipe.", true);
    return;
  }

  if (!rang || rang < 1) {
    setMessage("Entre un rang valide.", true);
    return;
  }

  setMessage("Enregistrement en cours...");

  const { error } = await window.supabaseClient.from("passages").insert([
    {
      bureau,
      equipe,
      rang,
      phase
    }
  ]);

  if (error) {
    console.error(error);
    setMessage("Erreur lors de l'enregistrement. Vérifie Supabase.", true);
    return;
  }

  setMessage("Enregistré avec succès.");
  document.getElementById("rang").value = "";
  await chargerDonnees();
}

function buildScoreCards(targetId, scores) {
  const target = document.getElementById(targetId);
  target.innerHTML = `
    <div class="score-card">
      <span class="name">Équipe 1</span>
      <span class="value">${scores[1]}</span>
    </div>
    <div class="score-card">
      <span class="name">Équipe 2</span>
      <span class="value">${scores[2]}</span>
    </div>
    <div class="score-card">
      <span class="name">Équipe 3</span>
      <span class="value">${scores[3]}</span>
    </div>
  `;
}

function buildBars(targetId, scores) {
  const target = document.getElementById(targetId);
  const max = Math.max(scores[1], scores[2], scores[3], 1);

  target.innerHTML = `
    <div class="bar-group">
      ${buildBarRow("Équipe 1", scores[1], max)}
      ${buildBarRow("Équipe 2", scores[2], max)}
      ${buildBarRow("Équipe 3", scores[3], max)}
    </div>
  `;
}

function buildBarRow(label, value, max) {
  const width = Math.round((value / max) * 100);
  return `
    <div class="bar-row">
      <div class="bar-label">
        <span>${label}</span>
        <span>${value}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${width}%"></div>
      </div>
    </div>
  `;
}

function aggregateByTeam(data) {
  const scores = { 1: 0, 2: 0, 3: 0 };
  data.forEach((row) => {
    scores[row.equipe] = (scores[row.equipe] || 0) + 1;
  });
  return scores;
}

function aggregateByBureau(data) {
  const bureaux = {};

  data.forEach((row) => {
    if (!bureaux[row.bureau]) {
      bureaux[row.bureau] = { 1: 0, 2: 0, 3: 0, total: 0 };
    }

    bureaux[row.bureau][row.equipe] += 1;
    bureaux[row.bureau].total += 1;
  });

  return bureaux;
}

function buildTable(targetId, data) {
  const target = document.getElementById(targetId);
  const bureaux = aggregateByBureau(data);
  const noms = Object.keys(bureaux).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ""), 10);
    const nb = parseInt(b.replace(/\D/g, ""), 10);
    return na - nb;
  });

  if (noms.length === 0) {
    target.innerHTML = "<p>Aucune donnée.</p>";
    return;
  }

  let rows = "";
  noms.forEach((bureau) => {
    const item = bureaux[bureau];
    rows += `
      <tr>
        <td>${bureau}</td>
        <td>${item[1]}</td>
        <td>${item[2]}</td>
        <td>${item[3]}</td>
        <td class="total-cell">${item.total}</td>
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
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function chargerDonnees() {
  setMessage("Chargement des résultats...");

  const { data, error } = await supabaseClient
    .from("passages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    setMessage("Impossible de charger les résultats.", true);
    return;
  }

  const top100 = data.filter((row) => row.phase === "top100");
  const journee = data.filter((row) => row.phase === "journee");

  const top100Scores = aggregateByTeam(top100);
  const journeeScores = aggregateByTeam(journee);

  buildScoreCards("top100-cards", top100Scores);
  buildScoreCards("journee-cards", journeeScores);

  buildBars("top100-bars", top100Scores);
  buildBars("journee-bars", journeeScores);

  buildTable("table-top100", top100);
  buildTable("table-journee", journee);

  setMessage("Résultats à jour.");
}

document.addEventListener("DOMContentLoaded", () => {
  chargerDonnees();
});
