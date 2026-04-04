let _accessToken: string | null = null;

export const getAccessToken = () => _accessToken;
export const setAccessToken = (t: string | null) => {
  _accessToken = t;
};
export const clearAccessToken = () => {
  _accessToken = null;
};
