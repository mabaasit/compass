const timer = require('d3-timer');
const React = require('react');
const PropTypes = require('prop-types');
const { createLoggerAndTelemetry } = require('@mongodb-js/compass-logging');
const Actions = require('../actions');
const DBErrorStore = require('../stores/dberror-store');
const { track } = createLoggerAndTelemetry('COMPASS-PERFORMANCE-UI');

// const debug = require('debug')('mongodb-compass:server-stats:current-op-component');

/**
 * Represents the component that renders the current op information.
 */
class CurrentOpComponent extends React.Component {
  /**
   * The current op component should be initialized with a 'store'
   * property, that triggers with the result of a { currentOp: 1 }
   * command.
   *
   * @param {Object} props - The component properties.
   */
  constructor(props) {
    super(props);
    this.state = { error: null, data: [], display: 'flex' };
  }

  /**
   * When the component mounts, the component will subscribe to the
   * provided store, so that each time the store triggers the component
   * can update its state.
   */
  componentDidMount() {
    this.unsubscribeRefresh = this.props.store.listen(this.refresh.bind(this));
    this.unsubscribeShowOperationDetails = Actions.showOperationDetails.listen(
      this.hide.bind(this)
    );
    this.unsubscribeHideOperationDetails = Actions.hideOperationDetails.listen(
      this.show.bind(this)
    );

    if (!DBErrorStore.ops.currentOp) {
      this.unsubscribeError = DBErrorStore.listen(this.stop.bind(this));
      this.timer = timer.interval(() => {
        Actions.currentOp();
      }, this.props.interval);
    }
  }

  /**
   * When the component unmounts, we unsubscribe from the store and stop the
   * timer.
   */
  componentWillUnmount() {
    this.unsubscribeRefresh();
    this.unsubscribeShowOperationDetails();
    this.unsubscribeHideOperationDetails();

    if (this.unsubscribeError) {
      this.unsubscribeError();
      this.timer.stop();
    }
  }

  stop() {
    if (this.timer) {
      this.timer.stop();
    }
  }

  /**
   * Refreshes the component state with the new current op data that was
   * received from the store.
   *
   * @param {Error} error - The error, if any occured.
   * @param {Object} data - The javascript object for the result of the command.
   */
  refresh(error, data) {
    this.setState({ error: error, data: data });
  }

  /**
   * Set the component to visible.
   */
  show() {
    this.setState({ display: 'flex' });
  }

  /**
   * Set the component to hidden.
   */
  hide() {
    this.setState({ display: 'none' });
  }

  /**
   * Fire the show operation detail action with the row data.
   *
   * @param {Object} data - The row data.
   */
  showOperationDetails(data) {
    track('CurrentOp showOperationDetails');
    Actions.showOperationDetails(data);
  }

  /**
   * Render the error message in the component.
   *
   * @returns {String} The error message.
   */
  renderError() {
    return (
      <div className="rt-lists" style={{ display: this.state.display }}>
        <header className="rt-lists__header">
          <h2 className="rt-lists__headerlabel">Slowest Operations</h2>
        </header>
        <div className="rt-lists__empty-error">&#9888; DATA UNAVAILABLE</div>
      </div>
    );
  }

  /**
   * Render the error message in the component.
   *
   * @returns {React.Component} The zero-state.
   */
  renderZero() {
    return (
      <div className="rt-lists" style={{ display: this.state.display }}>
        <header className="rt-lists__header">
          <h2 className="rt-lists__headerlabel">Slowest Operations</h2>
        </header>
        <div data-testid="no-slow-operations" className="rt-lists__empty-error">
          &#10004; No Slow Operations
        </div>
      </div>
    );
  }

  /**
   * Render the table in the component.
   *
   * @returns {React.Component} The table.
   */
  renderGraph() {
    const showOperationDetails = this.showOperationDetails;
    const rows = this.state.data.map(function (row, i) {
      return (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <li
          className="rt-lists__item rt-lists__item--slow"
          onClick={showOperationDetails.bind(null, row)}
          key={`list-item-${i}`}
        >
          <div className="rt-lists__op">{row.op}</div>
          <div className="rt-lists__collection-slow">{row.ns}</div>
          <div className="rt-lists__time">{row.ms_running + ' ms'}</div>
        </li>
      );
    });
    return (
      <div className="rt-lists" style={{ display: this.state.display }}>
        <header className="rt-lists__header">
          <h2 className="rt-lists__headerlabel">Slowest Operations</h2>
        </header>
        <div className="rt-lists__listdiv" id="div-scroll">
          <ul className="rt-lists__list">{rows}</ul>
        </div>
      </div>
    );
  }

  /**
   * Renders the component.
   *
   * @returns {React.Component} The component.
   */
  render() {
    if (this.state.error) {
      return this.renderError();
    }
    if (this.state.data.length === 0) {
      return this.renderZero();
    }
    return this.renderGraph();
  }
}

CurrentOpComponent.propTypes = {
  store: PropTypes.any.isRequired,
  interval: PropTypes.number.isRequired,
};

CurrentOpComponent.displayName = 'CurrentOpComponent';

module.exports = CurrentOpComponent;
