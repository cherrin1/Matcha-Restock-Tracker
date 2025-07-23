const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(path.join(__dirname, '../../data/products.db'), (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('📄 Connected to SQLite database');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createProductsTable = `
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          brand TEXT NOT NULL,
          url TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT 'checking',
          confidence TEXT,
          detected_phrases TEXT,
          last_checked DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createChecksTable = `
        CREATE TABLE IF NOT EXISTS stock_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER,
          status TEXT NOT NULL,
          confidence TEXT,
          detected_phrases TEXT,
          checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
        )
      `;

      this.db.serialize(() => {
        this.db.run(createProductsTable);
        this.db.run(createChecksTable, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async addProduct(name, brand, url) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO products (name, brand, url, status, last_checked)
        VALUES (?, ?, ?, 'checking', CURRENT_TIMESTAMP)
      `);
      
      stmt.run([name, brand, url], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  async getAllProducts() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT p.*, 
               COUNT(sc.id) as check_count,
               MAX(sc.checked_at) as last_check_time
        FROM products p
        LEFT JOIN stock_checks sc ON p.id = sc.product_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            ...row,
            detected_phrases: row.detected_phrases ? JSON.parse(row.detected_phrases) : []
          })));
        }
      });
    });
  }

  async getProduct(id) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT p.*, 
               COUNT(sc.id) as check_count,
               MAX(sc.checked_at) as last_check_time
        FROM products p
        LEFT JOIN stock_checks sc ON p.id = sc.product_id
        WHERE p.id = ?
        GROUP BY p.id
      `, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve({
            ...row,
            detected_phrases: row.detected_phrases ? JSON.parse(row.detected_phrases) : []
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async updateProduct(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      Object.keys(updates).forEach(key => {
        if (key === 'detected_phrases' && Array.isArray(updates[key])) {
          fields.push(`${key} = ?`);
          values.push(JSON.stringify(updates[key]));
        } else {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      });
      
      values.push(id);
      
      const sql = `UPDATE products SET ${fields.join(', ')}, last_checked = CURRENT_TIMESTAMP WHERE id = ?`;
      
      this.db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async deleteProduct(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async addStockCheck(productId, status, confidence, detectedPhrases) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO stock_checks (product_id, status, confidence, detected_phrases)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run([
        productId, 
        status, 
        confidence, 
        JSON.stringify(detectedPhrases)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  async getStats() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'in-stock' THEN 1 ELSE 0 END) as in_stock,
          SUM(CASE WHEN status = 'out-of-stock' THEN 1 ELSE 0 END) as out_of_stock,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
          SUM(CASE WHEN status = 'checking' THEN 1 ELSE 0 END) as checking
        FROM products
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows[0]);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('📄 Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;
