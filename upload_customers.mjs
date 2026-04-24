// upload_customers.js
// Run with: node upload_customers.mjs
// This uploads customers in small batches directly via Supabase API

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'

const SUPABASE_URL = 'https://atojbdohhvmjgtyagtkr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0b2piZG9oaHZtamd0eWFndGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDE1NjQsImV4cCI6MjA5MTc3NzU2NH0.3A9NdeiE7A4oiLSmHTab_Xabap8K9kZ6NlN42-3KpKg'
const BATCH_SIZE = 500
const CSV_FILE = 'customers_upload.csv'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function upload() {
  console.log('Reading CSV...')
  const content = readFileSync(CSV_FILE, 'utf-8')
  const records = parse(content, { columns: true, skip_empty_lines: true })
  console.log(`Total records: ${records.length.toLocaleString()}`)

  // First add INSERT policy if not exists
  console.log('Starting upload...')

  const cast = (r) => ({
    id: parseInt(r.id),
    name: r.name || null,
    cat: r.cat || null,
    tier: r.tier || null,
    region: r.region || null,
    loc: r.loc || null,
    channel: r.channel || null,
    territory: r.territory || null,
    lat: r.lat ? parseFloat(r.lat) : null,
    lng: r.lng ? parseFloat(r.lng) : null,
    last_visit: r.last_visit || null,
    last_sale: r.last_sale || null,
    phone: r.phone || null
  })

  let uploaded = 0
  let errors = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(cast)

    const { error } = await supabase
      .from('customers')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })

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
