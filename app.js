let equipe = null;
let toutesLesDonnees = [];

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
    info.innerHTML = "Mode journée : tu peux saisir librement les quantités.";
    return;
  }

  const total = getTop100TotalForBureau(bureau);
  const reste = 100 - total;

  if (reste <= 0) {
    info.innerHTML = `${bureau} : les 100 premiers sont déjà complets (100 / 100).`;
  } else {
    info.innerHTML = `${bureau} : ${total} / 100 saisis — il reste ${reste} personne(s).`;
  }
}

async function envoyer() {
  const bureau = document.getElementById("bureau").value;
  const nombre = parseInt(document.getElementById("rang").value, 10);
  const phase = document.getElementById("phase").value;

  if (!bureau) {
    setMessage("Choisis un bureau.", true);
    return;
  }

  if (!equipe) {
    setMessage("Choisis une équipe.", true);
    return;
  }

  if (!nombre || nombre < 1) {
    setMessage("Entre un nombre valide.", true);
    return;
  }

  if (phase === "top100") {
    const totalActuel = getTop100TotalForBureau(bureau);

    if (totalActuel >= 100) {
      setMessage(`${bureau} a déjà atteint 100 / 100.`, true);
      updateTop100Info();
      return;
    }

    if (totalActuel + nombre > 100) {
      const reste = 100 - totalActuel;
      setMessage(
        `Impossible : ${bureau} a déjà ${totalActuel}/100. Tu peux ajouter au maximum ${reste}.`,
        true
      );
      updateTop100Info();
      return;
    }
  }

  setMessage("Enregistrement en cours...");

  const { error } = await window.supabaseClient.from("passages").insert([
    {
      bureau: bureau,
      equipe: equipe,
      rang: nombre,
      phase: phase
    }
  ]);

  if (error) {
    console.error(error);
    setMessage("Erreur lors de l'enregistrement.", true);
    return;
  }

  setMessage("Enregistré avec succès.");
  document.getElementById("rang").value = "";

  await chargerDonnees();
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

function buildTable(targetId, data, isTop100 = false) {
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
    let totalText = `${item.total}`;

    if (isTop100) {
      totalText = `${item.total} / 100`;
    }

    rows += `
      <tr>
        <td>${bureau}</td>
        <td>${item[1]}</td>
        <td>${item[2]}</td>
        <td>${item[3]}</td>
        <td class="total-cell">${totalText}</td>
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

  const { data, error } = await window.supabaseClient
    .from("passages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    setMessage("Impossible de charger les résultats.", true);
    return;
  }

  toutesLesDonnees = data || [];

  const top100 = toutesLesDonnees.filter((row) => row.phase === "top100");
  const journee = toutesLesDonnees.filter((row) => row.phase === "journee");

  const top100Scores = aggregateByTeam(top100);
  const journeeScores = aggregateByTeam(journee);

  buildScoreCards("top100-cards", top100Scores);
  buildScoreCards("journee-cards", journeeScores);

  buildBars("top100-bars", top100Scores);
  buildBars("journee-bars", journeeScores);

  buildTable("table-top100", top100, true);
  buildTable("table-journee", journee, false);

  updateTop100Info();
  setMessage("Résultats à jour.");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("bureau").addEventListener("change", updateTop100Info);
  document.getElementById("phase").addEventListener("change", updateTop100Info);
  chargerDonnees();
});