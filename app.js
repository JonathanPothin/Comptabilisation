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

function ajouterValeur(valeur) {
  const input = document.getElementById("rang");
  const actuel = parseInt(input.value || "0", 10);
  input.value = actuel + valeur;
}

function setMessage(text, isError = false) {
  const el = document.getElementById("message");
  el.textContent = text;
  el.style.color = isError ? "#dc2626" : "#2563eb";
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
    info.innerHTML = "Mode ajouts après les 100 : les quantités s'ajoutent au total journée.";
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
      setMessage(`Impossible : ${bureau} a déjà ${totalActuel}/100. Tu peux ajouter au maximum ${reste}.`, true);
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
    <div class="score-card"><span class="name">Équipe 1</span><span class="value">${scores[1]}</span></div>
    <div class="score-card"><span class="name">Équipe 2</span><span class="value">${scores[2]}</span></div>
    <div class="score-card"><span class="name">Équipe 3</span><span class="value">${scores[3]}</span></div>
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

function buildClassement(targetId, scores) {
  const target = document.getElementById(targetId);

  const ranking = [
    { equipe: 1, score: scores[1] || 0 },
    { equipe: 2, score: scores[2] || 0 },
    { equipe: 3, score: scores[3] || 0 }
  ].sort((a, b) => b.score - a.score);

  const first = ranking[0];
  const second = ranking[1];
  const third = ranking[2];
  const ecart = first.score - second.score;

  target.innerHTML = `
    <div class="classement">
      <div class="rank-card">
        <div class="rank-title">1er : Équipe ${first.equipe}</div>
        <div class="rank-sub">${first.score} personne(s)</div>
      </div>
      <div class="rank-card">
        <div class="rank-title">2e : Équipe ${second.equipe}</div>
        <div class="rank-sub">${second.score} personne(s)</div>
      </div>
      <div class="rank-card">
        <div class="rank-title">3e : Équipe ${third.equipe}</div>
        <div class="rank-sub">${third.score} personne(s)</div>
      </div>
      <div class="rank-card">
        <div class="rank-title">Écart</div>
        <div class="rank-sub">Équipe ${first.equipe} a ${ecart} personne(s) d'avance sur l'équipe ${second.equipe}</div>
      </div>
    </div>
  `;
}

function buildTable(targetId, data, mode) {
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
    let status = "";

    if (mode === "top100") {
      totalText = `${item.total} / 100`;
      if (item.total >= 100) {
        status = `<span class="status-cell status-ok">Complet</span>`;
      } else {
        status = `<span class="status-cell status-wait">Reste ${100 - item.total}</span>`;
      }
    } else {
      status = `<span class="status-cell">—</span>`;
    }

    rows += `
      <tr>
        <td>${bureau}</td>
        <td>${item[1]}</td>
        <td>${item[2]}</td>
        <td>${item[3]}</td>
        <td class="total-cell">${totalText}</td>
        <td>${status}</td>
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

function buildHistorique(data) {
  const target = document.getElementById("historique");
  const recent = [...data].sort((a, b) => b.id - a.id).slice(0, 10);

  if (recent.length === 0) {
    target.innerHTML = "<p>Aucune saisie pour le moment.</p>";
    return;
  }

  target.innerHTML = `
    <div class="history-list">
      ${recent.map((row) => `
        <div class="history-item">
          <div class="history-line">${row.bureau} — Équipe ${row.equipe} — ${row.rang} — ${row.phase === "top100" ? "100 premiers" : "ajouts après les 100"}</div>
          <div class="history-meta">ID ${row.id}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function buildOrganizerSummary(top100Data, apres100Data, journeeData) {
  const top100Total = top100Data.reduce((sum, row) => sum + (Number(row.rang) || 0), 0);
  const apres100Total = apres100Data.reduce((sum, row) => sum + (Number(row.rang) || 0), 0);
  const journeeTotal = journeeData.reduce((sum, row) => sum + (Number(row.rang) || 0), 0);

  const top100Bureaux = aggregateByBureau(top100Data);
  const nbComplets = Object.values(top100Bureaux).filter((b) => b.total >= 100).length;

  document.getElementById("organizer-summary").innerHTML = `
    <div class="organizer-box">
      <div class="label">Bureaux complets (100 premiers)</div>
      <div class="value">${nbComplets} / 15</div>
    </div>
    <div class="organizer-box">
      <div class="label">Total 100 premiers</div>
      <div class="value">${top100Total}</div>
    </div>
    <div class="organizer-box">
      <div class="label">Ajouts après les 100</div>
      <div class="value">${apres100Total}</div>
    </div>
    <div class="organizer-box">
      <div class="label">Total journée</div>
      <div class="value">${journeeTotal}</div>
    </div>
  `;
}

async function annulerDerniereSaisie() {
  if (!confirm("Annuler la dernière saisie ?")) return;

  const { data, error } = await window.supabaseClient
    .from("passages")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    setMessage("Impossible de récupérer la dernière saisie.", true);
    return;
  }

  if (!data || data.length === 0) {
    setMessage("Aucune saisie à annuler.", true);
    return;
  }

  const lastId = data[0].id;

  const { error: deleteError } = await window.supabaseClient
    .from("passages")
    .delete()
    .eq("id", lastId);

  if (deleteError) {
    console.error(deleteError);
    setMessage("Impossible d'annuler. Vérifie la policy DELETE.", true);
    return;
  }

  setMessage(`Dernière saisie annulée (ID ${lastId}).`);
  await chargerDonnees();
}

function toCsvLine(values) {
  return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
}

function exporterCSV() {
  if (!toutesLesDonnees.length) {
    setMessage("Aucune donnée à exporter.", true);
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
  setMessage("Export CSV généré.");
}

async function copierResume() {
  const filtre = filtreBureauActuel();
  const dataFiltrees = appliquerFiltre(toutesLesDonnees);
  const top100 = dataFiltrees.filter((row) => row.phase === "top100");
  const apres100 = dataFiltrees.filter((row) => row.phase === "journee");
  const journee = [...top100, ...apres100];

  const top100Scores = aggregateByTeam(top100);
  const apres100Scores = aggregateByTeam(apres100);
  const journeeScores = aggregateByTeam(journee);

  const ranking = [
    { equipe: 1, score: journeeScores[1] || 0 },
    { equipe: 2, score: journeeScores[2] || 0 },
    { equipe: 3, score: journeeScores[3] || 0 }
  ].sort((a, b) => b.score - a.score);

  const texte = [
    `Résumé comptabilisation - ${filtre === "TOUS" ? "Tous les bureaux" : filtre}`,
    ``,
    `100 premiers :`,
    `Équipe 1 : ${top100Scores[1]}`,
    `Équipe 2 : ${top100Scores[2]}`,
    `Équipe 3 : ${top100Scores[3]}`,
    ``,
    `Ajouts après les 100 :`,
    `Équipe 1 : ${apres100Scores[1]}`,
    `Équipe 2 : ${apres100Scores[2]}`,
    `Équipe 3 : ${apres100Scores[3]}`,
    ``,
    `Total journée :`,
    `Équipe 1 : ${journeeScores[1]}`,
    `Équipe 2 : ${journeeScores[2]}`,
    `Équipe 3 : ${journeeScores[3]}`,
    ``,
    `Classement journée :`,
    `1er : Équipe ${ranking[0].equipe} (${ranking[0].score})`,
    `2e : Équipe ${ranking[1].equipe} (${ranking[1].score})`,
    `3e : Équipe ${ranking[2].equipe} (${ranking[2].score})`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(texte);
    setMessage("Résumé copié dans le presse-papiers.");
  } catch (e) {
    console.error(e);
    setMessage("Impossible de copier automatiquement.", true);
  }
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

  const dataFiltrees = appliquerFiltre(toutesLesDonnees);

  const top100 = dataFiltrees.filter((row) => row.phase === "top100");
  const apres100 = dataFiltrees.filter((row) => row.phase === "journee");
  const journee = [...top100, ...apres100];

  const top100Scores = aggregateByTeam(top100);
  const apres100Scores = aggregateByTeam(apres100);
  const journeeScores = aggregateByTeam(journee);

  buildOrganizerSummary(
    toutesLesDonnees.filter((row) => row.phase === "top100"),
    toutesLesDonnees.filter((row) => row.phase === "journee"),
    [...toutesLesDonnees]
  );

  buildScoreCards("top100-cards", top100Scores);
  buildScoreCards("apres100-cards", apres100Scores);
  buildScoreCards("journee-cards", journeeScores);

  buildBars("top100-bars", top100Scores);
  buildBars("apres100-bars", apres100Scores);
  buildBars("journee-bars", journeeScores);

  buildClassement("classement-top100", top100Scores);
  buildClassement("classement-journee", journeeScores);

  buildTable("table-top100", top100, "top100");
  buildTable("table-apres100", apres100, "apres100");
  buildTable("table-journee", journee, "journee");

  buildHistorique(toutesLesDonnees);

  updateTop100Info();
  setMessage("Résultats à jour.");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("bureau").addEventListener("change", updateTop100Info);
  document.getElementById("phase").addEventListener("change", updateTop100Info);
  document.getElementById("filtre-bureau").addEventListener("change", chargerDonnees);
  chargerDonnees();
});