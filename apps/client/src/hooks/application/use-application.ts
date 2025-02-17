import { useNavigate } from 'react-router-dom';
import { useDismissAllNotifications } from '~/hooks/notifications/use-dismiss-all-notifications';
import { useSetNavigationVisibility } from './use-set-navigation-visibility';

/** Use to control the application. */
export function useApplication() {
  const navigateClient = useNavigate();
  const dismissNotifications = useDismissAllNotifications();
  const setNavigationVisibility = useSetNavigationVisibility();

  function closeNavigation() {
    setNavigationVisibility(false);
  }

  /**
   * Navigate the client to a new page.
   *
   * @regards
   * Beware of the order you call this function! It produces side-effects!
   * If you intend to emit a notification at the same time, you should call this function first.
   *
   * Do not use any other method to navigate the client!
   */
  function navigate(href: string) {
    dismissNotifications();
    closeNavigation();
    navigateClient(href);
  }

  return {
    navigate,
  };
}
