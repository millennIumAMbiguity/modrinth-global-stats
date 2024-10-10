let modChart, modActivityChart;
let versions = []; // You can filter the versions by adding them here, when empty it will fetch all versions
let timestamp = 0;

function setWithExpiry(key, value, ttl = 86400000) {
  const now = new Date();

  const item = {
    value: value,
    expiry: now.getTime() + ttl,
  };
  localStorage.setItem(key, JSON.stringify(item));
}

function setCookie(cname, cvalue) {
  const d = new Date();
  d.setTime(d.getTime() + 86400000);
  let expires = "expires=" + d.toUTCString();
  document.cookie =
    cname + "=" + JSON.stringify(cvalue) + ";" + expires + ";path=/";
}

function getWithExpiry(key) {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) {
    return null;
  }
  const item = JSON.parse(itemStr);
  const now = new Date();
  if (now.getTime() > item.expiry) {
    localStorage.removeItem(key);
    return null;
  }

  return item.value;
}

function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return JSON.parse(c.substring(name.length, c.length));
    }
  }
  return "";
}

async function fetchGameVersions() {
  if (versions.length > 0) return versions;

  const cachedVersions = getCookie("game_versions");
  if (cachedVersions) return (versions = cachedVersions);

  const url = `https://api.modrinth.com/v2/tag/game_version`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    versions = data
      .filter((item) => item.version_type === "release")
      .map((item) => item.version);
    setCookie("game_versions", versions);
    return versions;
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

async function fetchModCountForVersion(version) {
  const url = `https://api.modrinth.com/v2/search?facets=[["versions:${version}"]]&limit=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.total_hits;
  } catch (error) {
    console.error("Error fetching data:", error);
    return 0;
  }
}

async function fetchModActivityLast30Days(version) {
  const url = `https://api.modrinth.com/v2/search?facets=[["versions:${version}"],["created_timestamp>=${timestamp}"]]&limit=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.total_hits;
  } catch (error) {
    console.error("Error fetching mod activity:", error);
    return 0;
  }
}

// Helper function to get the date 30 days ago in 'YYYY-MM-DD' format
function getDate30DaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 30);

  return (timestamp = date.getTime() / 1000);
}

async function displayModCounts() {
  const versions = await fetchGameVersions();
  let modCounts = [];

  // Initialize mod version chart
  modChart = new Chart(document.getElementById("modChart").getContext("2d"), {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [
        {
          label: "Number of Projects",
          data: [],
          backgroundColor: [],
          borderColor: "#16181c",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      layout: { padding: 40 },
      plugins: {
        legend: { position: "bottom", display: false },
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              return `Minecraft ${tooltipItem.label}: ${tooltipItem.raw} projects`;
            },
          },
        },
        datalabels: {
          anchor: "end",
          align: "end",
          offset: 10,
          formatter: (value, ctx) => {
            const totalMods = modChart.data.datasets[0].data.reduce(
              (a, b) => a + b,
              0
            );
            const percentage = ((value / totalMods) * 100).toFixed(2) + "%";
            if (percentage < 1) return "";
            return ctx.chart.data.labels[ctx.dataIndex] + ": " + percentage;
          },
          color: "#b0bac5",
          backgroundColor: "#26292f",
          borderColor: "#16181c",
          borderWidth: 1,
          borderRadius: 3,
          padding: { top: 6, bottom: 6, left: 10, right: 10 },
          font: {
            family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI"',
            size: 12,
          },
        },
      },
    },
    plugins: [ChartDataLabels],
  });

  const cashedCounts = getCookie("mod_counts");
  if (cashedCounts) {
    modCounts = cashedCounts;
  } else {
    const loading = [{ version: "loading%", count: "0" }];
    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      const count = await fetchModCountForVersion(version);
      modCounts.push({ version, count });

      if (i % 2 == 0) {
        loading[0].version =
          "loading: " + Math.floor((i * 100) / versions.length) + "%";
        updateChart(loading);
      }
    }

    modCounts.sort((a, b) => b.count - a.count);
    setCookie("mod_counts", modCounts);
  }

  const totalMods = modCounts.reduce((sum, item) => sum + item.count, 0);
  const significantVersions = [];
  const significantCounts = [];
  let otherModsCount = 0;

  for (let item of modCounts) {
    const percentage = (item.count / totalMods) * 100;
    if (percentage >= 2) {
      significantVersions.push(item.version);
      significantCounts.push(item.count);
    } else {
      otherModsCount += item.count;
    }
  }

  if (otherModsCount > 0) {
    significantVersions.push("Others");
    significantCounts.push(otherModsCount);
  }

  updateChart(
    significantVersions.map((v, i) => ({
      version: v,
      count: significantCounts[i],
    })),
    true
  );
}

// Function to update the mod version chart
function updateChart(modCounts, withPercentages) {
  modChart.data.labels = modCounts.map((item) => item.version);
  modChart.data.datasets[0].data = modCounts.map((item) => item.count);
  modChart.data.datasets[0].backgroundColor = generateColors(modCounts.length);
  modChart.options.plugins.datalabels.formatter = (value, ctx) => {
    if (withPercentages) {
      const totalMods = modChart.data.datasets[0].data.reduce(
        (a, b) => a + b,
        0
      );
      let percentage = ((value / totalMods) * 100).toFixed(2) + "%";
      return ctx.chart.data.labels[ctx.dataIndex] + ": " + percentage;
    } else {
      return ctx.chart.data.labels[ctx.dataIndex];
    }
  };
  modChart.update();
}

// Helper function to generate random colors for the chart
function generateColors(count) {
  const colors = [
    "#ff6384",
    "#36a2eb",
    "#ffcd56",
    "#4bc0c0",
    "#9966ff",
    "#ff9f40",
  ];
  const generatedColors = [];
  for (let i = 0; i < count; i++) {
    generatedColors.push(colors[i % colors.length]);
  }
  return generatedColors;
}

// Function to display mod activity in the last 30 days
async function displayModActivityLast30Days() {
  const versions = await fetchGameVersions();
  let modCounts = [];

  // Initialize the second chart for mod activity
  modActivityChart = new Chart(
    document.getElementById("modActivityChart").getContext("2d"),
    {
      type: "doughnut",
      data: {
        labels: [],
        datasets: [
          {
            label: "Number of Projects",
            data: [],
            backgroundColor: [],
            borderColor: "#16181c",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        layout: { padding: 40 },
        plugins: {
          legend: { position: "bottom", display: false },
          tooltip: {
            callbacks: {
              label: function (tooltipItem) {
                return `Minecraft ${tooltipItem.label}: ${tooltipItem.raw} projects`;
              },
            },
          },
          datalabels: {
            anchor: "end",
            align: "end",
            offset: 10,
            formatter: (value, ctx) => {
              const totalMods = modActivityChart.data.datasets[0].data.reduce(
                (a, b) => a + b,
                0
              );
              const percentage = ((value / totalMods) * 100).toFixed(2) + "%";
              if (percentage < 1) return "";
              return ctx.chart.data.labels[ctx.dataIndex] + ": " + percentage;
            },
            color: "#b0bac5",
            backgroundColor: "#26292f",
            borderColor: "#16181c",
            borderWidth: 1,
            borderRadius: 3,
            padding: { top: 6, bottom: 6, left: 10, right: 10 },
            font: {
              family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI"',
              size: 12,
            },
          },
        },
      },
      plugins: [ChartDataLabels],
    }
  );

  const cashedCounts = getCookie("new_mods");
  if (cashedCounts) {
    modCounts = cashedCounts;
  } else {
    const loading = [{ version: "loading%", count: "0" }];
    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      const count = await fetchModActivityLast30Days(version);
      modCounts.push({ version, count });

      if (i % 2 == 0) {
        loading[0].version =
          "loading: " + Math.floor((i * 100) / versions.length) + "%";
        updateChart30Days(loading);
      }
    }

    modCounts.sort((a, b) => b.count - a.count);
    setCookie("new_mods", modCounts);
  }

  const totalMods = modCounts.reduce((sum, item) => sum + item.count, 0);
  const significantVersions = [];
  const significantCounts = [];
  let otherModsCount = 0;

  for (let item of modCounts) {
    const percentage = (item.count / totalMods) * 100;
    if (percentage >= 2) {
      significantVersions.push(item.version);
      significantCounts.push(item.count);
    } else {
      otherModsCount += item.count;
    }
  }

  if (otherModsCount > 0) {
    significantVersions.push("Others");
    significantCounts.push(otherModsCount);
  }

  updateChart30Days(
    significantVersions.map((v, i) => ({
      version: v,
      count: significantCounts[i],
    })),
    true
  );
}

function updateChart30Days(modCounts, withPercentages) {
  modActivityChart.data.labels = modCounts.map((item) => item.version);
  modActivityChart.data.datasets[0].data = modCounts.map((item) => item.count);
  modActivityChart.data.datasets[0].backgroundColor = generateColors(
    modCounts.length
  );
  modActivityChart.options.plugins.datalabels.formatter = (value, ctx) => {
    if (withPercentages) {
      const totalMods = modActivityChart.data.datasets[0].data.reduce(
        (a, b) => a + b,
        0
      );
      let percentage = ((value / totalMods) * 100).toFixed(2) + "%";
      return ctx.chart.data.labels[ctx.dataIndex] + ": " + percentage;
    } else {
      return ctx.chart.data.labels[ctx.dataIndex];
    }
  };
  modActivityChart.update();
}

getDate30DaysAgo();
displayModCounts();
displayModActivityLast30Days();