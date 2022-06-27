import { useAppBridge } from "@shopify/app-bridge-react";
import { NavigationMenu, AppLink } from '@shopify/app-bridge/actions';
import { createContext, useContext } from "react";
const NavigationContext = createContext<NavigationMenu.NavigationMenu>(undefined!);
export const useNavigation = () => useContext(NavigationContext);
export function NavigationProvider({ children }) {
  const app = useAppBridge()
  const dashboardLink = AppLink.create(app, {
    label: 'Dashboard',
    destination: '/',
  });
  const settingsLink = AppLink.create(app, {
    label: 'Settings',
    destination: '/settings',
  });
  const menuItems = [dashboardLink, settingsLink]

  const navigationMenu = NavigationMenu.create(app, {
    items: menuItems,
    active: undefined
  });
  return (
    <NavigationContext.Provider value={navigationMenu}>{children}</NavigationContext.Provider>
  );
}



