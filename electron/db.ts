import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import fs from 'fs-extra'

const dbPath = join(app.getPath('userData'), 'kenaike-sensor.db')
fs.ensureDirSync(app.getPath('userData'))

let db: Database.Database | null = null

export function initDB() {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL') // Better concurrency

  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ip TEXT NOT NULL UNIQUE,
      authId TEXT NOT NULL,
      status TEXT DEFAULT 'unknown',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
  
  console.log('Database initialized at:', dbPath)
  return db
}

export function getDB() {
  if (!db) {
    return initDB()
  }
  return db
}
