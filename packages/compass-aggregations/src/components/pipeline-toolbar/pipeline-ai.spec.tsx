import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { expect } from 'chai';
import { Provider } from 'react-redux';
import type { PreferencesAccess } from 'compass-preferences-model';
import { createSandboxFromDefaultPreferences } from 'compass-preferences-model';
import userEvent from '@testing-library/user-event';
import PipelineAI from './pipeline-ai';
import configureStore from '../../../test/configure-store';
import {
  AIPipelineActionTypes,
  changeAIPromptText,
  showInput,
} from '../../modules/pipeline-builder/pipeline-ai';
import type { ConfigureStoreOptions } from '../../stores/store';
import { PreferencesProvider } from 'compass-preferences-model/provider';
import { createLoggerAndTelemetry } from '@mongodb-js/compass-logging';
import { LoggerAndTelemetryProvider } from '@mongodb-js/compass-logging/provider';

const mockAtlasService = {
  signIn() {
    return Promise.resolve({});
  },
  enableAIFeature() {
    return Promise.resolve(true);
  },
  on() {},
} as any;

const feedbackPopoverTextAreaId = 'feedback-popover-textarea';
const thumbsUpId = 'ai-feedback-thumbs-up';

describe('PipelineAI Component', function () {
  let preferences: PreferencesAccess;
  let store: ReturnType<typeof configureStore>;

  const renderPipelineAI = (opts: Partial<ConfigureStoreOptions> = {}) => {
    const store = configureStore(
      { atlasService: mockAtlasService, ...opts },
      undefined,
      { preferences }
    );
    render(
      <PreferencesProvider value={preferences}>
        <LoggerAndTelemetryProvider
          value={{ createLogger: createLoggerAndTelemetry, preferences }}
        >
          <Provider store={store}>
            <PipelineAI />
          </Provider>
        </LoggerAndTelemetryProvider>
      </PreferencesProvider>
    );
    return store;
  };

  beforeEach(async function () {
    preferences = await createSandboxFromDefaultPreferences();
    store = renderPipelineAI();
    await store.dispatch(showInput());
  });

  afterEach(function () {
    (store as any) = null;
    cleanup();
  });

  describe('when rendered', function () {
    it('closes the input', async function () {
      userEvent.click(screen.getByRole('button', { name: 'Close AI Helper' }));
      expect(await screen.queryByTestId('close-ai-button')).to.eq(null);
    });
  });

  describe('when rendered with text', function () {
    beforeEach(function () {
      store.dispatch(changeAIPromptText('test'));
    });

    it('calls to clear the text when the X is clicked', function () {
      expect(store.getState().pipelineBuilder.aiPipeline.aiPromptText).to.equal(
        'test'
      );

      userEvent.click(screen.getByRole('button', { name: 'Clear prompt' }));

      expect(store.getState().pipelineBuilder.aiPipeline.aiPromptText).to.equal(
        ''
      );
    });
  });

  describe('when a pipeline created from query', function () {
    it('inserts user prompt', function () {
      expect(store.getState().pipelineBuilder.aiPipeline.aiPromptText).to.equal(
        ''
      );

      store.dispatch({
        type: AIPipelineActionTypes.PipelineGeneratedFromQuery,
        pipelineText: '[{$group: {_id: "$price"}}]',
        pipeline: [{ $group: { _id: '$price' } }],
        syntaxErrors: [],
        stages: [],
        text: 'group by price',
      });

      expect(store.getState().pipelineBuilder.aiPipeline.aiPromptText).to.equal(
        'group by price'
      );
    });
  });

  describe('Pipeline AI Feedback', function () {
    describe('usage statistics enabled', function () {
      beforeEach(async function () {
        // 'compass:track' will only emit if tracking is enabled.
        await preferences.savePreferences({ trackUsageStatistics: true });
        store = renderPipelineAI();
        await store.dispatch(showInput());
      });

      it('should log a telemetry event with the entered text on submit', async function () {
        // Note: This is coupling this test with internals of the logger and telemetry.
        // We're doing this as this is a unique case where we're using telemetry
        // for feedback. Avoid repeating this elsewhere.
        const trackingLogs: any[] = [];
        process.on('compass:track', (event) => trackingLogs.push(event));

        // No feedback popover is shown yet.
        expect(screen.queryByTestId(feedbackPopoverTextAreaId)).to.not.exist;
        expect(screen.queryByTestId(thumbsUpId)).to.not.exist;

        store.dispatch({
          type: AIPipelineActionTypes.LoadGeneratedPipeline,
          pipelineText: '[{$group: {_id: "$price"}}]',
          pipeline: [{ $group: { _id: '$price' } }],
          syntaxErrors: [],
          stages: [],
        });

        expect(screen.queryByTestId(feedbackPopoverTextAreaId)).to.not.exist;

        userEvent.click(
          screen.getByRole('button', { name: 'Submit positive feedback' })
        );

        const textArea = screen.getByTestId(feedbackPopoverTextAreaId);
        expect(textArea).to.be.visible;

        userEvent.type(textArea, 'this is the pipeline I was looking for');

        userEvent.click(screen.getByRole('button', { name: 'Submit' }));

        await waitFor(
          () => {
            // No feedback popover is shown.
            expect(screen.queryByTestId(feedbackPopoverTextAreaId)).to.not
              .exist;
            expect(trackingLogs).to.deep.equal([
              {
                event: 'PipelineAI Feedback',
                properties: {
                  feedback: 'positive',
                  text: 'this is the pipeline I was looking for',
                },
              },
            ]);
          },
          { interval: 10 }
        );
      });
    });

    describe('usage statistics disabled', function () {
      beforeEach(async function () {
        await preferences.savePreferences({
          trackUsageStatistics: false,
        });
        store = renderPipelineAI();
      });

      it('should not show the feedback items', function () {
        expect(screen.queryByTestId(thumbsUpId)).to.not.exist;

        store.dispatch({
          type: AIPipelineActionTypes.LoadGeneratedPipeline,
          pipelineText: '[{$group: {_id: "$price"}}]',
          pipeline: [{ $group: { _id: '$price' } }],
          syntaxErrors: [],
          stages: [],
        });

        // No feedback popover is shown.
        expect(screen.queryByTestId(thumbsUpId)).to.not.exist;
      });
    });
  });
});
