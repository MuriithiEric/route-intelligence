import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://atojbdohhvmjgtyagtkr.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0b2piZG9oaHZtamd0eWFndGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDE1NjQsImV4cCI6MjA5MTc3NzU2NH0.3A9NdeiE7A4oiLSmHTab_Xabap8K9kZ6NlN42-3KpKg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
