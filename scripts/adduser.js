// Usage: node scripts/adduser.js <username> <password> "<Display Name>" "<Role>"
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [username, password, name, role] = process.argv.slice(2);
if (!username || !password) {
  console.error('Usage: node scripts/adduser.js <username> <password> "<Display Name>" "<Role>"');
  process.exit(1);
}

const file = path.join(__dirname, '..', 'data', 'users.json');
const users = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
users[username] = { salt, hash, name: name || username, role: role || 'Operator' };
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(users, null, 2));
console.log(`User "${username}" saved.`);
