-- Migration: Create transporteurs_pending table with RGPD consent logging
-- Run this in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS transporteurs_pending (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telephone TEXT UNIQUE NOT NULL,
  siren_siret TEXT NOT NULL,
  type_vehicule TEXT NOT NULL,
  licence_url TEXT,
  date_expiration_licence DATE NOT NULL,

  -- RGPD Consent Logging
  consent_rgpd BOOLEAN DEFAULT FALSE,
  consent_notifications BOOLEAN DEFAULT FALSE,
  consent_marketing BOOLEAN DEFAULT FALSE,
  consent_date TIMESTAMP DEFAULT NOW(),

  -- Admin Fields
  created_at TIMESTAMP DEFAULT NOW(),
  statut TEXT DEFAULT 'pending', -- pending / approuvé / rejeté
  raison_rejet TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transporteurs_pending_email ON transporteurs_pending(email);
CREATE INDEX IF NOT EXISTS idx_transporteurs_pending_statut ON transporteurs_pending(statut);
CREATE INDEX IF NOT EXISTS idx_transporteurs_pending_created_at ON transporteurs_pending(created_at);

-- Enable Row Level Security (optional, for extra security)
-- ALTER TABLE transporteurs_pending ENABLE ROW LEVEL SECURITY;
