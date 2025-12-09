export async function exchangeFacebookCode(code) {
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  const tokenUrl = `https://graph.facebook.com/v17.0/oauth/access_token
    ?client_id=${clientId}
    &redirect_uri=${encodeURIComponent(redirectUri)}
    &client_secret=${clientSecret}
    &code=${code}`
    .replace(/\s+/g, "");

  const tokenRes = await fetch(tokenUrl);
  const tokenJson = await tokenRes.json();

  if (tokenJson.error) {
    throw new Error("Facebook token error: " + JSON.stringify(tokenJson.error));
  }

  // Get the user info
  const meRes = await fetch(
    `https://graph.facebook.com/me?access_token=${tokenJson.access_token}`
  );
  const meJson = await meRes.json();

  return {
    user_id: meJson.id,
    access_token: tokenJson.access_token,
    expires_at: Date.now() + tokenJson.expires_in * 1000,
  };
}
