import { registerHadronPlugin } from 'hadron-app-registry';
import { createLoggerAndTelemetryLocator } from '@mongodb-js/compass-logging/provider';
import {
  dataServiceLocator,
  type DataServiceLocator,
} from 'mongodb-data-service/provider';
import { mongoDBInstanceLocator } from '@mongodb-js/compass-app-stores/provider';
import { CollectionsPlugin } from './collections-plugin';
import {
  DropNamespaceComponent,
  activatePlugin as activateDropNamespacePlugin,
} from './stores/drop-namespace';
import CreateNamespaceModal from './components/create-namespace-modal';
import { activatePlugin as activateCreateNamespacePlugin } from './stores/create-namespace';
import { DatabasesPlugin } from './databases-plugin';
import MappedRenameCollectionModal from './components/rename-collection-modal/rename-collection-modal';
import { activateRenameCollectionPlugin } from './stores/rename-collection';
import type { WorkspaceComponent } from '@mongodb-js/compass-workspaces';
import { workspacesServiceLocator } from '@mongodb-js/compass-workspaces/provider';

export const CollectionsWorkspaceTab: WorkspaceComponent<'Collections'> = {
  name: 'Collections' as const,
  component: CollectionsPlugin,
};

export const DatabasesWorkspaceTab: WorkspaceComponent<'Databases'> = {
  name: 'Databases' as const,
  component: DatabasesPlugin,
};

export const CreateNamespacePlugin = registerHadronPlugin(
  {
    name: 'CreateNamespace',
    activate: activateCreateNamespacePlugin,
    component: CreateNamespaceModal,
  },
  {
    logger: createLoggerAndTelemetryLocator('COMPASS-CREATE-NAMESPACE-UI'),
    dataService: dataServiceLocator as DataServiceLocator<
      'createCollection' | 'createDataKey' | 'configuredKMSProviders'
    >,
    instance: mongoDBInstanceLocator,
    workspaces: workspacesServiceLocator,
  }
);

export const DropNamespacePlugin = registerHadronPlugin(
  {
    name: 'DropNamespace',
    component: DropNamespaceComponent,
    activate: activateDropNamespacePlugin,
  },
  {
    logger: createLoggerAndTelemetryLocator('COMPASS-DROP-NAMESPACE-UI'),
    dataService: dataServiceLocator as DataServiceLocator<
      'dropDatabase' | 'dropCollection'
    >,
  }
);

export const RenameCollectionPlugin = registerHadronPlugin(
  {
    name: 'RenameCollectionPlugin',
    component: MappedRenameCollectionModal,
    activate: activateRenameCollectionPlugin,
  },
  {
    dataService:
      dataServiceLocator as typeof dataServiceLocator<'renameCollection'>,
  }
);

function activate() {
  // noop
}

function deactivate() {
  // noop
}

export { activate, deactivate };
export { default as metadata } from '../package.json';
