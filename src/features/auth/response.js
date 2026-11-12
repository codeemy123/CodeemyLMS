// Hosting failures can return an empty or HTML response before a route runs.
export async function readAuthResponse(response) {
  let data;
  try {
    data = JSON.parse(await response.text());
  } catch {
    throw new Error(
      'The sign-in server is unavailable. Please try again shortly or contact your administrator.',
    );
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('The sign-in server returned an invalid response. Please try again.');
  return data;
}
