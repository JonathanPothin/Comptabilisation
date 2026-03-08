// Connexion Supabase
const SUPABASE_URL = "https://dgudohauvnnlzeynfskt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndWRvaGF1dm5ubHpleW5mc2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzYyMjksImV4cCI6MjA3ODU1MjIyOX0.1QcfLcJX9jpJBq7n4RaivqwbCm53IBKD_U-2CfTIaMw";
// -----------------------------------------------------

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase connecté");
