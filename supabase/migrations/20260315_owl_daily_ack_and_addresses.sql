-- Add daily acknowledgment column to owl_notes
ALTER TABLE owl_notes ADD COLUMN IF NOT EXISTS last_acknowledged_date date;

-- Update dog addresses (FIX 7)
UPDATE dogs SET address = '5412 Rue Garnier' WHERE dog_name = 'Enzo OG';
UPDATE dogs SET address = '5046 Rue Garnier H2J 3S9', door_code = '1212' WHERE dog_name = 'Pepper Husky';
UPDATE dogs SET address = '1129 Rue Rachel Est' WHERE dog_name = 'Pepper Mini Aussie';
