import React, { useState } from 'react';
import {
  Body,
  Icon,
  css,
  cx,
  focusRing,
  spacing,
  InteractivePopover,
} from '@mongodb-js/compass-components';
import { connect } from 'react-redux';

import PipelineStages from './pipeline-stages';
import PipelineActions from './pipeline-actions';
import SavedPipelines from '../../saved-pipelines/saved-pipelines';
import type { RootState } from '../../../modules';
import { usePreference } from 'compass-preferences-model';

const containerStyles = css({
  display: 'flex',
  gap: spacing[4],
  alignItems: 'center',
});

const pipelineTextAndOpenStyles = css({
  display: 'flex',
  gap: spacing[2],
  alignItems: 'center',
});

const openSavedPipelinesStyles = cx(
  css({
    border: 'none',
    backgroundColor: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    padding: spacing[2] - 2, // -2px for border.
    '&:hover': {
      cursor: 'pointer',
    },
  }),
  focusRing
);

const pipelineStagesStyles = css({
  display: 'flex',
  flex: 1,
});

const pipelineActionStyles = css({
  display: 'flex',
  flex: 'none',
  marginLeft: 'auto',
});

const savedAggregationsPopoverStyles = css({
  // We want the popover to open almost to the shell at the bottom of Compass.
  maxHeight: 'calc(100vh - 260px)',
  display: 'flex',
  marginLeft: -spacing[2] - 1, // Align to the left of the bar.
  marginTop: spacing[1],
});

type PipelineHeaderProps = {
  isOptionsVisible: boolean;
  showRunButton: boolean;
  showExportButton: boolean;
  showExplainButton: boolean;
  onToggleOptions: () => void;
  isOpenPipelineVisible: boolean;
};

const containedElements = [
  '[data-id="open-pipeline-confirmation-modal"]',
  '[data-id="delete-pipeline-confirmation-modal"]',
];

const SavedPipelinesButton: React.FunctionComponent = () => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <InteractivePopover
      className={savedAggregationsPopoverStyles}
      // To prevent popover from closing when confirmation modal is shown
      containedElements={containedElements}
      trigger={({ onClick, ref, children }) => {
        return (
          <button
            data-testid="pipeline-toolbar-open-pipelines-button"
            onClick={onClick}
            className={openSavedPipelinesStyles}
            aria-label="Open saved pipelines"
            aria-haspopup="true"
            aria-expanded={isVisible ? true : undefined}
            title="Saved Pipelines"
            type="button"
            ref={ref}
          >
            <Icon glyph="Folder" />
            <Icon glyph="CaretDown" />
            {children}
          </button>
        );
      }}
      open={isVisible}
      setOpen={setIsVisible}
    >
      <SavedPipelines />
    </InteractivePopover>
  );
};

export const PipelineHeader: React.FunctionComponent<PipelineHeaderProps> = ({
  showRunButton,
  showExportButton,
  showExplainButton,
  onToggleOptions,
  isOptionsVisible,
  isOpenPipelineVisible,
}) => {
  const isSavingAggregationsEnabled = usePreference(
    'enableSavedAggregationsQueries'
  );
  return (
    <div>
      <div className={containerStyles} data-testid="pipeline-header">
        <div
          data-testid="saved-pipelines-popover"
          className={pipelineTextAndOpenStyles}
        >
          <Body weight="medium">Pipeline</Body>
          {isOpenPipelineVisible && isSavingAggregationsEnabled && (
            <SavedPipelinesButton></SavedPipelinesButton>
          )}
        </div>
        <div className={pipelineStagesStyles}>
          <PipelineStages />
        </div>
        <div className={pipelineActionStyles}>
          <PipelineActions
            onToggleOptions={onToggleOptions}
            isOptionsVisible={isOptionsVisible}
            showRunButton={showRunButton}
            showExportButton={showExportButton}
            showExplainButton={showExplainButton}
          />
        </div>
      </div>
    </div>
  );
};

export default connect((state: RootState) => {
  return {
    isOpenPipelineVisible: !state.editViewName,
  };
})(PipelineHeader);
