import { expect } from 'chai';
import type { CompassBrowser } from '../helpers/compass-browser';
import {
  init,
  cleanup,
  screenshotIfFailed,
  DEFAULT_CONNECTION_NAME_1,
} from '../helpers/compass';
import type { Compass } from '../helpers/compass';
import * as Selectors from '../helpers/selectors';
import {
  createNumbersCollection,
  createNumbersStringCollection,
} from '../helpers/insert-data';
import {
  cleanUpDownloadedFile,
  waitForFileDownload,
} from '../helpers/downloads';
import { readFileSync } from 'fs';

interface Node {
  id: string;
  position: { x: number; y: number };
}

type DiagramInstance = {
  getNodes: () => Array<Node>;
};

async function setupDiagram(
  browser: CompassBrowser,
  options: {
    diagramName: string;
    connectionName: string;
    databaseName: string;
  }
) {
  await browser.navigateToDataModeling();

  // Click on create new data model button
  await browser.clickVisible(Selectors.CreateNewDataModelButton);

  // Fill in model details
  await browser.setValueVisible(
    Selectors.CreateDataModelNameInput,
    options.diagramName
  );
  await browser.clickVisible(Selectors.CreateDataModelConfirmButton);

  // Select existing connection
  await browser.selectOption(
    Selectors.CreateDataModelConnectionSelector,
    options.connectionName
  );
  await browser.clickVisible(Selectors.CreateDataModelConfirmButton);

  // Select a database
  await browser.selectOption(
    Selectors.CreateDataModelDatabaseSelector,
    options.databaseName
  );
  await browser.clickVisible(Selectors.CreateDataModelConfirmButton);

  // Ensure that all the collections are selected by default
  const text = await browser.$(Selectors.CreateDataModelModal).getText();
  // 2 is based on the collections we create in beforeEach hook
  expect(text).to.contain('2/2 total collections selected.');

  await browser.clickVisible(Selectors.CreateDataModelConfirmButton);

  // Wait for the diagram editor to load
  const dataModelEditor = browser.$(Selectors.DataModelEditor);
  await dataModelEditor.waitForDisplayed();
}

async function getDiagramNodes(browser: CompassBrowser): Promise<Node[]> {
  const nodes = await browser.execute(function (selector) {
    const node = document.querySelector(selector);
    if (!node) {
      throw new Error(`Element with selector ${selector} not found`);
    }
    return (
      node as Element & { _diagram: DiagramInstance }
    )._diagram.getNodes();
  }, Selectors.DataModelEditor);
  return nodes;
}

describe('Data Modeling tab', function () {
  let compass: Compass;
  let browser: CompassBrowser;
  let exportFileName: string;

  before(async function () {
    compass = await init(this.test?.fullTitle());
    browser = compass.browser;
  });

  beforeEach(async function () {
    await browser.setupDefaultConnections();
    await browser.setFeature('enableDataModeling', true);
    if (exportFileName) {
      cleanUpDownloadedFile(exportFileName);
    }
    await createNumbersStringCollection('testCollection1');
    await createNumbersCollection('testCollection2');
    await browser.disconnectAll();
    await browser.connectToDefaults();
  });

  after(async function () {
    if (compass) {
      await cleanup(compass);
    }
  });

  afterEach(async function () {
    await screenshotIfFailed(compass, this.currentTest);
    if (exportFileName) {
      cleanUpDownloadedFile(exportFileName);
    }
  });

  it('creates a new data model using an existing connection', async function () {
    const dataModelName = 'Test Data Model';
    await setupDiagram(browser, {
      diagramName: dataModelName,
      connectionName: DEFAULT_CONNECTION_NAME_1,
      databaseName: 'test',
    });

    const dataModelEditor = browser.$(Selectors.DataModelEditor);
    await dataModelEditor.waitForDisplayed();

    const nodes = await getDiagramNodes(browser);
    expect(nodes).to.have.lengthOf(2);
    expect(nodes[0].id).to.equal('test.testCollection1');
    expect(nodes[1].id).to.equal('test.testCollection2');

    // Apply change to the model

    // react flow uses its own coordinate system,
    // so we get the node element location for the pointer action
    const testCollection1 = browser.$(
      Selectors.DataModelPreviewCollection('test.testCollection1')
    );
    const startPosition = await testCollection1.getLocation();
    const nodeSize = await testCollection1.getSize();

    await browser
      .action('pointer')
      .move({
        x: Math.round(startPosition.x + nodeSize.width / 2),
        y: Math.round(startPosition.y + nodeSize.height / 2),
      })
      .down({ button: 0 }) // Left mouse button
      .move({ x: 100, y: 0, duration: 1000, origin: 'pointer' })
      .pause(1000)
      .move({ x: 100, y: 0, duration: 1000, origin: 'pointer' })
      .up({ button: 0 }) // Release the left mouse button
      .perform();
    await browser.waitForAnimations(dataModelEditor);

    // Check that the first node has moved and mark the new position
    const newPosition = await testCollection1.getLocation();
    expect(newPosition).not.to.deep.equal(startPosition);

    // Undo the change
    await browser.clickVisible(Selectors.DataModelUndoButton);
    await browser.waitForAnimations(dataModelEditor);
    const positionAfterUndone = await testCollection1.getLocation();
    expect(positionAfterUndone).to.deep.equal(startPosition);

    // Redo the change
    await browser.waitForAriaDisabled(Selectors.DataModelRedoButton, false);
    await browser.clickVisible(Selectors.DataModelRedoButton);
    await browser.waitForAnimations(dataModelEditor);
    const positionAfterRedo = await testCollection1.getLocation();
    expect(positionAfterRedo).to.deep.equal(newPosition);
    // Open a new tab
    await browser.openNewTab();

    // Open the saved diagram
    await browser.clickVisible(Selectors.DataModelsListItem(dataModelName));
    await browser.$(Selectors.DataModelEditor).waitForDisplayed();

    // TODO: Verify that the diagram has the latest changes COMPASS-9479
    const savedNodes = await getDiagramNodes(browser);
    expect(savedNodes).to.have.lengthOf(2);

    // Open a new tab
    await browser.openNewTab();

    // Delete the saved diagram
    await browser.clickVisible(
      Selectors.DataModelsListItemActions(dataModelName)
    );
    await browser.clickVisible(Selectors.DataModelsListItemDeleteButton);
    await browser.clickVisible(Selectors.confirmationModalConfirmButton());
    await browser
      .$(Selectors.DataModelsListItem(dataModelName))
      .waitForDisplayed({ reverse: true });
  });

  it('exports the data model to JSON', async function () {
    const dataModelName = 'Test Export Model';
    exportFileName = `${dataModelName}.json`;
    await setupDiagram(browser, {
      diagramName: dataModelName,
      connectionName: DEFAULT_CONNECTION_NAME_1,
      databaseName: 'test',
    });

    await browser.clickVisible(Selectors.DataModelExportButton);
    const exportModal = browser.$(Selectors.DataModelExportModal);
    await exportModal.waitForDisplayed();

    await browser.clickParent(Selectors.DataModelExportJsonOption);
    await browser.clickVisible(Selectors.DataModelExportModalConfirmButton);

    const { fileExists, filePath } = await waitForFileDownload(
      exportFileName,
      browser
    );
    expect(fileExists).to.be.true;

    const content = readFileSync(filePath, 'utf-8');
    const model = JSON.parse(content);

    // Within beforeEach hook, we create these two collections
    expect(model).to.deep.equal({
      collections: {
        'test.testCollection1': {
          ns: 'test.testCollection1',
          jsonSchema: {
            bsonType: 'object',
            required: ['_id', 'i', 'iString', 'j'],
            properties: {
              _id: {
                bsonType: 'objectId',
              },
              i: {
                bsonType: 'int',
              },
              iString: {
                bsonType: 'string',
              },
              j: {
                bsonType: 'int',
              },
            },
          },
        },
        'test.testCollection2': {
          ns: 'test.testCollection2',
          jsonSchema: {
            bsonType: 'object',
            required: ['_id', 'i', 'j'],
            properties: {
              _id: {
                bsonType: 'objectId',
              },
              i: {
                bsonType: 'int',
              },
              j: {
                bsonType: 'int',
              },
            },
          },
        },
      },
      relationships: [],
    });
  });
});
