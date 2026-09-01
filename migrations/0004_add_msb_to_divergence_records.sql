-- Add Major Structure Break (MSB) indicator column to divergence_records table
ALTER TABLE divergence_records ADD COLUMN msb TEXT DEFAULT 'no';
