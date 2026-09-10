const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

let allGroups = [];
let selectedDay = "All";
let selectedLevel = "All";

const groupsContainer = document.getElementById("groupsContainer");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const statusBanner = document.getElementById("statusBanner");

function normaliseGroupName(name) {
  return name.replace(/^#+\s*/, "").replace(/^[^\w\d\u00C0-\uFFFF]+/, "").trim();
}

function getInstagramHandle(url) {
  if (!url) return "";
  const match = url.match(/instagram\.com\/?(?:p\/|reel\/|tv\/)?([^/\s?#]+)/i);
  const value = match ? match[1].replace(/\/$/, "") : "";
  return value || "";
}

function extractCoordinates(raw) {
  if (!raw) return null;
  const match = raw.match(/\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/);
  if (!match) return null;
  return {
    lat: Number(match[1]),
    lng: Number(match[2])
  };
}

function parseSalidasText(text) {
  const lines = text.split(/\r?\n/);
  const groups = [];
  let currentGroup = null;
  let currentEvent = null;

  const finaliseCurrentGroup = () => {
    if (!currentGroup) return;

    currentGroup.events = (currentGroup.events || []).filter(event => event.day && event.time);
    if (currentGroup.events.length) {
      groups.push(currentGroup);
    }
    currentGroup = null;
    currentEvent = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line === "---") {
      continue;
    }

    if (line.startsWith("## ")) {
      finaliseCurrentGroup();
      currentGroup = {
        name: normaliseGroupName(line.slice(3)),
        icon: "🛼",
        instagram: "",
        events: []
      };
      continue;
    }

    if (!currentGroup) {
      continue;
    }

    if (line.startsWith("📱 Instagram:")) {
      currentGroup.instagram = getInstagramHandle(line.replace("📱 Instagram:", "").trim());
      continue;
    }

    if (line.startsWith("**") && line.endsWith("**")) {
      const dayName = line.replace(/^\*\*|\*\*$/g, "").trim();
      if (DAYS.includes(dayName)) {
        currentEvent = {
          day: dayName,
          level: "",
          time: "",
          location: "",
          coordinates: null,
          warning: "",
          notes: []
        };
        currentGroup.events.push(currentEvent);
      }
      continue;
    }

    if (!currentEvent) {
      continue;
    }

    if (line.startsWith("🎯 Level:")) {
      currentEvent.level = line.replace("🎯 Level:", "").trim();
      continue;
    }

    if (line.startsWith("📍 Start Location:")) {
      currentEvent.location = line.replace("📍 Start Location:", "").trim();
      const coordMatch = extractCoordinates(currentEvent.location);
      if (coordMatch) {
        currentEvent.coordinates = coordMatch;
      }
      continue;
    }

    if (line.startsWith("🕐 Time:")) {
      currentEvent.time = line.replace("🕐 Time:", "").trim().replace(/hs$/i, "");
      continue;
    }

    if (line.startsWith("⚠️")) {
      currentEvent.warning = line.replace(/^⚠️\s*/, "").trim();
      continue;
    }

    if (line.startsWith("📌") || line.includes("Coordinates to paste into Google Maps")) {
      currentEvent.notes.push(line.replace(/^📌\s*/, "").trim());
      continue;
    }
  }

  finaliseCurrentGroup();
  return groups;
}

function getLevelClass(level) {
  const lower = (level || "").toLowerCase();

  if (lower.includes("beginner")) return "beginner";
  if (lower.includes("intermediate")) return "intermediate";
  if (lower.includes("advanced")) return "advanced";
  return "mixed";
}

function eventMatchesLevel(event) {
  if (selectedLevel === "All") return true;
  return (event.level || "").includes(selectedLevel);
}

function buildMapsUrl(location, coordinates) {
  if (coordinates) {
    return `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`;
  }

  const query = encodeURIComponent(location || "Buenos Aires");
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function render() {
  const search = searchInput.value.trim().toLowerCase();
  const filteredGroups = allGroups.filter(group => {
    const nameMatches = group.name.toLowerCase().includes(search);
    const eventMatches = group.events.filter(event => {
      const dayMatches = selectedDay === "All" || event.day === selectedDay;
      const levelMatches = eventMatchesLevel(event);
      return dayMatches && levelMatches;
    });

    return nameMatches || eventMatches.length > 0;
  });

  groupsContainer.innerHTML = "";

  filteredGroups.forEach(group => {
    const visibleEvents = group.events.filter(event => {
      const dayMatches = selectedDay === "All" || event.day === selectedDay;
      const levelMatches = eventMatchesLevel(event);
      return dayMatches && levelMatches;
    });

    if (visibleEvents.length === 0) return;

    const card = document.createElement("article");
    card.className = "card panel";

    let eventsHtml = visibleEvents.map(event => {
      const mapUrl = buildMapsUrl(event.location, event.coordinates);
      const notesLine = event.notes.length ? `<div class="location-text">${event.notes.join("<br>")}</div>` : "";
      const warning = event.warning ? `<div class="warning-box">⚠️ ${event.warning}</div>` : "";

      return `
        <div class="event-card">
          <div class="event-header">
            <div class="event-day">${event.day}</div>
            <div class="event-time">🕐 ${event.time}</div>
          </div>

          <span class="level-pill ${getLevelClass(event.level)}">🎯 ${event.level}</span>

          <div class="location-text">📍 ${event.location || "Location to be confirmed"}</div>
          ${notesLine}
          ${warning}

          <div class="event-actions">
            <a class="map-button" href="${mapUrl}" target="_blank" rel="noopener noreferrer">📍 View on map</a>
          </div>
        </div>
      `;
    }).join("");

    const instagramUrl = group.instagram
      ? `https://www.instagram.com/${group.instagram}/`
      : "#";

    card.innerHTML = `
      <div class="card-header">
        <div class="group-name">
          <span class="group-icon">${group.icon}</span>
          <span>${group.name}</span>
        </div>

        <a class="instalink" href="${instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram</a>
      </div>

      <div class="events-list">
        ${eventsHtml}
      </div>
    `;

    groupsContainer.appendChild(card);
  });

  emptyState.hidden = filteredGroups.some(group => group.events.some(event => {
    const dayMatches = selectedDay === "All" || event.day === selectedDay;
    const levelMatches = eventMatchesLevel(event);
    return dayMatches && levelMatches;
  }));
}

function setDay(day, button) {
  selectedDay = day;
  document.querySelectorAll("#dayFilters .filter-btn").forEach(btn => btn.classList.toggle("active", btn === button));
  render();
}

function setLevel(level, button) {
  selectedLevel = level;
  document.querySelectorAll("#levelFilters .filter-btn").forEach(btn => btn.classList.toggle("active", btn === button));
  render();
}

async function loadData() {
  try {
    statusBanner.textContent = "Loading sessions from Salidas_info.txt…";
    const response = await fetch("Salidas_info.txt", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    allGroups = parseSalidasText(text);

    if (!allGroups.length) {
      throw new Error("No valid groups were found");
    }

    const totalEvents = allGroups.reduce((sum, group) => sum + group.events.length, 0);
    statusBanner.textContent = `Showing ${allGroups.length} groups and ${totalEvents} sessions loaded from Salidas_info.txt`;
    render();
  } catch (error) {
    console.error(error);
    statusBanner.textContent = "Could not load the session file. Check Salidas_info.txt and refresh the page.";

    allGroups = [{
      name: "Fallback",
      icon: "⚠️",
      instagram: "",
      events: [{
        day: "Monday",
        level: "Intermediate",
        time: "00:00",
        location: "Check Salidas_info.txt",
        coordinates: null,
        warning: "The file could not be read. Make sure it exists and is properly formatted."
      }]
    }];

    render();
  }
}

searchInput.addEventListener("input", render);

loadData();
