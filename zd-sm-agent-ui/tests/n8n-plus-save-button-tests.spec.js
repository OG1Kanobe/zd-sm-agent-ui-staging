import { test, expect } from '@playwright/test';

// Use the saved login session from your auth setup
test.use({ storageState: 'storageState.json' });

test('App Functional Check: Save and Animate', async ({ page }) => {
  // 1. Setup dialog handler FIRST (so it's ready when the button is clicked)
  page.on('dialog', async dialog => {
    console.log(`Dialog popped up: ${dialog.message()}`);
    await dialog.dismiss();
  });

  // 2. Go to dashboard
  await page.goto('https://zd-sm-agent-ui-staging.vercel.app/dashboard');
  
  // Wait for the page to load by checking for a known element
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/.*login/);

  // 3. Navigate to Agent Configs
  await page.getByRole('link', { name: 'Agent Configs' }).click();

  // 4. Handle the "Drawer" Save Button
  // We fill the description first
  const description = page.getByRole('textbox', { name: 'Company Description' });
  await description.waitFor({ state: 'visible' });
  await description.fill('AI Consultancy');

  // We wait for the Save button specifically to be "interactable"
  // This helps if the drawer is still animating/sliding
  const saveBtn = page.getByRole('button', { name: 'Save Configuration' });
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  console.log("✅ Save Configuration Clicked");

  // 5. Navigate back to Dashboard
  await page.getByRole('link', { name: 'Dashboard' }).click();
  
  // 6. Animate Image
  // Using a more flexible locator in case the button is inside a list or card
  const animateBtn = page.getByRole('button', { name: 'Animate Image' }).first();
  await animateBtn.waitFor({ state: 'visible' });
  await animateBtn.click();
  console.log("✅ Animate Image Clicked");

  // Keep window open for 3 seconds so you can see the result
  await page.waitForTimeout(3000);
});