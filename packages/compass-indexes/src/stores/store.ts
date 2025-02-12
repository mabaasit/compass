import type { Store } from 'redux';
import { createStore, applyMiddleware } from 'redux';
import type { IndexesThunkDispatch, RootState } from '../modules';
import reducer from '../modules';
import thunk from 'redux-thunk';
import {
  localAppRegistryActivated,
  globalAppRegistryActivated,
} from '@mongodb-js/mongodb-redux-common/app-registry';
import { writeStateChanged } from '../modules/is-writable';
import { getDescription } from '../modules/description';
import { INITIAL_STATE as INDEX_LIST_INITIAL_STATE } from '../modules/index-view';
import {
  fetchIndexes,
  inProgressIndexAdded,
  inProgressIndexRemoved,
  inProgressIndexFailed,
  type InProgressIndex,
} from '../modules/regular-indexes';
import {
  INITIAL_STATE as SEARCH_INDEXES_INITIAL_STATE,
  refreshSearchIndexes,
  SearchIndexesStatuses,
  showCreateModal,
} from '../modules/search-indexes';
import type { DataService } from 'mongodb-data-service';
import type AppRegistry from 'hadron-app-registry';
import { setFields } from '../modules/fields';
import { switchToRegularIndexes } from '../modules/index-view';
import type { ActivateHelpers } from 'hadron-app-registry';
import type { MongoDBInstance } from '@mongodb-js/compass-app-stores/provider';
import type { LoggerAndTelemetry } from '@mongodb-js/compass-logging';

export type IndexesDataServiceProps =
  | 'indexes'
  | 'isConnected'
  | 'updateCollection'
  | 'createIndex'
  | 'dropIndex'
  | 'getSearchIndexes'
  | 'createSearchIndex'
  | 'updateSearchIndex'
  | 'dropSearchIndex';
export type IndexesDataService = Pick<DataService, IndexesDataServiceProps>;

export type IndexesPluginServices = {
  dataService: IndexesDataService;
  instance: MongoDBInstance;
  localAppRegistry: Pick<
    AppRegistry,
    'on' | 'emit' | 'removeListener' | 'getStore'
  >;
  globalAppRegistry: Pick<
    AppRegistry,
    'on' | 'emit' | 'removeListener' | 'getStore'
  >;
  logger: LoggerAndTelemetry;
};

export type IndexesPluginOptions = {
  namespace: string;
  serverVersion: string;
  isReadonly: boolean;
  isSearchIndexesSupported: boolean;
};

export type IndexesStore = Store<RootState> & {
  dispatch: IndexesThunkDispatch;
};

export function activateIndexesPlugin(
  options: IndexesPluginOptions,
  {
    dataService,
    instance,
    localAppRegistry,
    globalAppRegistry,
    logger,
  }: IndexesPluginServices,
  { on, cleanup }: ActivateHelpers
) {
  const store: IndexesStore = createStore(
    reducer,
    {
      dataService,
      namespace: options.namespace,
      serverVersion: options.serverVersion,
      isReadonlyView: options.isReadonly,
      fields: [],
      indexView: INDEX_LIST_INITIAL_STATE,
      searchIndexes: {
        ...SEARCH_INDEXES_INITIAL_STATE,
        status: options.isSearchIndexesSupported
          ? SearchIndexesStatuses.NOT_READY
          : SearchIndexesStatuses.NOT_AVAILABLE,
      },
    },
    applyMiddleware(
      thunk.withExtraArgument({
        localAppRegistry,
        globalAppRegistry,
        logger,
      })
    )
  );

  // Set the app registry if preset. This must happen first.
  store.dispatch(localAppRegistryActivated(localAppRegistry));

  on(localAppRegistry, 'refresh-regular-indexes', () => {
    void store.dispatch(fetchIndexes());
  });

  on(
    localAppRegistry,
    'in-progress-indexes-added',
    (index: InProgressIndex) => {
      store.dispatch(inProgressIndexAdded(index));
      store.dispatch(switchToRegularIndexes());
    }
  );

  on(localAppRegistry, 'in-progress-indexes-removed', (id: string) => {
    store.dispatch(inProgressIndexRemoved(id));
  });

  on(
    localAppRegistry,
    'in-progress-indexes-failed',
    (data: { inProgressIndexId: string; error: string }) => {
      store.dispatch(inProgressIndexFailed(data));
    }
  );

  on(localAppRegistry, 'fields-changed', (fields) => {
    store.dispatch(setFields(fields.autocompleteFields));
  });

  on(localAppRegistry, 'open-create-search-index-modal', () => {
    store.dispatch(showCreateModal());
  });

  store.dispatch(globalAppRegistryActivated(globalAppRegistry));

  on(globalAppRegistry, 'refresh-data', () => {
    void store.dispatch(fetchIndexes());
    void store.dispatch(refreshSearchIndexes());
  });

  // set the initial values
  store.dispatch(writeStateChanged(instance.isWritable));
  store.dispatch(getDescription(instance.description));

  // these can change later
  on(instance, 'change:isWritable', () => {
    store.dispatch(writeStateChanged(instance.isWritable));
  });
  on(instance, 'change:description', () => {
    store.dispatch(getDescription(instance.description));
  });

  return { store, deactivate: () => cleanup() };
}
