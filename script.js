const clientId = "b95a0b7b6fb34b6883dad6a8a8ddadc3";
const redirectUri = "http://127.0.0.1:5500/index.html";

let accessToken = "";
let tokenExpiresAt = null;
let player = null;
let deviceId = "";
let tracks = [];
let currentTrackIndex = 0;
let isPlaying = false;
let isUserLoggedIn = false;

const playPauseBtn = document.getElementById("play-pause");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const songTitle = document.getElementById("song-title");
const notification = document.getElementById("notification");
const spotifyLoginBtn = document.getElementById("spotify-login");
const appleLoginBtn = document.getElementById("apple-login");
const deezerLoginBtn = document.getElementById("deezer-login");

function showNotification(message) {
  notification.textContent = message;
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, 5000);
}

function authorizeSpotify() {
  const scopes = [
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
    "playlist-read-collaborative",
    "streaming",
    "user-modify-playback-state",
    "user-read-playback-state",
  ];
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scopes.join(" "))}`;
  window.location.href = authUrl;
}

function getAccessToken() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get("access_token");
}

function isAccessTokenExpired() {
  if (!tokenExpiresAt) return true;
  const currentTime = new Date().getTime();
  return currentTime >= tokenExpiresAt;
}

function initializeSpotify() {
  accessToken = getAccessToken();
  if (accessToken) {
    tokenExpiresAt = new Date().getTime() + 3600 * 1000;
    isUserLoggedIn = true;
    setupSpotifyPlayer();
    fetchUserPlaylists();
  } else {
    showNotification("Please log in with Spotify to play music.");
  }
}

function setupSpotifyPlayer() {
  window.onSpotifyWebPlaybackSDKReady = () => {
    player = new Spotify.Player({
      name: "Web Playback SDK Player",
      getOAuthToken: (cb) => {
        cb(accessToken);
      },
      volume: 0.5,
    });

    player.addListener("initialization_error", ({ message }) => {
      showNotification(`Initialization Error: ${message}`);
    });
    player.addListener("authentication_error", ({ message }) => {
      showNotification(`Authentication Error: ${message}`);
    });
    player.addListener("account_error", ({ message }) => {
      showNotification(`Account Error: ${message}`);
    });
    player.addListener("playback_error", ({ message }) => {
      showNotification(`Playback Error: ${message}`);
    });

    player.addListener("player_state_changed", (state) => {
      if (!state) return;
      isPlaying = !state.paused;
      playPauseBtn.querySelector("i").classList = isPlaying
        ? "fas fa-pause"
        : "fas fa-play";
    });

    player.addListener("ready", ({ device_id }) => {
      console.log("Ready with Device ID", device_id);
      deviceId = device_id;
    });

    player.addListener("not_ready", ({ device_id }) => {
      console.log("Device ID has gone offline", device_id);
    });

    player.connect();
  };

  if (!window.Spotify) {
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    document.head.appendChild(script);
  } else {
    window.onSpotifyWebPlaybackSDKReady();
  }
}

async function fetchUserPlaylists() {
  try {
    const response = await fetch("https://api.spotify.com/v1/me/playlists", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      showNotification("Access token expired. Reauthorizing...");
      authorizeSpotify();
      return;
    }

    const data = await response.json();
    if (data.items.length > 0) {
      const playlistId = data.items[0].id;
      fetchPlaylistTracks(playlistId);
    } else {
      showNotification("No playlists found.");
    }
  } catch (error) {
    console.error("Error fetching playlists:", error);
    showNotification("Error fetching playlists.");
  }
}

async function fetchPlaylistTracks(playlistId) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 401) {
      showNotification("Access token expired. Reauthorizing...");
      authorizeSpotify();
      return;
    }

    const data = await response.json();
    tracks = data.items.map((item) => item.track);
    updateSongTitle();
  } catch (error) {
    console.error("Error fetching playlist tracks:", error);
    showNotification("Error fetching playlist tracks.");
  }
}

function updateSongTitle() {
  if (tracks.length > 0) {
    songTitle.textContent = tracks[currentTrackIndex].name;
  } else {
    songTitle.textContent = "No tracks available";
  }
}

playPauseBtn.addEventListener("click", () => {
  if (!isUserLoggedIn) {
    showNotification("Please select a music service to log in.");
    return;
  }
  if (isPlaying) {
    pauseSong();
  } else {
    playSong();
  }
});

prevBtn.addEventListener("click", () => {
  if (!isUserLoggedIn) {
    showNotification("Please select a music service to log in.");
    return;
  }
  if (tracks.length === 0) return;
  currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
  updateSongTitle();
  playSong();
});

nextBtn.addEventListener("click", () => {
  if (!isUserLoggedIn) {
    showNotification("Please select a music service to log in.");
    return;
  }
  if (tracks.length === 0) return;
  currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
  updateSongTitle();
  playSong();
});

async function playSong() {
  if (!accessToken || !player || !deviceId || tracks.length === 0) {
    showNotification(
      "Unable to play song. Please check your connection and try again."
    );
    return;
  }

  const trackUri = tracks[currentTrackIndex].uri;

  try {
    await fetch(`https://api.spotify.com/v1/me/player`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_ids: [deviceId],
        play: true,
      }),
    });

    await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: [trackUri],
        }),
      }
    );

    isPlaying = true;
    playPauseBtn.querySelector("i").classList = "fas fa-pause";
  } catch (error) {
    console.error("Error playing track:", error);
    showNotification("Error playing track.");
  }
}

async function pauseSong() {
  if (!accessToken || !player || !deviceId) {
    showNotification(
      "Unable to pause song. Please check your connection and try again."
    );
    return;
  }

  try {
    await fetch(
      `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    isPlaying = false;
    playPauseBtn.querySelector("i").classList = "fas fa-play";
  } catch (error) {
    console.error("Error pausing track:", error);
    showNotification("Error pausing track.");
  }
}

spotifyLoginBtn.addEventListener("click", () => {
  authorizeSpotify();
});

initializeSpotify();
