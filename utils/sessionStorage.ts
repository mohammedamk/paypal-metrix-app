import db from "./db";

/*
  The storeCallback takes in the Session, and sets it in Firestore
  This callback is used for BOTH saving new Sessions and updating existing Sessions
  Returns a Firebase write result if the session can be stored
*/
export const storeCallback = async (session) => {
  console.log(
    `Custom session storage storeCallback fired with id [${session.id}]`
  );
  try {
    await db
      .doc(`app-sessions/${session.id}`)
      .set(JSON.parse(JSON.stringify(session)), { merge: true });
    return true;
  } catch (err) {
    throw new Error(err);
  }
};

/*
  The loadCallback takes in the id, and tries to retrieve the session data from Firestore
  If a stored session exists, it's returned
  Otherwise, return undefined
  */
export const loadCallback = async (id) => {
  console.log(`Custom session storage loadCallback fired with id [${id}]`);
  try {
    const sessionSnapshot = await db.doc(`app-sessions/${id}`).get();
    if (!sessionSnapshot.exists) {
      console.log(`Custom session storage session id [${id}] does not exist`);
      return undefined;
    }
    const session = sessionSnapshot.data();
    if (!session) {
      console.log(`Custom session storage session id [${id}] no data`);
      return undefined;
    }
    return session;
  } catch (err) {
    throw new Error(err);
  }
};

/*
    The deleteCallback takes in the id, and attempts to delete the session from Firestore
    If the session can be deleted, return true,
    otherwise, return false
  */
export const deleteCallback = async (id) => {
  console.log(`Custom session storage deleteCallback fired with id [${id}]`);
  try {
    const sessionSnapshot = await db.doc(`app-sessions/${id}`).get();
    if (!sessionSnapshot.exists) {
      console.log(`Custom session storage session id [${id}] does not exist`);
      return false;
    }
    await db.doc(`app-sessions/${id}`).delete();
    return true;
  } catch (err) {
    throw new Error(err);
  }
};
