import admin from "firebase-admin";

var serviceAccount = require("../firebase-adminsdk-xenwi-de1eea874a.json");

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export default db;
