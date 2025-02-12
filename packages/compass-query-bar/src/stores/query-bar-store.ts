import type AppRegistry from 'hadron-app-registry';
import {
  createStore as _createStore,
  applyMiddleware,
  combineReducers,
} from 'redux';
import thunk from 'redux-thunk';
import type { AnyAction } from 'redux';
import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import type { DataService } from 'mongodb-data-service';
import { DEFAULT_FIELD_VALUES } from '../constants/query-bar-store';
import { mapQueryToFormFields } from '../utils/query';
import {
  queryBarReducer,
  INITIAL_STATE as INITIAL_QUERY_BAR_STATE,
  changeSchemaFields,
  QueryBarActions,
  updatePreferencesMaxTimeMS,
} from './query-bar-reducer';
import { aiQueryReducer, disableAIFeature } from './ai-query-reducer';
import { getQueryAttributes } from '../utils';
import {
  FavoriteQueryStorage,
  RecentQueryStorage,
} from '@mongodb-js/my-queries-storage';
import { AtlasService } from '@mongodb-js/atlas-service/renderer';
import type { PreferencesAccess } from 'compass-preferences-model';
import type { CollectionTabPluginMetadata } from '@mongodb-js/compass-collection';
import type { ActivateHelpers } from 'hadron-app-registry';
import type { MongoDBInstance } from 'mongodb-instance-model';
import { QueryBarStoreContext } from './context';

// Partial of DataService that mms shares with Compass.
type QueryBarDataService = Pick<DataService, 'sample' | 'getConnectionString'>;

type QueryBarServices = {
  instance: MongoDBInstance;
  globalAppRegistry: AppRegistry;
  localAppRegistry: AppRegistry;
  dataService: QueryBarDataService;
  preferences: PreferencesAccess;
};

// TODO(COMPASS-7412, COMPASS-7411): those don't have service injectors
// implemented yet, so we're keeping them separate from the type above
type QueryBarExtraServices = {
  atlasService?: AtlasService;
  favoriteQueryStorage?: FavoriteQueryStorage;
  recentQueryStorage?: RecentQueryStorage;
};

export type QueryBarStoreOptions = CollectionTabPluginMetadata;

export const rootQueryBarReducer = combineReducers({
  queryBar: queryBarReducer,
  aiQuery: aiQueryReducer,
});

export type RootState = ReturnType<typeof rootQueryBarReducer>;

export type QueryBarExtraArgs = {
  globalAppRegistry: AppRegistry;
  localAppRegistry: AppRegistry;
  dataService: Pick<QueryBarDataService, 'sample'>;
  atlasService: AtlasService;
  preferences: PreferencesAccess;
  favoriteQueryStorage: FavoriteQueryStorage;
  recentQueryStorage: RecentQueryStorage;
};

export type QueryBarThunkDispatch<A extends AnyAction = AnyAction> =
  ThunkDispatch<RootState, QueryBarExtraArgs, A>;

export type QueryBarThunkAction<
  R,
  A extends AnyAction = AnyAction
> = ThunkAction<R, RootState, QueryBarExtraArgs, A>;

export function configureStore(
  initialState: Partial<RootState['queryBar']> = {},
  services: QueryBarExtraArgs
) {
  return _createStore(
    rootQueryBarReducer,
    {
      queryBar: {
        ...INITIAL_QUERY_BAR_STATE,
        ...initialState,
      },
    },
    applyMiddleware(thunk.withExtraArgument(services))
  );
}

export function activatePlugin(
  options: QueryBarStoreOptions,
  services: QueryBarServices & QueryBarExtraServices,
  { on, addCleanup, cleanup }: ActivateHelpers
) {
  const { serverVersion, query, namespace } = options;

  const {
    localAppRegistry,
    globalAppRegistry,
    instance,
    dataService,
    preferences,
    atlasService = new AtlasService(),
    recentQueryStorage = new RecentQueryStorage({ namespace }),
    favoriteQueryStorage = new FavoriteQueryStorage({ namespace }),
  } = services;

  const store = configureStore(
    {
      namespace: namespace ?? '',
      host: dataService?.getConnectionString().hosts.join(','),
      serverVersion: serverVersion ?? '3.6.0',
      fields: mapQueryToFormFields(preferences.getPreferences(), {
        ...DEFAULT_FIELD_VALUES,
        ...getQueryAttributes(query ?? {}),
      }),
      isReadonlyConnection: !instance.isWritable,
      preferencesMaxTimeMS: preferences.getPreferences().maxTimeMS ?? null,
    },
    {
      dataService: services.dataService ?? {
        sample: () => {
          /* no-op for environments where dataService is not provided at all. */
          return Promise.resolve([]);
        },
      },
      localAppRegistry,
      globalAppRegistry,
      recentQueryStorage,
      favoriteQueryStorage,
      atlasService,
      preferences,
    }
  );

  addCleanup(
    preferences.onPreferenceValueChanged('maxTimeMS', (newValue) =>
      store.dispatch(updatePreferencesMaxTimeMS(newValue))
    )
  );

  on(instance, 'change:isWritable', () => {
    store.dispatch({
      type: QueryBarActions.ChangeReadonlyConnectionStatus,
      readonly: !instance.isWritable,
    });
  });

  on(atlasService, 'user-config-changed', (config) => {
    if (config.enabledAIFeature === false) {
      store.dispatch(disableAIFeature());
    }
  });

  on(localAppRegistry, 'fields-changed', (fields) => {
    store.dispatch(changeSchemaFields(fields.autocompleteFields));
  });

  return { store, deactivate: cleanup, context: QueryBarStoreContext };
}
