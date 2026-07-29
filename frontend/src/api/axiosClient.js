import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// If two requests both hit a 401 at nearly the same moment, we don't want
// two separate /refresh-token calls racing each other — one refresh wins,
// the other request just waits and reuses its result
let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = () => {
  refreshSubscribers.forEach((callback) => callback());
  refreshSubscribers = [];
};

api.interceptors.response.use(
  (response) => response, // successful responses pass through untouched
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // If login itself failed, or refresh-token itself failed, retrying
      // via refresh would either be pointless or loop forever — bail out
      if (
        originalRequest.url.includes("/login") ||
        originalRequest.url.includes("/refresh-token")
      ) {
        return Promise.reject(error);
      }

      // Marks this specific request so it only ever retries once —
      // without this, a request that fails AGAIN after refresh would
      // trigger another refresh attempt, endlessly
      originalRequest._retry = true;

      if (isRefreshing) {
        // A refresh is already in flight from another request — queue
        // this one and resolve it once that refresh finishes, instead
        // of firing a second /refresh-token call
        return new Promise((resolve) => {
          refreshSubscribers.push(() => resolve(api(originalRequest)));
        });
      }

      isRefreshing = true;
      try {
        // No body needed — refreshToken travels as an httpOnly cookie,
        // exactly like every other request through this instance
        await api.post("/refresh-token");
        isRefreshing = false;
        onRefreshed();
        // Cookies are now fresh — replay the original request
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        // Refresh itself failed — the refreshToken is invalid/rotated/
        // expired too, meaning the session is genuinely over, not just
        // the access token. Nothing left to do but send them to login.
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
