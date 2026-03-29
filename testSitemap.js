import { createClient } from "@supabase/supabase-js";
const supabase = createClient('https://zzxueclhkhvwdmxflmyx.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6eHVlY2xoa2h2d2RteGZsbXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjEzMTAsImV4cCI6MjA4MDIzNzMxMH0.yJW-HC03EwyYPpyWTrDbTN4t0YrlNe1H40fwLZ_ZxfU');

async function test() {
  const { data, error } = await supabase.from("tyres").select("id, updated_at").limit(1);
  console.log("Error:", error?.message);
}

test();
