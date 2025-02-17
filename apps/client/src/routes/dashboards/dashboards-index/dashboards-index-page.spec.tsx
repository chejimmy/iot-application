import { vi } from 'vitest';
import { render, screen, waitFor } from '~/helpers/tests/testing-library';
import userEvent from '@testing-library/user-event';

import { DashboardsIndexPage } from './dashboards-index-page';
import { DashboardSummary, $Dashboard } from '~/services';

const navigateMock = vi.fn();
vi.mock('~/hooks/application/use-application', () => ({
  useApplication: () => ({
    navigate: navigateMock,
  }),
}));

function getDashboardStubs() {
  return [
    {
      id: '123456789012',
      name: 'test name',
      description: 'test description',
      lastUpdateDate: '2021-01-01T00:00:00.000Z',
      creationDate: '2021-01-01T00:00:00.000Z',
    },
  ] as const satisfies Readonly<DashboardSummary[]>;
}

vi.mock('./hooks/use-dashboards-query', () => ({
  useDashboardsQuery: vi.fn().mockReturnValue({
    data: getDashboardStubs(),
    isLoading: false,
  }),
}));

vi.mock('./hooks/use-partial-update-dashboard-mutation', () => ({
  usePartialUpdateDashboardMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
  }),
}));

vi.mock('./hooks/use-delete-dashboard-mutation', () => ({
  useDeleteDashboardMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
  }),
}));

const getDashboardLink = (id: string) => screen.getByRole('link', { name: id });

// TODO: Find a way to reduce duplication of strings
const getDashboardNameField = () =>
  screen.getByPlaceholderText('Enter dashboard name');
const queryDashboardNameField = () =>
  screen.queryByPlaceholderText('Enter dashboard name');

const getDashboardNameCell = (name: string) =>
  screen.getByRole('cell', { name });

const getDashboardNameRequiredError = () =>
  screen.getByText('Dashboard name is required.');
const queryDashboardNameRequiredError = () =>
  screen.queryByText('Dashboard name is required.');

const getDashboardNameTooLongError = () =>
  screen.getByText(/Dashboard name must be \d+ characters or less./);
const queryDashboardNameTooLongError = () =>
  screen.queryByText(/Dashboard name must be \d+ characters or less./);

const getDashboardDescriptionField = () =>
  screen.getByPlaceholderText('Enter dashboard description');
const queryDashboardDescriptionField = () =>
  screen.queryByPlaceholderText('Enter dashboard description');

const getDashboardDescriptionCell = (description: string) =>
  screen.getByRole('cell', { name: description });

const getDashboardDescriptionRequiredError = () =>
  screen.getByText('Dashboard description is required.');
const queryDashboardDescriptionRequiredError = () =>
  screen.queryByText('Dashboard description is required.');

const getDashboardDescriptionTooLongError = () =>
  screen.getByText(/Dashboard description must be \d+ characters or less./);
const queryDashboardDescriptionTooLongError = () =>
  screen.queryByText(/Dashboard description must be \d+ characters or less./);

const getCancelButton = () => screen.getByRole('button', { name: 'Cancel' });

describe('<DashboardsIndexPage />', () => {
  describe('navigation to dashboard', () => {
    it('should navigate to the dashboard when the id is clicked', async () => {
      render(<DashboardsIndexPage />);

      await userEvent.click(getDashboardLink(getDashboardStubs()[0].id));

      expect(navigateMock).toHaveBeenCalledWith(
        `/dashboards/${getDashboardStubs()[0].id}`,
      );
    });
  });

  describe('inline editing', () => {
    it('should render a validation error when the name is empty', async () => {
      const user = userEvent.setup();
      render(<DashboardsIndexPage />);

      expect(queryDashboardNameField()).not.toBeInTheDocument();

      await waitFor(async () => {
        await user.click(getDashboardNameCell('test name'));
      });

      expect(getDashboardNameField()).toBeVisible();
      expect(queryDashboardNameRequiredError()).not.toBeInTheDocument();

      await waitFor(async () => {
        await user.clear(getDashboardNameField());
      });

      expect(getDashboardNameRequiredError()).toBeVisible();
    });

    it('should render a validation error when the name is too long', async () => {
      const user = userEvent.setup();
      render(<DashboardsIndexPage />);

      await waitFor(async () => {
        await user.click(getDashboardNameCell('test name'));
      });

      expect(queryDashboardNameTooLongError()).not.toBeInTheDocument();

      await waitFor(
        async () => {
          await user.clear(getDashboardNameField());
          await user.type(
            getDashboardNameField(),
            'a'.repeat($Dashboard.properties.name.maxLength + 1),
          );
        },
        {
          timeout: 5000,
        },
      );

      expect(getDashboardNameTooLongError()).toBeVisible();
    });

    it('should remove the name validation error on cancel', async () => {
      const user = userEvent.setup();
      render(<DashboardsIndexPage />);

      await waitFor(
        async () => {
          await user.click(getDashboardNameCell('test name'));
          await user.clear(getDashboardNameField());
          await user.click(getCancelButton());
        },
        {
          timeout: 5000,
        },
      );

      expect(queryDashboardNameRequiredError()).not.toBeInTheDocument();
    });

    it('should not retain the name validation error on cancel', async () => {
      const user = userEvent.setup();
      render(<DashboardsIndexPage />);

      await waitFor(
        async () => {
          await user.click(getDashboardNameCell('test name'));
          await user.clear(getDashboardNameField());
          await user.click(getCancelButton());
          await user.click(getDashboardNameCell('test name'));
        },
        {
          timeout: 5000,
        },
      );

      expect(queryDashboardNameRequiredError()).not.toBeInTheDocument();
    });

    it('should render a validation error when the description is empty', async () => {
      const user = userEvent.setup();
      render(<DashboardsIndexPage />);

      expect(queryDashboardDescriptionField()).not.toBeInTheDocument();

      await waitFor(async () => {
        await user.click(getDashboardDescriptionCell('test description'));
      });

      expect(queryDashboardDescriptionRequiredError()).not.toBeInTheDocument();

      await waitFor(async () => {
        await user.clear(getDashboardDescriptionField());
      });

      expect(getDashboardDescriptionRequiredError()).toBeVisible();
    });

    it('should render a validation error when the description is too long', async () => {
      const user = userEvent.setup();
      render(<DashboardsIndexPage />);

      await waitFor(async () => {
        await user.click(getDashboardDescriptionCell('test description'));
      });

      expect(queryDashboardDescriptionTooLongError()).not.toBeInTheDocument();

      await waitFor(
        async () => {
          await user.clear(getDashboardDescriptionField());
          await user.type(
            getDashboardDescriptionField(),
            'a'.repeat($Dashboard.properties.description.maxLength + 1),
          );
        },
        {
          timeout: 5000,
        },
      );

      expect(getDashboardDescriptionTooLongError()).toBeVisible();
    });

    it('should remove the description validation error on cancel', async () => {
      const user = userEvent.setup();
      render(<DashboardsIndexPage />);

      await waitFor(
        async () => {
          await user.click(getDashboardDescriptionCell('test description'));
          await user.clear(getDashboardDescriptionField());
          await user.click(getCancelButton());
        },
        {
          timeout: 5000,
        },
      );

      expect(queryDashboardDescriptionRequiredError()).not.toBeInTheDocument();
    });

    it('should not retain the description validation error on cancel', async () => {
      const user = userEvent.setup();
      render(<DashboardsIndexPage />);

      await waitFor(
        async () => {
          await user.click(getDashboardDescriptionCell('test description'));
          await user.clear(getDashboardDescriptionField());
          await user.click(getCancelButton());
          await user.click(getDashboardDescriptionCell('test description'));
        },
        {
          timeout: 5000,
        },
      );

      expect(queryDashboardDescriptionRequiredError()).not.toBeInTheDocument();
    });
  });
});
