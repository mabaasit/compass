import type { CompassBrowser } from '../compass-browser';
import * as Selectors from '../selectors';

export async function dropIndex(
  browser: CompassBrowser,
  indexName: string,
  screenshotName?: string
) {
  const indexComponentSelector = Selectors.indexComponent(indexName);
  const indexComponent = await browser.$(indexComponentSelector);
  await indexComponent.waitForDisplayed();

  await browser.hover(indexComponentSelector);
  await browser.clickVisible(
    `${indexComponentSelector} ${Selectors.IndexesTableDropIndexButton}`
  );

  const dropModal = await browser.$(Selectors.DropIndexModal);
  await dropModal.waitForDisplayed();

  const confirmInput = await browser.$(
    Selectors.DropIndexModalConfirmNameInput
  );
  await confirmInput.waitForDisplayed();
  await confirmInput.setValue(indexName);

  if (screenshotName) {
    await browser.screenshot(screenshotName);
  }

  await browser.clickVisible(Selectors.DropIndexModalConfirmButton);

  await dropModal.waitForDisplayed({ reverse: true });

  await indexComponent.waitForDisplayed({ reverse: true });
}
