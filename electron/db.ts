import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { app } from 'electron'
import fs from 'fs-extra'

let dbPath: string

if (app.isPackaged) {
  // 生产环境：exe同级目录/data
  dbPath = join(dirname(app.getPath('exe')), 'data', 'kenaike-sensor.db')
} else {
  // 开发环境：项目根目录/data
  dbPath = join(process.cwd(), 'data', 'kenaike-sensor.db')
}

// 确保目录存在
fs.ensureDirSync(dirname(dbPath))

let db: Database.Database | null = null

export function initDB() {
  if (db) return db

  try {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL') // 提升并发性能

    // 初始化表结构
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
  } catch (err) {
    console.error('Failed to initialize database at', dbPath, err)
    // Fallback? 或者直接抛出错误让应用知道
    throw err
  }
  
  return db
}

export function getDB() {
  if (!db) {
    return initDB()
  }
  return db
}
