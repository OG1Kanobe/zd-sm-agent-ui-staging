import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('https://zd-sm-agent-ui-staging.vercel.app/login');
  await page.getByRole('textbox', { name: 'Email Address' }).fill('tiroally@gmail.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('Taahir0201');
  // Make sure to click the "Remember Device" checkbox if it's there!
  // await page.getByLabel('Remember Device').check(); 
  await page.getByRole('button', { name: 'Sign In' }).click();

  // THE KEY STEP: 
  // The script will pause here. You manually type the OTP in the browser window.
  // Once you are fully logged in and see the dashboard, come back to the terminal and press Enter.
  await page.pause(); 

  // Save the cookies/storage to a file called 'storageState.json'
  await page.context().storageState({ path: 'storageState.json' });
});