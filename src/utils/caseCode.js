const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');


function generateCaseCode() {
  return uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase();
}


async function hashCaseCode(caseCode) {
  return bcrypt.hash(caseCode, 10);
}


async function verifyCaseCode(caseCode, hash) {
  return bcrypt.compare(caseCode, hash);
}

module.exports = { generateCaseCode, hashCaseCode, verifyCaseCode };