import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qsqtjglrozhttzpxbqkm.supabase.co';
const supabaseKey =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcXRqZ2xyb3podHR6cHhicWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI5ODMzOTUsImV4cCI6MjAyODU1OTM5NX0.4iKaOZwhiRZyfv4FB-OjIO4derHnPyxfO1zxymgYW6U';

export const supabase = createClient(supabaseUrl, supabaseKey);
