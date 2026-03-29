import { createClient } from "@supabase/supabase-js";
const supabase = createClient('https://zzxueclhkhvwdmxflmyx.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6eHVlY2xoa2h2d2RteGZsbXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjEzMTAsImV4cCI6MjA4MDIzNzMxMH0.yJW-HC03EwyYPpyWTrDbTN4t0YrlNe1H40fwLZ_ZxfU');

async function test() {
  console.log("Testing Upsert...");
  const { data, error } = await supabase.from("tyres").upsert(
    [{ catalog_number: "test_ai_1", title: "Test AI Item", price: "200", supplier_id: 1, in_stock: true, stock_quantity: 10, width: "205" }],
    { onConflict: "catalog_number,supplier_id" }
  );
  if (error) {
    console.error("Upsert Failed:");
    console.error(error);
  } else {
    console.log("Upsert Success!");
  }
}

test();
