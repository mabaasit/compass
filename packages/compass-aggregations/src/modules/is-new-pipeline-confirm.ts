import type { PipelineBuilderThunkAction } from '.';
import { updatePipelinePreview } from './pipeline-builder/builder-helpers';
import { showConfirmation } from '@mongodb-js/compass-components';
import { createLoggerAndTelemetry } from '@mongodb-js/compass-logging';
import type Stage from './pipeline-builder/stage';
import type { Document } from 'bson';
import type { PipelineParserError } from './pipeline-builder/pipeline-parser/utils';
const { track } = createLoggerAndTelemetry('COMPASS-AGGREGATIONS');

export enum ActionTypes {
  NewPipelineConfirmed = 'compass-aggregations/is-new-pipeline-confirm/newPipelineConfirmed',
}
export type NewPipelineConfirmedAction = {
  type: ActionTypes.NewPipelineConfirmed;
  stages: Stage[];
  pipelineText: string;
  pipeline: Document[] | null;
  syntaxErrors: PipelineParserError[];
};

/**
 * Confirm new pipeline action
 */
export const confirmNewPipeline =
  (): PipelineBuilderThunkAction<void> =>
  async (dispatch, getState, { pipelineBuilder }) => {
    const isModified = getState().isModified;
    if (isModified) {
      track('Screen', { name: 'confirm_new_pipeline_modal' });
      const confirmed = await showConfirmation({
        title: 'Are you sure you want to create a new pipeline?',
        description:
          'Creating this pipeline will abandon unsaved changes to the current pipeline.',
      });
      if (!confirmed) {
        return;
      }
    }
    pipelineBuilder.reset();
    dispatch({
      type: ActionTypes.NewPipelineConfirmed,
      stages: pipelineBuilder.stages,
      pipelineText: pipelineBuilder.source,
      pipeline: pipelineBuilder.pipeline,
      syntaxErrors: pipelineBuilder.syntaxError,
    });
    dispatch(updatePipelinePreview());
  };
