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
const albumArt = document.getElementById("album-art");
const backgroundAlbumArt = document.getElementById("background-album-art");
const equalizerBars = document.querySelectorAll(".equalizer .bar");
const userProfilePicture = document.getElementById("user-profile-picture");
const userNameElement = document.getElementById("user-name");
const userEmailElement = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout");
const profileInfo = document.getElementById("profile-info");
const userDetails = document.getElementById("user-details");

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

async function fetchUserProfile() {
  try {
    const response = await fetch("https://api.spotify.com/v1/me", {
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
    displayUserProfile(data);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    showNotification("Error fetching user profile.");
  }
}

function displayUserProfile(user) {
  userNameElement.textContent = user.display_name;
  userEmailElement.textContent = user.email;

  if (user.images && user.images.length > 0) {
    userProfilePicture.src = user.images[0].url;
  } else {
    userProfilePicture.src = "default-profile.png";
  }

  userProfilePicture.classList.remove("hidden");
  userDetails.classList.remove("hidden");

  spotifyLoginBtn.classList.add("hidden");
  logoutBtn.classList.remove("hidden");
}

function initializeSpotify() {
  accessToken = getAccessToken();
  if (accessToken) {
    tokenExpiresAt = new Date().getTime() + 3600 * 1000;
    isUserLoggedIn = true;
    fetchUserProfile();
    setupSpotifyPlayer();
    fetchUserPlaylists();
  } else {
    showNotification("Please log in with Spotify to play music.");
  }
}

logoutBtn.addEventListener("click", () => {
  accessToken = "";
  isUserLoggedIn = false;

  userProfilePicture.classList.add("hidden");
  userDetails.classList.add("hidden");
  spotifyLoginBtn.classList.remove("hidden");
  logoutBtn.classList.add("hidden");

  showNotification("Logged out successfully.");
});

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
  if (!isUserLoggedIn) {
    showNotification("Please log in to Spotify to fetch playlists.");
    return;
  }

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
  if (!isUserLoggedIn) {
    showNotification("Please log in to Spotify to fetch tracks.");
    return;
  }

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
    updateSongInfo();
  } catch (error) {
    console.error("Error fetching playlist tracks:", error);
    showNotification("Error fetching playlist tracks.");
  }
}

function updateSongInfo() {
  if (tracks.length > 0) {
    const track = tracks[currentTrackIndex];
    songTitle.textContent = track.name;

    if (track.album && track.album.images && track.album.images.length > 0) {
      albumArt.src = track.album.images[0].url;
      albumArt.alt = `Album art for ${track.name}`;

      backgroundAlbumArt.src = track.album.images[0].url;
      backgroundAlbumArt.alt = `Background album art for ${track.name}`;

      albumArt.onload = function () {
        Vibrant.from(albumArt)
          .getPalette()
          .then((palette) => {
            const vibrantColor = palette.Vibrant
              ? palette.Vibrant.getHex()
              : "#1db954";
            applyDynamicStyles(vibrantColor);
          })
          .catch((err) => {
            console.error("Error extracting colors:", err);
            resetDynamicStyles();
          });
      };
    } else {
      albumArt.src = "default-album.png";
      albumArt.alt = "Default album art";
      backgroundAlbumArt.src = "default-album.png";
      backgroundAlbumArt.alt = "Default album art";
      resetDynamicStyles();
    }
  } else {
    songTitle.textContent = "No tracks available";
    albumArt.src = "default-album.png";
    albumArt.alt = "Default album art";
    backgroundAlbumArt.src = "default-album.png";
    backgroundAlbumArt.alt = "Default album art";
    resetDynamicStyles();
  }
}

function applyDynamicStyles(primaryColor) {
  equalizerBars.forEach((bar) => {
    bar.style.backgroundColor = primaryColor;
  });
}

function resetDynamicStyles() {
  equalizerBars.forEach((bar) => {
    bar.style.backgroundColor = "#1db954";
  });
}

playPauseBtn.addEventListener("click", () => {
  if (!isUserLoggedIn) {
    showNotification("Please log in with Spotify to play.");
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
    showNotification("Please log in with Spotify to play.");
    return;
  }
  if (tracks.length === 0) return;
  currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
  updateSongInfo();
  playSong();
});

nextBtn.addEventListener("click", () => {
  if (!isUserLoggedIn) {
    showNotification("Please log in with Spotify to play.");
    return;
  }
  if (tracks.length === 0) return;
  currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
  updateSongInfo();
  playSong();
});

async function playSong() {
  if (!accessToken || !player || !deviceId || tracks.length === 0) {
    showNotification(
      "Unable to play song. Please ensure you are logged in and try again."
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
