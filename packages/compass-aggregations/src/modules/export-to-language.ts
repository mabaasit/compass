import { localAppRegistryEmit } from '@mongodb-js/mongodb-redux-common/app-registry';
import { getPipelineStringFromBuilderState } from './pipeline-builder/builder-helpers';
import type { PipelineBuilderThunkAction } from '.';

/**
 * Action creator for export to language events.
 *
 * @returns {Function} The export to language function.
 */
export const exportToLanguage = (): PipelineBuilderThunkAction<void> => {
  return (dispatch, getState, { pipelineBuilder }) => {
    const pipeline = getPipelineStringFromBuilderState(
      getState(),
      pipelineBuilder
    );
    dispatch(
      localAppRegistryEmit('open-aggregation-export-to-language', pipeline)
    );
  };
};
