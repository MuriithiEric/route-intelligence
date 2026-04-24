// upload_visits.js
// Run with: node upload_visits.js
// This uploads visits in small batches directly via Supabase API

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'

const SUPABASE_URL = 'https://atojbdohhvmjgtyagtkr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0b2piZG9oaHZtamd0eWFndGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDE1NjQsImV4cCI6MjA5MTc3NzU2NH0.3A9NdeiE7A4oiLSmHTab_Xabap8K9kZ6NlN42-3KpKg'
const BATCH_SIZE = 500
const CSV_FILE = 'visits_upload.csv'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function upload() {
  console.log('Reading CSV...')
  const content = readFileSync(CSV_FILE, 'utf-8')
  const records = parse(content, { columns: true, skip_empty_lines: true })
  console.log(`Total records: ${records.length.toLocaleString()}`)

  // Clear existing data first
  console.log('Truncating visits table...')
  const { error: truncErr } = await supabase.rpc('truncate_visits')
  if (truncErr) {
    console.log('Note: Could not truncate via RPC - ensure table is empty before running')
  }

  // Type cast numeric fields
  const cast = (r) => ({
    id: parseInt(r.id),
    shop_id: parseInt(r.shop_id),
    shop_name: r.shop_name || null,
    rep_id: r.rep_id ? parseInt(r.rep_id) : null,
    rep_name: r.rep_name || null,
    category: r.category || null,
    region: r.region || null,
    route_name: r.route_name || null,
    route_id: r.route_id ? parseInt(r.route_id) : null,
    lat: r.lat ? parseFloat(r.lat) : null,
    lng: r.lng ? parseFloat(r.lng) : null,
    check_in: r.check_in || null,
    check_out: r.check_out || null,
    duration: r.duration ? parseFloat(r.duration) : null,
    status: r.status ? parseInt(r.status) : null,
    route_type: r.route_type || null,
    visit_status: r.visit_status || 'Active'
  })

  let uploaded = 0
  let errors = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(cast)
    
    const { error } = await supabase
      .from('visits')
      .insert(batch)

    if (error) {
      console.error(`Batch ${Math.floor(i/BATCH_SIZE)+1} error:`, error.message)
      errors++
    } else {
      uploaded += batch.length
    }

    // Progress every 10 batches
    if ((i / BATCH_SIZE) % 10 === 0) {
      const pct = ((uploaded / records.length) * 100).toFixed(1)
      console.log(`Progress: ${uploaded.toLocaleString()} / ${records.length.toLocaleString()} (${pct}%)`)
    }
  }

  console.log(`\nDone! Uploaded: ${uploaded.toLocaleString()} | Errors: ${errors}`)
}

upload().catch(console.error)
