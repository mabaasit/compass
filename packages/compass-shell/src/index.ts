import type { LoggerAndTelemetry } from '@mongodb-js/compass-logging/provider';
import { createLoggerAndTelemetryLocator } from '@mongodb-js/compass-logging/provider';
import { ShellPlugin, onActivated } from './plugin';
import { registerHadronPlugin } from 'hadron-app-registry';
import { dataServiceLocator } from 'mongodb-data-service/provider';
import type { DataService } from 'mongodb-data-service';
import {
  preferencesLocator,
  type PreferencesAccess,
} from 'compass-preferences-model/provider';

function activate(): void {
  // noop
}

function deactivate(): void {
  // noop
}

export const CompassShellPlugin = registerHadronPlugin<
  unknown,
  {
    logger: () => LoggerAndTelemetry;
    dataService: () => DataService;
    preferences: () => PreferencesAccess;
  }
>(
  {
    name: 'CompassShell',
    component: ShellPlugin,
    activate: onActivated,
  },
  {
    logger: createLoggerAndTelemetryLocator('COMPASS-SHELL'),
    dataService: dataServiceLocator,
    preferences: preferencesLocator,
  }
);

export { activate, deactivate };
export { default as metadata } from '../package.json';
