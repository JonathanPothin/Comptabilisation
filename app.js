let equipe = null;

function setEquipe(e){
equipe = e;
alert("Equipe " + e + " sélectionnée");
}

async function envoyer(){

const checkpoint = document.getElementById("checkpoint").value;
const rang = document.getElementById("rang").value;
const phase = document.getElementById("phase").value;

if(!equipe){
alert("Choisir équipe");
return;
}

await supabase.from("passages").insert([
{
checkpoint: checkpoint,
equipe: equipe,
rang: rang,
phase: phase
}
]);

alert("Enregistré");
}
