import useFirebaseAuth, { UseFirebaseAuth } from "hooks/useFirebaseAuth";
import { createContext, useContext } from "react";

const AuthContext = createContext<UseFirebaseAuth>(undefined!);

interface Props {
  children: React.ReactNode;
}
export const useAuth = () => useContext(AuthContext);

export function AuthUserProvider({ children }) {
  const auth = useFirebaseAuth();
  return (
    <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
  );
}
