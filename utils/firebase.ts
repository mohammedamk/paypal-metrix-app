import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
if (!firebase.apps.length) {
  console.debug("Lets initialize Firebase...");
  firebase.initializeApp({
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: ".appspot.com",
    messagingSenderId: "",
    appId: "",
  });
}
const firestore = firebase.firestore();
const auth = firebase.auth();
export default {
  firestore,
  auth,
};
