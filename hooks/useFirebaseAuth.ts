import { useEffect, useState } from "react";
import firebase from "../utils/firebase";
import fb from "firebase";

export type UseFirebaseAuth = {
  authUser: fb.User;
  signInWithToken: (token: string) => Promise<fb.auth.UserCredential>;
};

export default function useFirebaseAuth() {
  const [authUser, setAuthUser] = useState(null);

  const authStateChanged = async (authState: fb.User) => {
    if (!authState) {
      setAuthUser(null);
      return;
    }
    setAuthUser(authState);
  };
  const signInWithToken = (token: string) =>
    firebase.auth.signInWithCustomToken(token);

  useEffect(() => {
    const unsubscribe = firebase.auth.onAuthStateChanged(authStateChanged);
    return () => unsubscribe();
  }, []);

  return {
    authUser,
    signInWithToken,
  };
}
