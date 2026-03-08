let equipe = null;

function setEquipe(e) {
  equipe = e;

  document.querySelectorAll(".team-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  const activeBtn = document.getElementById("team-" + e);
  if (activeBtn) activeBtn.classList.add("active");
}

async function envoyer() {
  const bureau = document.getElementById("bureau").value;
  const rang = parseInt(document.getElementById("rang").value, 10);
  const phase = document.getElementById("phase").value;

  if (!bureau) {
    alert("Choisis un bureau");
    return;
  }

  if (!equipe) {
    alert("Choisis une équipe");
    return;
  }

  if (!rang || rang < 1) {
    alert("Entre un rang valide");
    return;
  }

  const { error } = await supabase.from("passages").insert([
    {
      bureau: bureau,
      equipe: equipe,
      rang: rang,
      phase: phase
    }
  ]);

  if (error) {
    console.error(error);
    alert("Erreur lors de l'enregistrement");
    return;
  }

  alert("Enregistré");
  document.getElementById("rang").value = "";
}
