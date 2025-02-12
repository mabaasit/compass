import type { ActivateHelpers } from 'hadron-app-registry';
import { registerHadronPlugin, type AppRegistry } from 'hadron-app-registry';
import type { SidebarPluginProps } from './plugin';
import SidebarPlugin from './plugin';
import { createSidebarStore } from './stores';
import { mongoDBInstanceLocator } from '@mongodb-js/compass-app-stores/provider';
import { dataServiceLocator } from 'mongodb-data-service/provider';
import type { DataService } from 'mongodb-data-service';
import type { MongoDBInstance } from 'mongodb-instance-model';
import type { LoggerAndTelemetry } from '@mongodb-js/compass-logging/provider';
import { createLoggerAndTelemetryLocator } from '@mongodb-js/compass-logging/provider';

function activate() {
  // noop
}

function deactivate() {
  // noop
}

export const CompassSidebarPlugin = registerHadronPlugin<
  SidebarPluginProps,
  {
    instance: () => MongoDBInstance;
    dataService: () => DataService;
    logger: () => LoggerAndTelemetry;
  }
>(
  {
    name: 'CompassSidebar',
    component: SidebarPlugin,
    activate(
      { initialConnectionInfo }: SidebarPluginProps,
      {
        globalAppRegistry,
        instance,
        dataService,
        logger,
      }: {
        globalAppRegistry: AppRegistry;
        instance: MongoDBInstance;
        dataService: DataService;
        logger: LoggerAndTelemetry;
      },
      helpers: ActivateHelpers
    ) {
      const { store, deactivate } = createSidebarStore(
        {
          globalAppRegistry,
          instance,
          dataService,
          connectionInfo: initialConnectionInfo,
          logger,
        },
        helpers
      );
      return {
        store,
        deactivate,
      };
    },
  },
  {
    instance: mongoDBInstanceLocator,
    dataService: dataServiceLocator,
    logger: createLoggerAndTelemetryLocator('COMPASS-SIDEBAR-UI'),
  }
);

export { activate, deactivate };
export { default as metadata } from '../package.json';
