import _SideNavigation from '@cloudscape-design/components/side-navigation';
import { useIntl } from 'react-intl';

import { useActiveHref } from './hooks/use-active-href';
import { DASHBOARDS_HREF, ROOT_HREF } from '~/constants';
import { preventFullPageLoad } from '~/helpers/events';
import { useApplication } from '~/hooks/application/use-application';

export function SideNavigation() {
  const activeHref = useActiveHref();
  const intl = useIntl();
  const { navigate } = useApplication();

  return (
    <_SideNavigation
      activeHref={activeHref}
      header={{
        href: ROOT_HREF,
        text: intl.formatMessage({
          defaultMessage: 'IoT Application',
          description: 'side navigation home link',
        }),
      }}
      items={[
        {
          type: 'link',
          href: DASHBOARDS_HREF,
          text: intl.formatMessage({
            defaultMessage: 'Dashboards',
            description: 'side navigation dashboards link',
          }),
        },
      ]}
      onFollow={(event) => {
        preventFullPageLoad(event);
        navigate(event.detail.href);
      }}
    />
  );
}
