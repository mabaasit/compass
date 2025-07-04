import type { Stage } from '@mongodb-js/explain-plan-helper';
import { ExplainPlan } from '@mongodb-js/explain-plan-helper';
import { capMaxTimeMSAtPreferenceLimit } from 'compass-preferences-model/provider';
import type { Action, AnyAction, Reducer } from 'redux';
import type { ThunkAction } from 'redux-thunk';
import type { ExplainPlanModalServices, OpenExplainPlanModalEvent } from '.';

export function isAction<A extends AnyAction>(
  action: AnyAction,
  type: A['type']
): action is A {
  return action.type === type;
}

export type SerializedExplainPlan = ReturnType<ExplainPlan['serialize']>;

enum ExplainPlanModalActionTypes {
  CloseExplainPlanModal = 'compass-explain-plan-modal/CloseExplainPlanModal',
  FetchExplainPlanModalLoading = 'compass-explain-plan-modal/FetchExplainPlanModalLoading',
  FetchExplainPlanModalSuccess = 'compass-explain-plan-modal/FetchExplainPlanModalSuccess',
  FetchExplainPlanModalError = 'compass-explain-plan-modal/FetchExplainPlanModalError',
}

type CloseExplainPlanModalAction = {
  type: ExplainPlanModalActionTypes.CloseExplainPlanModal;
};

type FetchExplainPlanModalLoadingAction = {
  type: ExplainPlanModalActionTypes.FetchExplainPlanModalLoading;
  id: number;
};

type FetchExplainPlanModalSuccessAction = {
  type: ExplainPlanModalActionTypes.FetchExplainPlanModalSuccess;
  explainPlan: SerializedExplainPlan;
  rawExplainPlan: unknown;
};

type FetchExplainPlanModalErrorAction = {
  type: ExplainPlanModalActionTypes.FetchExplainPlanModalError;
  error: string;
  rawExplainPlan: unknown;
};

export type ExplainPlanModalState = {
  namespace: string;
  isDataLake: boolean;
  error: string | null;
  isModalOpen: boolean;
  status: 'initial' | 'loading' | 'ready' | 'error';
  explainPlan: SerializedExplainPlan | null;
  rawExplainPlan: unknown;
  explainPlanFetchId: number;
};

type ExplainPlanModalThunkAction<R, A extends Action = AnyAction> = ThunkAction<
  R,
  ExplainPlanModalState,
  ExplainPlanModalServices,
  A
>;

export const INITIAL_STATE: ExplainPlanModalState = {
  namespace: '',
  isDataLake: false,
  error: null,
  isModalOpen: false,
  status: 'initial',
  explainPlan: null,
  rawExplainPlan: null,
  explainPlanFetchId: -1,
};

export const reducer: Reducer<ExplainPlanModalState, Action> = (
  state = INITIAL_STATE,
  action
) => {
  if (
    isAction<FetchExplainPlanModalLoadingAction>(
      action,
      ExplainPlanModalActionTypes.FetchExplainPlanModalLoading
    )
  ) {
    return {
      ...state,
      isModalOpen: true,
      status: 'loading',
      error: null,
      explainPlan: null,
      rawExplainPlan: null,
      explainPlanFetchId: action.id,
    };
  }

  if (
    isAction<FetchExplainPlanModalSuccessAction>(
      action,
      ExplainPlanModalActionTypes.FetchExplainPlanModalSuccess
    )
  ) {
    return {
      ...state,
      status: 'ready',
      explainPlan: action.explainPlan,
      rawExplainPlan: action.rawExplainPlan,
      explainPlanFetchId: -1,
    };
  }

  if (
    isAction<FetchExplainPlanModalErrorAction>(
      action,
      ExplainPlanModalActionTypes.FetchExplainPlanModalError
    )
  ) {
    return {
      ...state,
      status: 'error',
      explainPlan: null,
      error: action.error,
      rawExplainPlan: action.rawExplainPlan,
      explainPlanFetchId: -1,
    };
  }

  if (
    isAction<CloseExplainPlanModalAction>(
      action,
      ExplainPlanModalActionTypes.CloseExplainPlanModal
    )
  ) {
    return {
      ...state,
      // We don't reset the state completely so that the closing modal content
      // doesn't jump during closing animation
      isModalOpen: false,
    };
  }

  return state;
};

const ExplainPlanAbortControllerMap = new Map<number, AbortController>();

let explainPlanFetchId = 0;

function getAbortSignal() {
  const id = ++explainPlanFetchId;
  const controller = new AbortController();
  ExplainPlanAbortControllerMap.set(id, controller);
  return { id, signal: controller.signal };
}

function abort(id: number) {
  const controller = ExplainPlanAbortControllerMap.get(id);
  controller?.abort();
  return ExplainPlanAbortControllerMap.delete(id);
}

function cleanupAbortSignal(id: number) {
  return ExplainPlanAbortControllerMap.delete(id);
}

const isOutputStage = (stage: unknown): boolean => {
  return (
    Object.prototype.hasOwnProperty.call(stage, '$out') ||
    Object.prototype.hasOwnProperty.call(stage, '$merge')
  );
};

const DEFAULT_MAX_TIME_MS = 60_000;

export const openExplainPlanModal = (
  event: OpenExplainPlanModalEvent
): ExplainPlanModalThunkAction<Promise<void>> => {
  return async (
    dispatch,
    getState,
    {
      dataService,
      preferences,
      track,
      connectionInfoRef,
      logger: { log, mongoLogId },
    }
  ) => {
    const { id: fetchId, signal } = getAbortSignal();

    const connectionInfo = connectionInfoRef.current;

    let rawExplainPlan = null;
    let explainPlan = null;

    dispatch({
      type: ExplainPlanModalActionTypes.FetchExplainPlanModalLoading,
      id: fetchId,
    });

    const { isDataLake, namespace } = getState();

    const explainVerbosity = isDataLake
      ? 'queryPlannerExtended'
      : 'executionStats';

    try {
      if (event.aggregation) {
        const { collation, maxTimeMS } = event.aggregation;
        const pipeline = event.aggregation.pipeline.filter((stage) => {
          // Getting explain plan for a pipeline with an out / merge stage can
          // cause data corruption issues in non-genuine MongoDB servers, for
          // example CosmosDB actually executes pipeline and persists data, even
          // when the stage is not at the end of the pipeline. To avoid
          // introducing branching logic based on MongoDB genuineness, we just
          // filter out all output stages here instead
          return !isOutputStage(stage);
        });

        const explainOptions = {
          maxTimeMS: capMaxTimeMSAtPreferenceLimit(
            preferences,
            maxTimeMS ?? DEFAULT_MAX_TIME_MS
          ),
        };

        rawExplainPlan = await dataService.explainAggregate(
          namespace,
          pipeline,
          { ...explainOptions, collation },
          { explainVerbosity, abortSignal: signal }
        );

        try {
          explainPlan = new ExplainPlan(rawExplainPlan as Stage).serialize();
        } catch (err) {
          log.warn(
            mongoLogId(1_001_000_137),
            'Explain',
            'Failed to parse aggregation explain',
            { message: (err as Error).message }
          );
          throw err;
        }

        track(
          'Aggregation Explained',
          {
            num_stages: pipeline.length,
            index_used: explainPlan.usedIndexes.length > 0,
          },
          connectionInfo
        );
      }

      if (event.query) {
        const { filter, ...options } = event.query;

        const explainOptions = {
          ...options,
          maxTimeMS: capMaxTimeMSAtPreferenceLimit(
            preferences,
            options.maxTimeMS ?? DEFAULT_MAX_TIME_MS
          ),
        };

        rawExplainPlan = await dataService.explainFind(
          namespace,
          filter,
          explainOptions,
          { explainVerbosity, abortSignal: signal }
        );

        try {
          explainPlan = new ExplainPlan(rawExplainPlan as Stage).serialize();
        } catch (err) {
          log.warn(
            mongoLogId(1_001_000_192),
            'Explain',
            'Failed to parse find explain',
            { message: (err as Error).message }
          );
          throw err;
        }

        track(
          'Explain Plan Executed',
          {
            with_filter: Object.entries(filter).length > 0,
            index_used: explainPlan.usedIndexes.length > 0,
          },
          connectionInfo
        );
      }

      dispatch({
        type: ExplainPlanModalActionTypes.FetchExplainPlanModalSuccess,
        explainPlan,
        rawExplainPlan,
      });
    } catch (err) {
      if (dataService.isCancelError(err)) {
        // Cancellation can be caused only by close modal action and handled
        // there
        return;
      }
      log.error(mongoLogId(1_001_000_138), 'Explain', 'Failed to run explain', {
        message: (err as Error).message,
      });
      dispatch({
        type: ExplainPlanModalActionTypes.FetchExplainPlanModalError,
        error: (err as Error).message,
        rawExplainPlan,
      });
    } finally {
      // Remove AbortController from the Map as we either finished waiting for
      // the fetch or cancelled at this point
      cleanupAbortSignal(fetchId);
    }
  };
};

export const closeExplainPlanModal = (): ExplainPlanModalThunkAction<void> => {
  return (dispatch, getState) => {
    abort(getState().explainPlanFetchId);
    dispatch({
      type: ExplainPlanModalActionTypes.CloseExplainPlanModal,
    });
  };
};

export const openCreateIndexModal = (): ExplainPlanModalThunkAction<void> => {
  return (_dispatch, _getState, { localAppRegistry }) => {
    localAppRegistry?.emit('open-create-index-modal');
  };
};
